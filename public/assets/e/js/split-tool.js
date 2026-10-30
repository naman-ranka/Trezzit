/* split-tool.js: the /split tool. A receipt (from the scan above, or typed in) becomes items; tap who had
 * each item; tax and tip are spread in proportion to what each person had (the kit's engine: integer cents,
 * largest remainder, so the shares always add up to the bill exactly). "Create share link" publishes the bill
 * to the public demo API and hands back the app's /s/<token> page plus an edit link.
 *
 * The API's CORS allows https://trezzit.com only, so anywhere else (a preview, localhost) the page says so
 * and sends nothing. */
import { splitBill, toCents, centsToString, distributeByWeights } from '../../_kit/split-engine.js';
import { isLive, API } from '../../_kit/scan-client.js';
import { esc, money, itemName, storeName, icon } from './util.js';
import { PEOPLE, getSample } from './data.js';

export const APP = 'https://app.trezzit.com';
const MAX_PEOPLE = 20;
const MAX_ITEMS = 200;
/* The server stores money in 10 digits (up to 99,999,999.99); 200 items at this cap stay well under it. */
const MAX_CENTS = 9999999;
const capCents = (c) => Math.min(MAX_CENTS, Math.max(0, c));
const COLORS = ['var(--p-you)', 'var(--p-maya)', 'var(--p-jordan)', 'var(--p-sam)', 'var(--p-alex)', 'var(--p-priya)'];
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const twoDp = (c) => centsToString(c);

let seq = 0;
const nid = (p) => `${p}${(seq += 1)}`;

/* ---------- the model ---------- */

/** A blank bill: two people, one empty line. */
export function blankState() {
  const a = { id: nid('u'), name: 'You' };
  const b = { id: nid('u'), name: 'Friend' };
  return { merchant: '', date: null, currency: 'USD', people: [a, b], payer: a.id,
    items: [{ id: nid('i'), name: '', cents: 0, who: [a.id, b.id] }], taxCents: 0, tipCents: 0, receiptKeys: [], printedCents: null };
}

const members = (split) => {
  if (!split) return null;
  if (split.type === 'equal') return split.people || null;
  return Object.keys(split.shares || split.percents || split.amounts || {});
};

/** A scan result ({ sampleId, raw, bill }) -> a bill the tool can edit. Fees and a Tip line join the tip;
 *  a discount comes off the items by price (the API takes no negative lines). */
export function stateFromScan(result, keepPeople) {
  const b = result.bill;
  const sample = result.sampleId ? getSample(result.sampleId) : null;
  let people; let map = {};
  if (sample) {
    people = sample.people.map((k) => ({ id: nid('u'), name: PEOPLE[k]?.name || k }));
    sample.people.forEach((k, i) => { map[k] = people[i].id; });
  } else {
    people = keepPeople?.length ? keepPeople.map((p) => ({ ...p })) : blankState().people;
  }
  const all = people.map((p) => p.id);
  const items = []; let tip = 0; let tax = 0;
  const itemTax = b.items.some((it) => it.taxAmount !== undefined);
  b.items.forEach((it, i) => {
    if (it.isExtraCharge || it.itemType === 'Tip' || it.itemType === 'Fee') { tip += toCents(it.amount); return; }
    if (it.itemType === 'Discount') return;
    const m = sample ? members(sample.lines?.[i]?.split) : null;
    const who = m ? m.map((k) => map[k]).filter(Boolean) : all.slice();
    items.push({ id: nid('i'), name: itemName(it.name), cents: Math.max(0, toCents(it.amount)), who: who.length ? who : all.slice() });
    if (itemTax) tax += toCents(it.taxAmount);
  });
  if (!itemTax) tax = toCents(b.tax);
  if (!b.items.some((it) => it.itemType === 'Tip')) tip += toCents(b.tip);
  const disc = Math.round(Math.abs(Number(b.discountAmount) || 0) * 100);
  if (disc && items.length) {
    distributeByWeights(disc, items.map((it) => it.cents)).forEach((d, i) => { items[i].cents = Math.max(0, items[i].cents - d); });
  }
  const cur = /^[A-Z]{3}$/.test(b.currency || '') && new Intl.NumberFormat('en-US', { style: 'currency', currency: b.currency }).resolvedOptions().maximumFractionDigits === 2 ? b.currency : 'USD';
  return { merchant: storeName(b.merchant || ''), date: b.date || null, currency: cur, people, payer: people[0].id,
    items: items.length ? items : blankState().items.map((it) => ({ ...it, who: all.slice() })),
    taxCents: Math.max(0, tax), tipCents: Math.max(0, tip),
    receiptKeys: Array.isArray(result.raw?.receipt_keys) ? result.raw.receipt_keys.slice(0, 8) : [],
    printedCents: toCents(b.total) || null };
}

