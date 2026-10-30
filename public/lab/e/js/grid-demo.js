/* grid-demo.js: "Split by item" as A's tap grid, in C's visual system.
 * Rows are items, columns are people (avatar, name and their live total on top). Tap a dot to add or
 * remove someone from an item; the kit's engine (integer cents, largest remainder) re-splits, so the
 * totals always add up to the receipt exactly. The nine plain groceries everyone shares fold into one
 * row (open on tap); a dot on it changes all nine at once. Someone always has to have an item: a tap
 * that would leave a line with nobody is refused, with the reason in the footer.
 * Keyboard: the dots are one tab stop (roving tabindex); arrows move, Space or Enter toggles.
 * Phones: the people row is sticky inside the grid, so the totals stay in view while you tap.
 * "Receipt" opens the paper receipt the split came from (a native <dialog>). */
import { billFromScan, splitBill, toCents } from '../../_kit/split-engine.js';
import { receiptHTML, ensureReceiptStyles } from '../../_kit/receipts.js';
import { PEOPLE, CATEGORIES, getSample, sampleBill } from './data.js';
import { esc, money, itemName, storeName, icon, bus, reduced, onVisible, YOU_GLYPH, css } from './util.js';

const ROOMIES = ['you', 'maya', 'jordan', 'sam'];
const clone = (o) => JSON.parse(JSON.stringify(o));
const members = (l) => {
  const s = l.split;
  if (!s) return [];
  if (s.type === 'equal') return s.people || [];
  if (s.type === 'shares') return Object.keys(s.shares || {});
  if (s.type === 'percentage') return Object.keys(s.percents || {});
  if (s.type === 'exact') return Object.keys(s.amounts || {});
  return [];
};
const avatar = (p) => `<span class="av" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? YOU_GLYPH : esc(PEOPLE[p].name[0])}</span>`;

/** A model from a scan result ({ sampleId, raw, bill }): A's modelFrom, kept to what the grid needs. */
function modelFrom(result) {
  const sample = result.sampleId ? getSample(result.sampleId) : null;
  const people = sample ? sample.people.slice() : ROOMIES.slice();
  const lines = result.bill.items.map((it, i) => {
    const def = sample?.lines?.[i] || {};
    const extra = it.isExtraCharge;
    return {
      index: i, name: it.name, pretty: itemName(it.name),
      taxCents: toCents(it.taxAmount), category: def.category || sample?.tipCategory || 'other',
      split: def.split ? clone(def.split) : (extra ? null : { type: 'equal', people: people.slice() }), extra,
    };
  });
  return { id: result.sampleId || 'live', raw: result.raw, bill: result.bill, sample, people, lines,
    merchant: storeName(result.bill.merchant || result.raw?.receipt?.storeInformation?.title || 'Receipt'), totalCents: toCents(result.bill.total) };
}
function compute(m, tipMode = 'proportional') {
  const b = billFromScan(m.bill, m.people, (_, i) => ({ split: m.lines[i].split || undefined, category: m.lines[i].category }));
  if (m.sample?.tipCategory) b.tipCategory = m.sample.tipCategory;
  // "Tax and tip: Equally" (trips): the tip becomes one more line everyone shares equally
  if (tipMode === 'equal' && b.tip) {
    b.items.push({ name: 'Tip', amount: b.tip, itemType: 'Tip', isExtraCharge: true, split: { type: 'equal', people: m.people.slice() }, category: b.tipCategory });
    delete b.tip;
  }
  return splitBill(b);
}

