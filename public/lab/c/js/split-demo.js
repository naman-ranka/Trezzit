/* split-demo.js: a playable itemized split. Tap who shares each line; every
 * share is recomputed by the kit's split engine (integer cents, largest
 * remainder), so the totals always add up to the receipt exactly. */
import { billFromScan, splitBill, toCents } from '../../_kit/split-engine.js';
import { PEOPLE, CATEGORIES, SAMPLE_META, getSample, sampleBill } from './data.js';
import { esc, money, countMoney, itemName, storeName, icon, bus, reduced } from './util.js';

const ROOMIES = ['you', 'maya', 'jordan', 'sam'];
const eq = (people) => ({ type: 'equal', people });
// "Maya", "Maya and Jordan", "Maya, Jordan and Sam" (house style: no serial comma)
const andList = { format: (a) => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`) };

export function mountSplit(root, opts = {}) {
  root.classList.add('split');
  if (opts.yours === false) root.classList.add('no-yours');
  const st = {
    sampleId: null, title: '', bill: null, people: [], lines: [], original: [], featured: null,
    expanded: !!opts.expanded, tipMode: 'proportional', result: null, payer: opts.payer || 'you',
  };

  root.innerHTML = `
    <div class="sp-head">
      <p class="sp-bill"><b class="sp-title"></b><span class="sp-sub"></span></p>
      <ul class="sp-people" role="list" aria-live="polite" aria-atomic="false"></ul>
      <p class="sp-yours"></p>
    </div>
    <div class="sp-tip" hidden>
      <span id="sp-tip-l-${uid}">Tax and tip</span>
      <div class="seg" role="radiogroup" aria-labelledby="sp-tip-l-${uid}">
        <button type="button" role="radio" aria-checked="true" data-tip="proportional">In proportion</button>
        <button type="button" role="radio" aria-checked="false" data-tip="equal">Equally</button>
      </div>
    </div>
    <p class="sp-hint">Tap a person on any line</p>
    <ul class="sp-items" role="list"></ul>
    <div class="sp-extra" hidden></div>
    <button type="button" class="sp-more c-link-btn" hidden></button>
    <div class="sp-foot">
      <p class="sp-check">${icon.check}<span></span></p>
      <button type="button" class="c-btn c-btn-sm c-btn-quiet sp-reset">${icon.replay} Reset</button>
    </div>
    <p class="visually-hidden sp-say" aria-live="polite"></p>
    ${opts.balances ? '<div class="sp-bal"><p class="sp-bal-t">Who owes whom</p><ul role="list"></ul></div>' : ''}`;
  const id = uid; uid += 1;

  const $ = (s) => root.querySelector(s);
  const peopleEl = $('.sp-people');
  const itemsEl = $('.sp-items');
  const more = $('.sp-more');
  const say = $('.sp-say');

  function participants(line, i) {
    const shares = st.result?.items.find((it) => it.index === i)?.shares || {};
    const ids = Object.keys(shares).filter((k) => shares[k] > 0);
    if (ids.length) return ids;
    return line.split?.people || st.people;
  }

  function method(line) {
    const s = line.split || {};
    if (s.type === 'percentage') return `By percent · ${Object.entries(s.percents).map(([k, v]) => `${PEOPLE[k].name} ${v}%`).join(', ')}`;
    if (s.type === 'exact') return 'Exact amount';
    if (s.type === 'shares') return 'By shares';
    const p = s.people || st.people;
    if (p.length === st.people.length && st.people.length > 1) return 'Everyone, equally';
    if (p.length === 1) return p[0] === 'you' ? 'Just you' : `Just ${PEOPLE[p[0]].name}`;
    return `${andList.format(p.map((x) => PEOPLE[x].name))}, equally`;
  }

  function compute() {
    const input = billFromScan(st.bill, st.people, (_, i) => st.lines[i] || {});
    const s = st.sampleId && getSample(st.sampleId);
    if (s?.tipCategory) input.tipCategory = s.tipCategory;
    if (st.tipMode === 'equal' && input.tip) {
      input.items.push({ name: 'Tip', amount: input.tip, itemType: 'Tip', isExtraCharge: true, split: eq(st.people), category: input.tipCategory });
      delete input.tip;
    }
    st.result = splitBill(input);
  }

  function renderPeople(first) {
    const r = st.result;
    if (first) {
      peopleEl.innerHTML = st.people.map((p) => `<li class="sp-person" data-p="${p}">
        <span class="av" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? 'You' : PEOPLE[p].name[0]}</span>
        <span class="sp-pn">${PEOPLE[p].name}</span><b class="money sp-pa">${money(r.people[p]?.cents || 0)}</b></li>`).join('');
      return;
    }
    st.people.forEach((p) => {
      const li = peopleEl.querySelector(`[data-p="${p}"]`);
      const b = li.querySelector('.sp-pa');
      const to = r.people[p]?.cents || 0;
      const from = toCents(b.textContent);
      if (from !== to) {
        li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash');
        countMoney(b, from, to, 420);
      }
    });
  }

  function renderYours() {
    const y = st.result.people.you;
    const el = $('.sp-yours');
    if (!y) { el.innerHTML = ''; return; }
    const cats = Object.entries(y.byCategory).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
    el.innerHTML = cats.length > 0 && st.people.length > 1
      ? `<span class="muted">Your ${money(y.cents)}:</span> ${cats.map(([k, c]) => `<span class="cat"><i style="--c:${(CATEGORIES[k] || CATEGORIES.other).color}"></i>${(CATEGORIES[k] || CATEGORIES.other).label} <b class="money">${money(c)}</b></span>`).join('')}`
      : '';
  }

  function rowHTML(line, i) {
    const it = st.bill.items[i];
    const item = st.result.items.find((x) => x.index === i);
    const cat = CATEGORIES[line.category] || null;
    // the line price already includes its tax, so say "incl.", never "+"
    const tax = item.taxCents ? `incl. ${money(item.taxCents)} tax` : '';
    return `<li class="sp-row" data-i="${i}">
      <div class="sp-line">
        <span class="sp-name">${esc(itemName(it.name))}</span>
        <b class="money sp-price">${money(item.totalCents)}</b>
        <span class="sp-meta">${cat ? `<i style="--c:${cat.color}"></i>${cat.label} · ` : ''}<span class="sp-method">${esc(method(line))}</span>${tax ? `<span class="sp-tax">${tax}</span>` : ''}</span>
      </div>
      <div class="sp-who" role="group" aria-label="Who shares ${esc(itemName(it.name))}" style="--n:${st.people.length}">
        ${st.people.map((p, k) => `<button type="button" class="who" data-p="${p}" aria-pressed="false" tabindex="${k === 0 ? 0 : -1}" style="--av-c:${PEOPLE[p].color}">
          <span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? 'You' : PEOPLE[p].name[0]}</span>
          <span class="who-n">${PEOPLE[p].name}</span><span class="money who-a"></span></button>`).join('')}
      </div></li>`;
  }

  function updateRows() {
    itemsEl.querySelectorAll('.sp-row').forEach((row) => {
      const i = +row.dataset.i;
      const item = st.result.items.find((x) => x.index === i);
      const shares = item.shares || {};
      row.querySelector('.sp-method').textContent = method(st.lines[i]);
      row.querySelectorAll('.who').forEach((b) => {
        const c = shares[b.dataset.p] || 0;
        b.setAttribute('aria-pressed', String(c > 0));
        b.querySelector('.who-a').textContent = c > 0 ? money(c) : '';
        b.setAttribute('aria-label', `${PEOPLE[b.dataset.p].name}${c > 0 ? `, ${money(c)}` : ', not sharing'}`);
      });
    });
  }

  function visibleIndexes() {
    const n = st.bill.items.filter((it) => !it.isExtraCharge).length;
    const all = st.bill.items.map((_, i) => i).filter((i) => !st.bill.items[i].isExtraCharge);
    if (st.expanded || !st.featured) return all;
    return st.featured.filter((i) => i < n);
  }

  function renderRows() {
    const idx = visibleIndexes();
    itemsEl.innerHTML = idx.map((i) => rowHTML(st.lines[i], i)).join('');
    const total = st.bill.items.filter((it) => !it.isExtraCharge).length;
    if (st.featured && total > idx.length) {
      more.hidden = false;
      more.innerHTML = `Show all ${total} items ${icon.plus}`;
    } else if (st.featured && st.expanded) {
      more.hidden = false;
      more.textContent = 'Show fewer items';
    } else more.hidden = true;
    updateRows();
  }

  function renderExtras() {
    const el = root.querySelector('.sp-extra');
    const tip = st.result.items.find((it) => it.itemType === 'Tip');
    if (!tip) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="sp-line"><span class="sp-name">Tip</span><b class="money sp-price">${money(tip.totalCents)}</b>
      <span class="sp-meta">${st.tipMode === 'equal' ? 'Split equally' : 'In proportion to what each person ordered'}</span></div>
      <p class="sp-tipshares">${st.people.map((p) => `<span><span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? 'You' : PEOPLE[p].name[0]}</span><b class="money">${money(tip.shares[p] || 0)}</b><span class="visually-hidden"> ${PEOPLE[p].name}</span></span>`).join('')}</p>`;
  }

  function renderFoot() {
    renderExtras();
    const r = st.result;
    $('.sp-check span').innerHTML = r.check.ok
      ? `Shares add up to <b class="money">${money(r.totalCents)}</b>, exactly.`
      : `Shares add up to ${money(r.check.sumCents)}.`;
    root.classList.toggle('is-ok', r.check.ok);
    const changed = st.lines.some((l, i) => JSON.stringify(l.split) !== JSON.stringify(st.original[i].split)) || st.tipMode !== 'proportional';
    $('.sp-reset').disabled = !changed;
    if (opts.balances) {
      const payer = st.payer;
      const rows = st.people.filter((p) => p !== payer && (r.people[p]?.cents || 0) > 0)
        .map((p) => `<li><span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${PEOPLE[p].name[0]}</span><span>${PEOPLE[p].name} owes ${payer === 'you' ? 'you' : PEOPLE[payer].name}</span><b class="money">${money(r.people[p].cents)}</b></li>`);
      const owed = st.people.filter((p) => p !== payer).reduce((a, p) => a + (r.people[p]?.cents || 0), 0);
      root.querySelector('.sp-bal ul').innerHTML = rows.join('') + `<li class="sum"><span>${payer === 'you' ? 'Owed to you' : 'Owed'}</span><b class="money">${money(owed)}</b></li>`;
    }
  }

  function renderAll() {
    compute();
    const s = st.sampleId && getSample(st.sampleId);
    $('.sp-title').textContent = st.title;
    const nItems = st.bill.items.filter((it) => !it.isExtraCharge).length;
    $('.sp-sub').textContent = `${money(st.result.totalCents)} · ${nItems} items · ${st.payer === 'you' ? 'you paid' : `${PEOPLE[st.payer].name} paid`}`;
    $('.sp-tip').hidden = !(opts.tipToggle && st.bill.tip);
    renderPeople(true);
    renderYours();
    renderRows();
    renderFoot();
    root.dataset.sample = st.sampleId || 'live';
    void s;
  }

  function update() {
    compute();
    renderPeople(false);
    renderYours();
    updateRows();
    renderFoot();
  }

  async function load(sampleId, scanBill) {
    if (sampleId) {
      const s = getSample(sampleId);
      const { bill } = await sampleBill(sampleId);
      st.sampleId = sampleId;
      st.bill = bill;
      st.people = [...s.people];
      st.lines = bill.items.map((_, i) => ({ ...(s.lines[i] || { split: eq(s.people), category: 'other' }) }));
      st.title = SAMPLE_META[sampleId]?.label || s.title;
      st.payer = opts.payer || SAMPLE_META[sampleId]?.payer || 'you';
      st.featured = opts.expanded ? null : SAMPLE_META[sampleId]?.featured || null;
      if (st.people.length === 1) st.featured = null;
    } else {
      st.sampleId = null;
      st.bill = scanBill;
      st.people = [...ROOMIES];
      st.lines = scanBill.items.map(() => ({ split: eq(ROOMIES), category: 'other' }));
      st.title = storeName(scanBill.merchant) || 'Your receipt';
      st.payer = opts.payer || 'you';
      st.featured = scanBill.items.length > 6 ? scanBill.items.slice(0, 4).map((_, i) => i) : null;
    }
    st.original = st.lines.map((l) => ({ ...l }));
    st.expanded = !!opts.expanded;
    st.tipMode = 'proportional';
    root.querySelectorAll('.sp-tip [data-tip]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tip === 'proportional')));
    renderAll();
  }

  itemsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.who');
    if (!b) return;
    const i = +b.closest('.sp-row').dataset.i;
    const p = b.dataset.p;
    const cur = participants(st.lines[i], i);
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    const name = itemName(st.bill.items[i].name);
    if (next.length === 0) {
      const row = b.closest('.sp-row');
      row.classList.remove('nope'); void row.offsetWidth; row.classList.add('nope');
      say.textContent = `Someone has to pay for ${name}.`;
      return;
    }
    root.classList.add('touched');
    const ordered = st.people.filter((x) => next.includes(x));
    st.lines[i] = { ...st.lines[i], split: eq(ordered) };
    update();
    const mine = st.result.items.find((x) => x.index === i)?.shares?.you || 0;
    say.textContent = `${name}: ${method(st.lines[i])}${mine ? `, your part ${money(mine)}` : ''}.`;
  });
  // one tab stop per row: arrows move between people, Space or Enter toggles
  itemsEl.addEventListener('keydown', (e) => {
    const b = e.target.closest('.who');
    if (!b) return;
    const all = [...b.parentElement.querySelectorAll('.who')];
    const k = all.indexOf(b);
    const to = { ArrowRight: k + 1, ArrowDown: k + 1, ArrowLeft: k - 1, ArrowUp: k - 1, Home: 0, End: all.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = all[(to + all.length) % all.length];
    all.forEach((x) => { x.tabIndex = x === next ? 0 : -1; });
    next.focus();
  });
  itemsEl.addEventListener('focusin', (e) => {
    const b = e.target.closest('.who');
    if (b) b.parentElement.querySelectorAll('.who').forEach((x) => { x.tabIndex = x === b ? 0 : -1; });
  });
  // phones: the sticky totals bar must never cover the focused chip
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => root.style.setProperty('--sp-people-h', `${peopleEl.offsetHeight}px`)).observe(peopleEl);
  }
  more.addEventListener('click', () => {
    st.expanded = !st.expanded;
    renderRows();
    if (st.expanded) itemsEl.querySelectorAll('.sp-row')[st.featured.length]?.querySelector('.who')?.focus({ preventScroll: true });
  });
  $('.sp-reset').addEventListener('click', () => {
    st.lines = st.original.map((l) => ({ ...l }));
    st.tipMode = 'proportional';
    root.querySelectorAll('.sp-tip [data-tip]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tip === 'proportional')));
    update();
    say.textContent = 'Split reset.';
  });
  root.querySelectorAll('.sp-tip [data-tip]').forEach((b) => b.addEventListener('click', () => {
    st.tipMode = b.dataset.tip;
    root.querySelectorAll('.sp-tip [data-tip]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    update();
  }));

  if (opts.listen) {
    bus.on('receipt', (res) => {
      root.classList.remove('arrive'); void root.offsetWidth;
      if (!reduced()) root.classList.add('arrive');
      load(res.source === 'sample' ? res.sampleId : null, res.bill);
    });
  }

  const ready = load(opts.sampleId || 'green-basket');
  return { load, ready, state: st, id };
}
let uid = 0;