/** The split, by the kit's engine. Tax is spread over the items by price (so it follows whoever had them),
 *  the tip in proportion to each person's items. */
export function compute(st) {
  const ids = st.people.map((p) => p.id);
  return splitBill({
    currency: st.currency,
    people: ids,
    items: st.items.map((it) => ({ name: it.name || 'Item', amount: twoDp(it.cents), split: { type: 'equal', people: ids.filter((id) => it.who.includes(id)) } })),
    tax: st.taxCents ? twoDp(st.taxCents) : undefined,
    tip: st.tipCents ? twoDp(st.tipCents) : undefined,
  });
}

/** The exact POST /api/demo/bills/ body (02-live-apis.md 1.2): each price folds its tax in, the tip is one
 *  extra line split by EXACT amounts (a 2dp percentage drifts past the server's 1-cent check on big tips), and the bill total equals
 *  the sum of prices, of payments and of the people's totals, to the cent. */
export function buildPublishBody(st, res, clientRef) {
  const pid = new Map(st.people.map((p, i) => [p.id, `p${i + 1}`]));
  const items = res.items.filter((it) => it.itemType !== 'Tip').map((it, i) => {
    const src = st.items[i];
    const pct = it.priceCents > 0 ? Math.min(100, Math.round((it.taxCents / it.priceCents) * 100000) / 1000) : 0;
    return {
      name: (src.name || `Item ${i + 1}`).slice(0, 200), price: twoDp(it.totalCents), quantity: '1', tax_percent: String(pct), is_extra_charge: false,
      shares: st.people.filter((p) => src.who.includes(p.id)).map((p) => ({ participant: pid.get(p.id), split_type: 'EQUAL', share_amount: twoDp(it.shares[p.id] || 0) })),
    };
  });
  const tip = res.items.find((it) => it.itemType === 'Tip');
  if (tip && tip.totalCents > 0) {
    const ids = st.people.map((p) => p.id);
    const base = ids.map((id) => Math.max(0, res.people[id]?.itemsCents || 0));
    const bp = distributeByWeights(10000, base);
    items.push({ name: 'Tip', price: twoDp(tip.totalCents), quantity: '1', tax_percent: '0', is_extra_charge: true,
      shares: ids.map((id, k) => ({ id, k })).filter(({ id, k }) => bp[k] > 0 || (tip.shares[id] || 0) > 0).map(({ id, k }) => ({
        participant: pid.get(id), split_type: 'EXACT', share_amount: twoDp(tip.shares[id] || 0), exact_amount: twoDp(tip.shares[id] || 0) })) });
  }
  const total = res.totalCents;
  const body = {
    title: (st.merchant || 'Shared bill').slice(0, 200), date: st.date || todayISO(), currency: st.currency, merchant: (st.merchant || '').slice(0, 200), client_ref: clientRef,
    participants: st.people.map((p, i) => ({ public_id: `p${i + 1}`, name: (p.name.trim() || `Person ${i + 1}`).slice(0, 80) })),
    items,
    paid_by: [{ participant: pid.get(st.payer) || 'p1', amount: twoDp(total) }],
    participant_totals: st.people.map((p) => ({ participant: pid.get(p.id), owed_amount: twoDp(res.people[p.id]?.cents || 0) })),
    bill_total: twoDp(total),
  };
  if (st.receiptKeys?.length) body.receipt_keys = st.receiptKeys;
  return body;
}