export async function mountGrid(root, opts = {}) {
  css('grid');
  ensureReceiptStyles();
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const id = opts.sampleId || 'green-basket';
  const { raw, bill } = await sampleBill(id);
  let m = modelFrom({ sampleId: id, raw, bill });
  let original = clone(m.lines);
  let tipMode = 'proportional';
  let res = compute(m, tipMode);
  let edited = false;
  const payer = opts.payer || 'you';
  const paidBy = payer === 'you' ? 'you paid' : `${PEOPLE[payer].name} paid`;
  let fr = 0; let fc = 0; // roving focus: visible row, person

  root.classList.add('tg');
  function build() {
    const people = m.people;
    // the plain lines everyone shares (no tax of their own) fold into one row: the grid shows only what differs
    const fold = m.lines.map((l, i) => i).filter((i) => !m.lines[i].extra && !m.lines[i].taxCents && members(m.lines[i]).length === people.length);
    const folded = fold.length >= (opts.foldMin || 3) ? fold : [];
    // "Shared groceries": the folded row is the receipt's shared subtotal, never mistaken for your share
    const foldCat = opts.foldLabel || (folded.length && folded.every((i) => m.lines[i].category === m.lines[folded[0]].category) ? `Shared ${(CATEGORIES[m.lines[folded[0]].category]?.label || 'items').toLowerCase()}` : 'Shared items');
    const dots = (label) => people.map((p) => `<span class="tg-dc" role="gridcell"><button type="button" class="tg-dot" data-p="${p}" aria-label="${esc(label)}: ${esc(PEOPLE[p].name)}" aria-pressed="false" tabindex="-1" style="--c:${PEOPLE[p].color}"><i></i></button></span>`).join('');
    const catDot = (l) => `<i class="tg-cat" style="--c:${(CATEGORIES[l.category] || CATEGORIES.other).color}" title="${esc((CATEGORIES[l.category] || CATEGORIES.other).label)}"></i>`;
    const row = (l, sub) => `<div class="tg-row${sub ? ' tg-sub-row' : ''}" role="row" data-lines="${l.index}">
        <span class="tg-nm" role="rowheader">${sub ? '' : catDot(l)}<span>${esc(l.pretty)}${l.taxCents ? ' <small>with tax</small>' : ''}</span></span>
        <span class="tg-pr money" role="gridcell" data-i="${l.index}"></span>${l.extra ? `<span class="tg-dc tg-prop" role="gridcell">By what each ordered</span>` : dots(l.pretty)}</div>`;
    root.innerHTML = `
      <div class="tg-top">
        <p class="tg-bill"><b>${esc(m.merchant)}</b><span><span class="money">${money(m.totalCents)}</span> · ${m.lines.length} items · ${paidBy}</span></p>
        <button type="button" class="c-btn c-btn-sm c-btn-quiet tg-rcpt" aria-haspopup="dialog">${icon.receipt || ''}Receipt</button>
      </div>
      ${opts.tipToggle && m.bill.tip ? `<div class="tg-tip"><span id="tg-tip-l-${uid}">Tip</span>
        <div class="seg" role="radiogroup" aria-labelledby="tg-tip-l-${uid}">
          <button type="button" role="radio" aria-checked="true" tabindex="0" data-tip="proportional">In proportion</button>
          <button type="button" role="radio" aria-checked="false" tabindex="-1" data-tip="equal">Equally</button>
        </div></div>` : ''}
      <div class="tg-body">
        <div class="tg-grid" role="grid" aria-label="Who had what on ${esc(m.merchant)}" aria-describedby="tg-hint-${uid}" style="--n:${people.length}">
          <div class="tg-people" role="row">
            <span class="tg-hint" role="columnheader"><span>${fine ? 'Click' : 'Tap'} any dot.</span><span hidden id="tg-hint-${uid}">${fine ? 'Click' : 'Tap'} a dot to change who had what.</span></span>
            <span class="tg-pr-h" role="columnheader"><span class="visually-hidden">Price</span></span>
            ${people.map((p) => `<span class="tg-p" role="columnheader" data-p="${p}">${avatar(p)}<span class="tg-pn">${esc(PEOPLE[p].name)}</span><b class="tg-pa money"></b></span>`).join('')}
          </div>
          <div class="tg-rows" role="rowgroup">
            ${folded.length ? `<div class="tg-row tg-grp" role="row" data-lines="${folded.join(',')}">
              <span class="tg-nm" role="rowheader">${catDot(m.lines[folded[0]])}<button type="button" class="tg-exp" aria-expanded="false" aria-controls="tg-sub-${uid}"><span>${esc(foldCat)}</span><small>${folded.length} items</small><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></span>
              <span class="tg-pr money" role="gridcell" data-sum="${folded.join(',')}"></span>${dots(`${foldCat}, ${folded.length} items`)}</div>
            <div class="tg-sub" id="tg-sub-${uid}" role="none" hidden>${folded.map((i) => row(m.lines[i], true)).join('')}</div>` : ''}
            ${m.lines.filter((l) => !folded.includes(l.index)).map((l) => row(l, false)).join('')}
            ${opts.tipToggle && m.bill.tip ? `<div class="tg-row tg-tiprow" role="row"><span class="tg-nm" role="rowheader">${catDot({ category: m.sample?.tipCategory || 'other' })}<span>Tip</span></span>
              <span class="tg-pr money" role="gridcell">${money(toCents(m.bill.tip))}</span><span class="tg-dc tg-prop" role="gridcell" data-tip-how></span></div>` : ''}
          </div>
        </div>
      </div>
      <div class="tg-foot">
        <p class="tg-you">You spent <b class="money" data-you></b></p>
        <p class="tg-check" aria-hidden="true"></p>
        <button type="button" class="tg-reset" aria-label="Reset the split" title="Reset">${icon.replay}</button>
      </div>
      <p class="visually-hidden" aria-live="polite" data-say></p>
      <dialog class="tg-dlg" aria-label="${esc(m.merchant)} receipt"><div class="tg-dlg-in"><button type="button" class="tg-x" aria-label="Close">×</button><div class="tg-paper">${receiptHTML(m.raw, { sample: m.sample, shadow: false }).replace(/<p>ITEMS \d+<\/p>\s*/, '')}</div></div></dialog>`;
    uid += 1;
  }
  build();

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const linesOf = (r) => r.dataset.lines.split(',').map(Number);
  const vis = () => $$('.tg-row').filter((r) => !r.closest('.tg-sub[hidden]') && r.querySelector('.tg-dot'));
  let whyT = 0;

  function paint() {
    const people = m.people;
    $$('.tg-pr[data-i]').forEach((el) => { el.textContent = money(res.items[+el.dataset.i].totalCents); });
    $$('.tg-pr[data-sum]').forEach((el) => { el.textContent = money(el.dataset.sum.split(',').reduce((a, i) => a + res.items[+i].totalCents, 0)); });
    people.forEach((p) => { const el = root.querySelector(`.tg-p[data-p="${p}"] .tg-pa`); el.textContent = money(res.people[p]?.cents || 0); });
    const rows = vis();
    if (fr >= rows.length) fr = rows.length - 1;
    rows.forEach((r, ri) => {
      const ix = linesOf(r);
      r.querySelectorAll('.tg-dot').forEach((b, c) => {
        const n = ix.filter((i) => (res.items[i].shares?.[b.dataset.p] || 0) > 0).length;
        const all = n === ix.length;
        b.classList.toggle('on', all);
        b.classList.toggle('part', n > 0 && !all);
        b.setAttribute('aria-pressed', all ? 'true' : n ? 'mixed' : 'false');
        b.tabIndex = ri === fr && c === fc ? 0 : -1;
      });
    });
    $$('.tg-sub[hidden] .tg-dot').forEach((b) => { b.tabIndex = -1; });
    const how = root.querySelector('[data-tip-how]');
    if (how) how.textContent = tipMode === 'equal' ? 'Equally' : 'By what each ordered';
    const you = res.people.you?.cents || 0;
    $('[data-you]').textContent = money(you);
    foot();
    $('.tg-reset').classList.toggle('is-off', !edited);
    $('.tg-reset').tabIndex = edited ? 0 : -1;
  }
  function foot() {
    clearTimeout(whyT);
    const el = $('.tg-check');
    el.className = `tg-check${res.check.ok ? '' : ' bad'}`;
    el.innerHTML = res.check.ok ? `${icon.check}Adds up to <b class="money">${money(res.check.sumCents)}</b>` : `Shares add up to ${money(res.check.sumCents)}, not ${money(res.check.expectedCents)}`;
  }
  const say = (t) => { $('[data-say]').textContent = t; };
  function resplit() {
    res = compute(m, tipMode);
    paint();
    opts.onChange?.(res, { tipMode });
    say(`You spent ${money(res.people.you?.cents || 0)}. ${m.people.filter((p) => p !== 'you').map((p) => `${PEOPLE[p].name} ${money(res.people[p]?.cents || 0)}`).join(', ')}. ${res.check.ok ? `Adds up to ${money(res.check.sumCents)}.` : ''}`);
  }
  function why(row) {
    const who = row.querySelector('.tg-dc:last-child')?.parentElement;
    row.classList.remove('nope'); void row.offsetWidth; row.classList.add('nope');
    const el = $('.tg-check');
    el.className = 'tg-check is-why';
    el.textContent = 'Someone has to have it.';
    say('Someone has to have it. Add another person first.');
    whyT = setTimeout(foot, 2000);
    return who;
  }
  function toggle(btn) {
    const row = btn.closest('.tg-row');
    const p = btn.dataset.p;
    const ix = linesOf(row);
    const onAll = ix.every((i) => members(m.lines[i]).includes(p));
    if (onAll) {
      if (ix.some((i) => members(m.lines[i]).length === 1)) { why(row); return; }
      ix.forEach((i) => { const keep = members(m.lines[i]).filter((x) => x !== p); m.lines[i].split = { type: 'equal', people: m.people.filter((x) => keep.includes(x)) }; });
    } else {
      ix.forEach((i) => { const add = [...members(m.lines[i]), p]; m.lines[i].split = { type: 'equal', people: m.people.filter((x) => add.includes(x)) }; });
    }
    edited = isEdited();
    resplit();
    const p2 = root.querySelector(`.tg-p[data-p="${p}"]`);
    if (p2 && !reduced()) { p2.classList.remove('bump'); void p2.offsetWidth; p2.classList.add('bump'); }
  }
  const isEdited = () => tipMode !== 'proportional' || JSON.stringify(m.lines.map((l) => l.split)) !== JSON.stringify(original.map((l) => l.split));
  function setTip(mode) {
    if (tipMode === mode) return;
    tipMode = mode;
    $$('.tg-tip [data-tip]').forEach((b) => { const on = b.dataset.tip === mode; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    edited = isEdited();
    resplit();
  }
  function reset() {
    m.lines = clone(original);
    if (tipMode !== 'proportional') { tipMode = 'equal'; setTip('proportional'); }
    edited = false;
    setFold(false);
    resplit();
  }
  function setFold(open) {
    const sub = $('.tg-sub');
    const exp = $('.tg-exp');
    if (!sub) return;
    const y0 = exp.getBoundingClientRect().top;
    sub.hidden = !open;
    exp.setAttribute('aria-expanded', String(open));
    $('.tg-grp').classList.toggle('is-open', open);
    paint();
    // the row you tapped stays where it was (scroll anchoring would otherwise follow content below)
    const dy = exp.getBoundingClientRect().top - y0;
    if (Math.abs(dy) > 1) scrollBy({ top: dy, behavior: 'instant' });
    if (open && !reduced()) sub.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('.tg-exp') || (e.target.closest('.tg-grp') && !e.target.closest('.tg-dc'))) { setFold($('.tg-sub').hidden); return; }
    const btn = e.target.closest('.tg-dot');
    if (btn) {
      const rows = vis();
      fr = rows.indexOf(btn.closest('.tg-row')); fc = m.people.indexOf(btn.dataset.p);
      toggle(btn);
      return;
    }
    if (e.target.closest('.tg-reset')) { reset(); $('.tg-dot[tabindex="0"]')?.focus({ preventScroll: true }); return; }
    if (e.target.closest('.tg-rcpt')) { openReceipt(); return; }
    const tb = e.target.closest('.tg-tip [data-tip]');
    if (tb) { setTip(tb.dataset.tip); return; }
    if (e.target.closest('.tg-x') || e.target.matches('.tg-dlg')) $('.tg-dlg').close();
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.closest?.('.tg-tip .seg') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      setTip(tipMode === 'equal' ? 'proportional' : 'equal');
      $(`.tg-tip [data-tip="${tipMode}"]`).focus();
      return;
    }
    const btn = e.target.closest?.('.tg-dot');
    if (!btn) return;
    const rows = vis();
    let r = Math.max(0, rows.indexOf(btn.closest('.tg-row'))); let c = m.people.indexOf(btn.dataset.p);
    const mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (mv) { r = Math.max(0, Math.min(rows.length - 1, r + mv[0])); c = Math.max(0, Math.min(m.people.length - 1, c + mv[1])); }
    else if (e.key === 'Home') c = 0;
    else if (e.key === 'End') c = m.people.length - 1;
    else return;
    e.preventDefault();
    fr = r; fc = c;
    paint();
    rows[r].querySelectorAll('.tg-dot')[c]?.focus();
  });
  root.addEventListener('focusin', (e) => {
    const btn = e.target.closest?.('.tg-dot');
    if (!btn) return;
    const rows = vis();
    fr = rows.indexOf(btn.closest('.tg-row')); fc = m.people.indexOf(btn.dataset.p);
  });
  function openReceipt() {
    const d = $('.tg-dlg');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    d.querySelector('.tg-x').focus();
  }

  paint();
  opts.onChange?.(res, { tipMode });
  // the dots pop in, row by row, the first time the grid is on screen
  if (!reduced()) {
    root.classList.add('pre');
    onVisible(root, () => { root.classList.remove('pre'); root.classList.add('enter'); setTimeout(() => root.classList.remove('enter'), 1200); }, { threshold: 0.25 });
  }

  // the scan above hands over the receipt it just read: back to its default split, and the people row flashes once
  if (opts.listen) {
    bus.on('receipt', (result) => {
      if (!result?.bill) return;
      if (result.sampleId === m.id) reset();
      else {
        m = modelFrom(result); original = clone(m.lines); edited = false; fr = 0; fc = 0;
        tipMode = 'proportional'; build(); res = compute(m, tipMode); paint();
      }
      const ppl = $('.tg-people');
      ppl.classList.remove('flash'); void ppl.offsetWidth; ppl.classList.add('flash');
    });
  }
  return { reset, get result() { return res; } };
}
let uid = 0;
