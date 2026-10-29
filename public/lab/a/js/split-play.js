/* split-play.js: the playable itemized split. Tap a face to add or remove someone from a line;
 * the kit's engine (integer cents, largest remainder) re-splits and every total updates. */
import { PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { $, $$, esc, money, ICON, avatar } from './util.js';
import { loadModel, compute, lineMembers, SHORT, SAMPLES } from './data.js';
import { toCents } from '../../_kit/split-engine.js';

// who paid each sample (the landing says the same): dinner is Alex's group bill; the rest you paid
const PAYER = { 'taqueria-sol': 'alex' };
const COLLAPSE_AT = 7;

export function mountSplit(root, { initial = 'green-basket' } = {}) {
  root.innerHTML = `
    <div class="play-bar">
      <div class="seg-ctl" role="group" aria-label="Choose a receipt">
        ${SAMPLES.map((s) => `<button type="button" data-id="${s.id}" aria-pressed="false">${SHORT[s.id].label}</button>`).join('')}
        <button type="button" data-id="live" aria-pressed="false" hidden>Your scan</button>
      </div>
      <button type="button" class="btn btn-quiet reset">${ICON.replay}Reset</button>
    </div>
    <div class="play-grid">
      <div class="panel p-list"><div class="p-rows"></div><div class="p-more" hidden><button type="button" class="btn btn-quiet more-btn"></button></div></div>
      <div class="panel p-sum" role="group" aria-label="Who spent what">
        <h3>Who spent what</h3>
        <div class="p-people"></div>
        <div class="p-check"></div>
        <div class="p-you"></div>
      </div>
    </div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;

  const rowsEl = $('.p-rows', root);
  const moreWrap = $('.p-more', root);
  const moreBtn = $('.more-btn', root);
  const peopleEl = $('.p-people', root);
  const checkEl = $('.p-check', root);
  const youEl = $('.p-you', root);
  const live = $('[data-live]', root);
  let model = null;
  let original = null;
  let expanded = false;
  let liveModel = null;
  let announceT = 0;

  const press = (id) => $$('.play-bar .seg-ctl button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));

  const prep = (m) => m;

  async function load(idOrModel) {
    const m = typeof idOrModel === 'string' ? await loadModel(idOrModel) : idOrModel;
    if (m.id === 'live') { liveModel = m; $('[data-id="live"]', root).hidden = false; }
    model = prep({ ...m, lines: JSON.parse(JSON.stringify(m.lines)), people: [...m.people] });
    original = JSON.parse(JSON.stringify(model.lines));
    expanded = false;
    press(model.id);
    render();
  }

  function shareText(it) {
    const ids = model.people.filter((p) => (it.shares[p] || 0) !== 0);
    const vals = ids.map((p) => it.shares[p]);
    if (ids.length > 1 && vals.every((v) => v === vals[0])) return `${money(vals[0])} each`;
    if (ids.length === 1) return '';
    return ids.map((p) => `${PEOPLE[p].name} ${money(it.shares[p])}`).join(' · ');
  }
  const join = (...xs) => xs.filter(Boolean).join(' · ');

  function render() {
    const res = compute(model);
    const narrow = innerWidth < 960;
    const lines = model.lines.map((l, i) => ({ l, it: res.items.find((x) => x.index === i) || res.items[i] }));
    // a bill-level tip becomes an extra line in the engine result
    const tipItem = res.items.find((x) => x.itemType === 'Tip' && x.index >= model.lines.length);
    const visible = expanded || !narrow || lines.length <= COLLAPSE_AT + 1 ? lines : lines.slice(0, COLLAPSE_AT);
    rowsEl.innerHTML = visible.map(({ l, it }) => {
      if (l.extra) {
        return `<div class="p-row is-extra"><span class="p-name">${esc(l.pretty)}</span><span class="p-price money">${money(it.totalCents)}</span>
          <span class="p-detail">${esc(join('Follows what each person ordered', shareText(it)))}</span></div>`;
      }
      const members = lineMembers(l);
      const how = l.split.type === 'equal' ? (members.length === 1 ? `Just ${members[0] === 'you' ? 'you' : PEOPLE[members[0]].name}` : `${members.length} ways`) : (l.split.type === 'percentage' ? 'By percentage' : l.split.type === 'exact' ? 'Exact amounts' : 'By shares');
      const tax = l.taxCents ? ` (incl. ${money(l.taxCents)} tax)` : '';
      return `<div class="p-row" data-i="${l.index}">
        <span class="p-name">${esc(l.pretty)}</span>
        <span class="p-price money">${money(it.totalCents)}</span>
        <span class="p-detail">${esc(join(how + tax, shareText(it)))}</span>
        <span class="p-who" role="group" aria-label="Who shares ${esc(l.pretty)}">
          ${model.people.map((p) => `<button type="button" class="p-tog" data-p="${p}" aria-pressed="${members.includes(p)}" aria-label="${esc(PEOPLE[p].name)}">${avatar(PEOPLE[p])}</button>`).join('')}
        </span></div>`;
    }).join('') + (tipItem ? `<div class="p-row is-extra"><span class="p-name">Tip</span><span class="p-price money">${money(tipItem.totalCents)}</span>
      <span class="p-detail">${esc(join('Follows what each person ordered', shareText(tipItem)))}</span></div>` : '');
    moreWrap.hidden = !(narrow && lines.length > COLLAPSE_AT + 1);
    moreBtn.textContent = expanded ? 'Show fewer' : `Show all ${lines.length} items`;

    // people
    const max = Math.max(1, ...model.people.map((p) => res.people[p]?.cents || 0));
    peopleEl.innerHTML = model.people.map((p) => {
      const pr = res.people[p] || { cents: 0, byCategory: {} };
      const segs = Object.entries(pr.byCategory).filter(([, c]) => c > 0)
        .map(([cat, c]) => `<i style="--c:${CATEGORIES[cat]?.color || CATEGORIES.other.color};width:${(100 * c) / max}%"></i>`).join('');
      return `<div class="p-person">${avatar(PEOPLE[p])}<span class="nm">${esc(PEOPLE[p].name)}</span><span class="amt money">${money(pr.cents)}</span><span class="bar">${segs}</span></div>`;
    }).join('');

    const sum = res.check.sumCents;
    const ok = res.check.ok;
    checkEl.className = `p-check${ok ? '' : ' bad'}`;
    checkEl.innerHTML = ok ? `${ICON.check}<span>Adds up to ${money(sum)}.</span>` : `<span>Shares add up to ${money(sum)}, not ${money(res.check.expectedCents)}.</span>`;

    const payer = PAYER[model.id] || 'you';
    if (payer !== 'you') {
      // someone else paid: your share still counts, and you owe it to them
      const mine = res.people.you?.cents || 0;
      youEl.innerHTML = `
        <div class="p-you-row"><span>${esc(PEOPLE[payer].name)} paid</span><span class="money">${money(res.totalCents)}</span></div>
        <div class="p-you-row"><span>You owe ${esc(PEOPLE[payer].name)}</span><strong class="money">${money(mine)}</strong></div>`;
    } else {
    // you paid the whole bill; everyone else owes you their share
    const others = model.people.filter((p) => p !== 'you' && (res.people[p]?.cents || 0) > 0);
    const owed = others.reduce((a, p) => a + res.people[p].cents, 0);
    const names = others.map((p) => PEOPLE[p].name);
    const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} owe` : `${names[0] || 'Nobody'} owes`;
    youEl.innerHTML = `
      <div class="p-you-row"><span>You paid</span><span class="money">${money(res.totalCents)}</span></div>
      ${owed ? `<div class="p-you-row"><span>${esc(who)} you</span><strong class="money">${money(owed)}</strong></div>` : '<div class="p-you-row"><span>All yours. Nobody owes you.</span></div>'}`;
    }

    clearTimeout(announceT);
    announceT = setTimeout(() => {
      live.textContent = model.people.map((p) => `${PEOPLE[p].name} ${money(res.people[p]?.cents || 0)}`).join(', ') + (ok ? '. Adds up exactly.' : '.');
    }, 400);
  }

  rowsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.p-tog');
    if (!btn) return;
    const row = btn.closest('.p-row');
    const line = model.lines[+row.dataset.i];
    const p = btn.dataset.p;
    let members = lineMembers(line);
    if (members.includes(p)) {
      if (members.length === 1) {
        btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope');
        live.textContent = 'Someone has to have it. Add another person first.';
        return;
      }
      members = members.filter((x) => x !== p);
    } else members = [...members, p];
    line.split = { type: 'equal', people: model.people.filter((x) => members.includes(x)) };
    const focusKey = `${row.dataset.i}:${p}`;
    render();
    const again = rowsEl.querySelector(`.p-row[data-i="${focusKey.split(':')[0]}"] .p-tog[data-p="${p}"]`);
    again?.focus({ preventScroll: true });
  });
  moreBtn.addEventListener('click', () => { expanded = !expanded; render(); });
  $('.reset', root).addEventListener('click', () => { model.lines = JSON.parse(JSON.stringify(original)); render(); });
  $$('.play-bar .seg-ctl button', root).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.id === 'live') { if (liveModel) load(liveModel); } else load(b.dataset.id);
  }));
  let lastNarrow = innerWidth < 960;
  addEventListener('resize', () => { const n = innerWidth < 960; if (n !== lastNarrow) { lastNarrow = n; if (model) render(); } }, { passive: true });

  const ready = load(initial);
  return { load, ready };
}

export { toCents };