/* ---------- the UI ---------- */

const color = (i) => COLORS[i % COLORS.length];
const initial = (n) => esc((n.trim()[0] || '?').toUpperCase());

export function mountSplitTool(root, opts = {}) {
  let st = blankState();
  let res = compute(st);
  let touched = false;           // the visitor changed something: a later autoplay scan must not replace it
  let published = null;          // { key, token, edit_secret } for the bill as it was published
  let clientRef = uuid();
  const live = opts.live ?? isLive();
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  root.innerHTML = `
    <div class="st-block">
      <div class="st-head"><h3 class="st-h" id="st-who-h">Who had what</h3><button type="button" class="c-link-btn st-blank">Type the items yourself</button></div>
      <p class="st-hint">${fine ? 'Click' : 'Tap'} the people who shared each item. Names and prices can be edited.</p>
      <div class="st-people" role="group" aria-labelledby="st-who-h"></div>
      <ol class="st-items" aria-label="Items"></ol>
      <button type="button" class="c-btn c-btn-sm c-btn-quiet st-add-item">${icon.plus} Add an item</button>
      <div class="st-extras">
        <label class="st-amt"><span>Tax</span><span class="st-money"><span aria-hidden="true" data-sym>$</span><input inputmode="decimal" autocomplete="off" data-extra="taxCents" aria-label="Tax"></span></label>
        <label class="st-amt"><span>Tip</span><span class="st-money"><span aria-hidden="true" data-sym>$</span><input inputmode="decimal" autocomplete="off" data-extra="tipCents" aria-label="Tip"></span></label>
        <p class="st-prop">Tax and tip are split in proportion to what each person had.</p>
      </div>
    </div>
    <div class="st-side">
    <div class="st-block st-sum" aria-labelledby="st-sum-h">
      <h3 class="st-h" id="st-sum-h">Everyone’s share</h3>
      <ul class="st-totals" role="list"></ul>
      <p class="st-check" aria-live="polite"></p>
      <p class="st-note" hidden></p>
      <label class="st-payer"><span>Paid by</span><select></select></label>
    </div>
    <div class="st-block st-share">
      <h3 class="st-h">Send one link</h3>
      <p class="st-hint">Everyone opens it on their phone, sees their share and marks it paid. Nobody needs an account.</p>
      <button type="button" class="c-btn c-btn-primary st-publish">Create share link</button>
      <div class="st-out" aria-live="polite"></div>
    </div>
    </div>
    <p class="visually-hidden" aria-live="polite" data-say></p>`;

  const $ = (s) => root.querySelector(s);
  const peopleEl = $('.st-people');
  const itemsEl = $('.st-items');
  const totalsEl = $('.st-totals');
  const out = $('.st-out');
  const say = (t) => { $('[data-say]').textContent = t; };
  const cur = () => st.currency;
  const sym = () => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: st.currency }).formatToParts(0).find((x) => x.type === 'currency')?.value || '$'; } catch { return '$'; } };

  function renderPeople() {
    peopleEl.innerHTML = st.people.map((p, i) => `
      <span class="st-person" style="--c:${color(i)}">
        <span class="st-av" aria-hidden="true">${initial(p.name)}</span>
        <input value="${esc(p.name)}" maxlength="80" aria-label="Person ${i + 1} name" data-person="${p.id}" autocomplete="off" spellcheck="false">
        <button type="button" class="st-x" data-rm-person="${p.id}" aria-label="Remove ${esc(p.name || `person ${i + 1}`)}"${st.people.length < 2 ? ' disabled' : ''}>×</button>
      </span>`).join('') + `<button type="button" class="c-btn c-btn-sm c-btn-quiet st-add-person"${st.people.length >= MAX_PEOPLE ? ' disabled' : ''}>${icon.plus} Add person</button>`;
    const sel = $('.st-payer select');
    sel.innerHTML = st.people.map((p, i) => `<option value="${p.id}"${p.id === st.payer ? ' selected' : ''}>${esc(p.name.trim() || `Person ${i + 1}`)}</option>`).join('');
  }
  function renderItems() {
    root.querySelectorAll('[data-sym]').forEach((el) => { el.textContent = sym(); });
    itemsEl.innerHTML = st.items.map((it, n) => `
      <li class="st-item" data-item="${it.id}">
        <div class="st-line">
          <input class="st-name" value="${esc(it.name)}" placeholder="Item ${n + 1}" maxlength="200" aria-label="Item ${n + 1} name" data-name autocomplete="off">
          <span class="st-money"><span aria-hidden="true">${esc(sym())}</span><input class="st-price" value="${it.cents ? twoDp(it.cents) : ''}" placeholder="0.00" inputmode="decimal" aria-label="Item ${n + 1} price" data-price autocomplete="off"></span>
          <button type="button" class="st-x" data-rm-item aria-label="Remove item ${n + 1}"${st.items.length < 2 ? ' disabled' : ''}>×</button>
        </div>
        <div class="st-who" role="group" aria-label="Who had item ${n + 1}">${st.people.map((p, i) => `<button type="button" class="st-chip" data-p="${p.id}" aria-pressed="${it.who.includes(p.id)}" style="--c:${color(i)}"><i aria-hidden="true"></i><span>${esc(p.name.trim() || `Person ${i + 1}`)}</span></button>`).join('')}</div>
        <p class="st-each money" data-each></p>
      </li>`).join('');
    $('.st-add-item').disabled = st.items.length >= MAX_ITEMS;
  }
  function renderExtras() {
    root.querySelectorAll('[data-extra]').forEach((el) => { if (document.activeElement !== el) el.value = st[el.dataset.extra] ? twoDp(st[el.dataset.extra]) : ''; });
  }
  function paint() {
    res = compute(st);
    const c = cur();
    st.items.forEach((it, i) => {
      const li = itemsEl.querySelector(`[data-item="${it.id}"]`);
      if (!li) return;
      const n = it.who.length;
      const r = res.items[i];
      li.querySelector('[data-each]').textContent = n > 1 ? `${money(r.priceCents, c)} ÷ ${n}` : n === 1 ? '' : '';
    });
    totalsEl.innerHTML = st.people.map((p, i) => {
      const pp = res.people[p.id] || { cents: 0, itemsCents: 0, extrasCents: 0 };
      return `<li style="--c:${color(i)}"><span class="st-av" aria-hidden="true">${initial(p.name)}</span><span class="st-tn">${esc(p.name.trim() || `Person ${i + 1}`)}</span><b class="money">${money(pp.cents, c)}</b></li>`;
    }).join('');
    const sum = st.people.reduce((a, p) => a + (res.people[p.id]?.cents || 0), 0);
    const ok = sum === res.totalCents;
    $('.st-check').className = `st-check${ok ? '' : ' bad'}`;
    $('.st-check').innerHTML = ok ? `${icon.check}<span>Adds up to <b class="money">${money(res.totalCents, c)}</b></span>` : `Shares add up to ${money(sum, c)}, not ${money(res.totalCents, c)}`;
    const note = $('.st-note');
    if (st.printedCents && st.printedCents !== res.totalCents) { note.hidden = false; note.textContent = `The receipt’s total is ${money(st.printedCents, c)}. Check the items, tax and tip.`; } else note.hidden = true;
    if (published && published.key !== key()) { out.innerHTML = '<p class="st-msg">You changed the bill. Create a new link to share these numbers.</p>'; published = null; clientRef = uuid(); }
  }
  const key = () => JSON.stringify([st.people, st.items, st.taxCents, st.tipCents, st.payer, st.merchant]);
  function all() { renderPeople(); renderItems(); renderExtras(); paint(); }

  function load(next, { user = false } = {}) {
    if (!user && touched) return;
    st = next;
    out.innerHTML = '';
    published = null; clientRef = uuid();
    all();
  }
  const edit = () => { touched = true; };

  /* people */
  peopleEl.addEventListener('input', (e) => {
    const id = e.target.dataset.person;
    if (!id) return;
    edit();
    st.people.find((p) => p.id === id).name = e.target.value;
    const i = st.people.findIndex((p) => p.id === id);
    e.target.previousElementSibling.textContent = (e.target.value.trim()[0] || '?').toUpperCase();
    itemsEl.querySelectorAll(`.st-chip[data-p="${id}"] span`).forEach((s) => { s.textContent = e.target.value.trim() || `Person ${i + 1}`; });
    $('.st-payer select').options[i].textContent = e.target.value.trim() || `Person ${i + 1}`;
    paint();
  });
  peopleEl.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm-person]');
    if (rm && st.people.length > 1) {
      edit();
      const id = rm.dataset.rmPerson;
      const name = st.people.find((p) => p.id === id).name || 'Person';
      st.people = st.people.filter((p) => p.id !== id);
      // an item only they had goes to everyone left, so no line is left with nobody
      st.items.forEach((it) => { it.who = it.who.filter((x) => x !== id); if (!it.who.length) it.who = st.people.map((p) => p.id); });
      if (st.payer === id) st.payer = st.people[0].id;
      all();
      say(`${name} removed.`);
      peopleEl.querySelector('input')?.focus();
      return;
    }
    if (e.target.closest('.st-add-person') && st.people.length < MAX_PEOPLE) {
      edit();
      const p = { id: nid('u'), name: `Person ${st.people.length + 1}` };
      // the newcomer joins every item that everyone shares
      st.items.forEach((it) => { if (st.people.every((q) => it.who.includes(q.id))) it.who.push(p.id); });
      st.people.push(p);
      all();
      const inp = peopleEl.querySelector(`[data-person="${p.id}"]`);
      inp?.focus(); inp?.select();
    }
  });
  $('.st-payer select').addEventListener('change', (e) => { edit(); st.payer = e.target.value; paint(); });

  /* items */
  const itemOf = (el) => st.items.find((it) => it.id === el.closest('[data-item]')?.dataset.item);
  itemsEl.addEventListener('input', (e) => {
    const it = itemOf(e.target);
    if (!it) return;
    edit();
    if (e.target.matches('[data-name]')) it.name = e.target.value;
    if (e.target.matches('[data-price]')) it.cents = capCents(toCents(e.target.value));
    paint();
  });
  itemsEl.addEventListener('change', (e) => {
    if (e.target.matches('[data-price]')) { const it = itemOf(e.target); e.target.value = it.cents ? twoDp(it.cents) : ''; }
  });
  itemsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.st-chip');
    const it = chip && itemOf(chip);
    if (chip && it) {
      const id = chip.dataset.p;
      if (it.who.includes(id)) {
        if (it.who.length === 1) { say('Someone has to have each item. Add another person to it first.'); chip.classList.remove('nope'); void chip.offsetWidth; chip.classList.add('nope'); return; }
        it.who = it.who.filter((x) => x !== id);
      } else it.who = st.people.map((p) => p.id).filter((x) => x === id || it.who.includes(x));
      edit();
      chip.setAttribute('aria-pressed', String(it.who.includes(id)));
      paint();
      return;
    }
    const rm = e.target.closest('[data-rm-item]');
    if (rm && st.items.length > 1) {
      edit();
      const idx = st.items.indexOf(itemOf(rm));
      st.items.splice(idx, 1);
      renderItems(); paint();
      itemsEl.querySelectorAll('[data-name]')[Math.max(0, idx - 1)]?.focus();
    }
  });
  $('.st-add-item').addEventListener('click', () => {
    if (st.items.length >= MAX_ITEMS) return;
    edit();
    st.items.push({ id: nid('i'), name: '', cents: 0, who: st.people.map((p) => p.id) });
    renderItems(); paint();
    itemsEl.lastElementChild.querySelector('[data-name]').focus();
  });
  root.querySelectorAll('[data-extra]').forEach((el) => {
    el.addEventListener('input', () => { edit(); st[el.dataset.extra] = capCents(toCents(el.value)); paint(); });
    el.addEventListener('change', () => { el.value = st[el.dataset.extra] ? twoDp(st[el.dataset.extra]) : ''; });
  });
  $('.st-blank').addEventListener('click', () => {
    load(blankState(), { user: true });
    touched = true;
    itemsEl.querySelector('[data-name]').focus();
  });

  /* publish */
  const appLink = `<a href="${APP}/split">Open the splitter in the app ${icon.arrow}</a>`;
  async function publish() {
    if (!(res.totalCents > 0)) { out.innerHTML = '<p class="st-msg">Add a price first: the bill is $0.00.</p>'; return; }
    const body = buildPublishBody(st, res, clientRef);
    opts.onBody?.(body);
    if (!live) {
      out.innerHTML = `<p class="st-msg">Share links are created on trezzit.com. This copy of the page can’t reach the server, so nothing was sent. ${appLink}</p>`;
      return;
    }
    const btn = $('.st-publish');
    btn.disabled = true; btn.textContent = 'Creating link…';
    try {
      const r = await fetch(`${API}/api/demo/bills/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) throw Object.assign(new Error('limit'), { msg: 'Too many links from this network today. Try again tomorrow, or' });
      if (!r.ok || !data.token) throw Object.assign(new Error(`HTTP ${r.status}`), { msg: 'That didn’t work, and nothing was saved. Try again, or' });
      published = { key: key(), token: data.token, edit_secret: data.edit_secret || published?.edit_secret || null };
      showLink();
    } catch (err) {
      out.innerHTML = `<p class="st-msg">${esc(err.msg || 'The server couldn’t be reached, so nothing was sent. Try again, or')} ${appLink}</p>`;
    } finally { btn.disabled = false; btn.textContent = 'Create share link'; }
  }
  function showLink() {
    const url = `${APP}/s/${encodeURIComponent(published.token)}`;
    const editUrl = published.edit_secret ? `${APP}/split?edit=${encodeURIComponent(published.token)}&key=${encodeURIComponent(published.edit_secret)}` : null;
    out.innerHTML = `
      <div class="st-link">
        <p class="st-ok">${icon.check}<span>Your link is ready. Anyone with it can see the bill.</span></p>
        <div class="url-box st-url"><span class="url-l">Share link</span><code>${esc(url)}</code><button type="button" class="c-btn c-btn-sm c-btn-quiet" data-copy-link>${icon.copy} Copy</button></div>
        <p class="st-after"><a href="${esc(url)}" target="_blank" rel="noopener">Open it</a>${editUrl ? ` · <a href="${esc(editUrl)}" target="_blank" rel="noopener">Keep editing in the app</a>` : ''}</p>
        <p class="st-fine">It stays up for 90 days after the last visit. Sign in to keep it for good. The edit link is the only way back to editing this bill, so keep this tab open until you’ve used it.</p>
      </div>`;
    const cp = out.querySelector('[data-copy-link]');
    cp.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); cp.innerHTML = `${icon.check} Copied`; } catch { cp.textContent = 'Select and copy'; }
      setTimeout(() => { cp.innerHTML = `${icon.copy} Copy`; }, 1800);
    });
    say('Share link ready.');
  }
  $('.st-publish').addEventListener('click', () => {
    if (published && published.key === key()) { showLink(); return; }
    publish();
  });

  all();
  return {
    /** user: the visitor picked this receipt (it replaces their edits); otherwise edits are kept. */
    load(result, { user = false } = {}) { load(stateFromScan(result, st.people), { user }); },
    get state() { return st; },
    get result() { return res; },
  };
}
