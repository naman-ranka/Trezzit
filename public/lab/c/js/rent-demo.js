/* rent-demo.js: an itemized monthly rent you can reprice; every share follows to the cent.
 * mountRent(root, { compact, sideRoot, onChange }) — compact (roommates page) shows the rent and the four shares only;
 * sideRoot (recurring page) takes the 'Coming up' column, so it can lead the page; onChange(result) after every change. */
import { splitBill, distributeEqually } from '../../_kit/split-engine.js';
import { PEOPLE } from './data.js';
import { money, countMoney, icon, esc, YOU_GLYPH } from './util.js';

const ROOM = ['you', 'maya', 'jordan', 'sam'];
const PCT = { you: 25, maya: 25, jordan: 28, sam: 22 };
const eq = { type: 'equal', people: ROOM };
// the site's "now" is late October: Jun to Oct are history, Nov is next
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const NEXT = 'Nov';
const MIN = 10000; // $100.00: a rent below that is a typo, not a rent
const HIST = 63935; // your share each month so far

export function mountRent(root, opts = {}) {
let rent = 240000;
let mode = 'auto';
function compute() {
  return splitBill({
    people: ROOM,
    items: [
      { name: 'Rent', amount: (rent / 100).toFixed(2), split: { type: 'percentage', percents: PCT } },
      { name: 'Water & sewer', amount: '68.40', split: eq },
      { name: 'Trash & recycling', amount: '24.00', split: eq },
      { name: 'Internet', amount: '65.00', split: eq },
      { name: 'Parking space', amount: '75.00', split: { type: 'exact', amounts: { jordan: '75.00' } } },
    ],
  });
}

const flix = distributeEqually(2499, 4);
// the mode toggle sits under the one row it changes (the next rent), not above the list
const MODE = `<li class="rec-mode"><span id="mode-l">Rent on the 1st</span>
      <div class="seg" role="radiogroup" aria-labelledby="mode-l">
        <button type="button" role="radio" aria-checked="true" data-mode="auto">Add automatically</button>
        <button type="button" role="radio" aria-checked="false" data-mode="review">Ask me first</button>
      </div></li>`;
const SIDE = `<div class="rec-side">
    <p class="rec-sub">Coming up</p>
    <ul class="upcoming" role="list"></ul>
    <div class="hist">
      <div class="hist-top"><span>Your rent share since June</span><b class="money" data-k="hist"></b></div>
      <div class="hist-bars" aria-hidden="true"></div>
      <div class="hist-lbl" aria-hidden="true">${MONTHS.map((m) => `<span>${m}</span>`).join('')}<span class="nx">${NEXT}</span></div>
    </div>
    ${opts.moreHref ? `<a class="rec-more" href="${esc(opts.moreHref)}">Split rent by room size <span aria-hidden="true">→</span> Roommates</a>` : ''}
  </div>`;
root.innerHTML = `<div class="rec${opts.compact || opts.sideRoot ? ' rec-compact' : ''}">
  <div class="rec-sched">
    <div class="rec-top">
      <p class="rec-name"><span class="ic">${icon.repeat}</span><span><b>Monthly rent</b><small>Apartment 3B · on the 1st · Maya pays</small></span></p>
    </div>
    <div class="rec-edit">
      <label for="rent-in">Rent</label>
      <span class="money-in-field">$<input id="rent-in" inputmode="decimal" pattern="[0-9,]*([.][0-9]{0,2})?" value="2,400.00" aria-describedby="rent-help"></span>
      <span class="step-btns"><button type="button" data-step="-2500" aria-label="Lower rent by $25">−</button><button type="button" data-step="2500" aria-label="Raise rent by $25">+</button></span>
      <span id="rent-help" class="muted small" aria-live="polite"></span>
    </div>
    <ul class="rec-lines" role="list"></ul>
    <ul class="sp-people rec-shares" role="list" aria-live="polite">${ROOM.map((p) => `<li class="sp-person" data-p="${p}"><span class="av" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? YOU_GLYPH : PEOPLE[p].name[0]}</span><span class="sp-pn">${PEOPLE[p].name}</span><b class="money sp-pa"></b></li>`).join('')}</ul>
    <p class="sp-check rec-check">${icon.check}<span></span></p>
  </div>
  ${opts.compact || opts.sideRoot ? '' : SIDE}
</div>`;
if (opts.sideRoot) opts.sideRoot.innerHTML = SIDE;
const side = opts.sideRoot || root;

const input = root.querySelector('#rent-in');
const linesEl = root.querySelector('.rec-lines');
const upEl = side.querySelector('.upcoming');
const bars = side.querySelector('.hist-bars');
const histEl = side.querySelector('[data-k="hist"]');
let prev = null;

function render() {
  const r = compute();
  // one name for the rent's split, said once, on its own line: by room size, with your percent beside your share
  const method = { 0: 'By room size', 1: 'Equally', 2: 'Equally', 3: 'Equally', 4: 'Just Jordan' };
  linesEl.innerHTML = r.items.map((it, i) => `<li><span>${esc(it.name)}</span><b class="money">${money(it.totalCents)}</b><span>${method[i]}${it.shares.you ? ` · you ${i === 0 ? `${PCT.you}% · ` : ''}${money(it.shares.you)}` : ''}</span></li>`).join('')
    + `<li class="rec-total"><span>Each month</span><b class="money">${money(r.totalCents)}</b></li>`;
  ROOM.forEach((p) => {
    const b = root.querySelector(`.sp-person[data-p="${p}"] .sp-pa`);
    countMoney(b, prev ? prev.people[p].cents : r.people[p].cents, r.people[p].cents, prev ? 380 : 0);
  });
  root.querySelector('.rec-check span').innerHTML = `Adds up to <b class="money">${money(r.check.sumCents)}</b>`;
  opts.onChange?.(r);
  if (opts.compact) { prev = r; return; }
  const you = r.people.you.cents;
  // one status pill (the next rent); the rows after it just say how they arrive
  const quiet = (m) => `<span class="up-how">${m === 'auto' ? 'Auto' : 'Review'}</span>`;
  const rows = [
    ['Nov', 1, 'Monthly rent', 'Rent + utilities · your share', money(you), ''],
    ['Nov', 5, 'Netflix', 'Split 4 ways', money(flix[0]), quiet('auto')],
    ['Nov', 15, 'Gym membership', 'Just you', '$39.00', quiet('auto')],
    ['Dec', 1, 'Monthly rent', 'Same split', money(you), quiet(mode)],
  ].map(([m, d, t, s, a, status]) => `<li class="up-row"><span class="mr-d"><small>${m}</small>${d}</span><span><b>${t}</b><small>${s}</small></span><span class="up-r"><b class="money">${a}</b>${status}</span></li>`);
  // the toggle is drawn once, then kept (re-rendering it would drop keyboard focus)
  if (!upEl.querySelector('.rec-mode')) {
    upEl.innerHTML = rows[0] + MODE + rows.slice(1).join('');
    bindMode();
  } else {
    const live = [...upEl.querySelectorAll('.up-row')];
    rows.forEach((html, i) => { live[i].outerHTML = html; });
  }
  const vals = [...MONTHS.map(() => HIST), you];
  const max = Math.max(...vals) * 1.08;
  bars.innerHTML = vals.map((v, i) => `<i class="${i === vals.length - 1 ? 'nx' : i === vals.length - 2 ? 'now' : ''}" style="--h:${(v / max) * 100}%"></i>`).join('');
  // history only: Jun to Oct is what you spent; Nov is the next one, drawn as an outline
  const total = vals.slice(0, -1).reduce((a, b) => a + b, 0);
  countMoney(histEl, prev ? Number(histEl.dataset.c) : total, total, prev ? 380 : 0);
  histEl.dataset.c = total;
  prev = r;
}

const help = root.querySelector('#rent-help');
const HELP = help.textContent;
let helpT = 0;
function flashHelp(msg) {
  help.textContent = msg;
  help.classList.add('warn');
  clearTimeout(helpT);
  helpT = setTimeout(() => { help.textContent = HELP; help.classList.remove('warn'); }, 1800);
}
function setRent(cents, fromInput = false) {
  rent = Math.max(MIN, Math.min(1000000, Math.round(cents)));
  if (!fromInput) { input.value = (rent / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); lastText = input.value; }
  render();
}
// the field and the math never disagree: only a well-formed amount changes the rent;
// anything else keeps the last good rent until the field is left (then it snaps back)
const VALID = /^\d[\d,]*(\.\d{0,2})?$/;
input.addEventListener('beforeinput', (e) => {
  if (e.data && /[^0-9.,]/.test(e.data)) e.preventDefault();
});
let lastText = input.value;
input.addEventListener('input', () => {
  const raw = input.value.trim();
  if (raw === '') return; // clearing to retype: the math keeps the last rent until a new one is typed
  if (!VALID.test(raw)) { input.value = lastText; return; } // refuse a malformed edit ("1.2.3")
  lastText = raw;
  const v = Math.round(Number(raw.replace(/,/g, '')) * 100);
  if (!Number.isFinite(v)) return;
  if (v > 1000000) { setRent(1000000); flashHelp('Up to $10,000.00'); return; }
  if (v < MIN) return; // "2" on the way to "2600": the math waits; leaving the field snaps it to the minimum
  setRent(v, true);
});
// leaving the field (or Enter) formats it; a rent under $100.00 snaps to $100.00 and says why
function commit() {
  const v = Math.round(Number(input.value.trim().replace(/,/g, '')) * 100);
  if (input.value.trim() && Number.isFinite(v) && v < MIN) { setRent(MIN); flashHelp('At least $100.00'); return; }
  setRent(rent);
}
input.addEventListener('blur', commit);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
  const next = rent + Number(b.dataset.step);
  if (next < MIN) flashHelp('At least $100.00');
  setRent(next);
}));
function bindMode() {
  side.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    side.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    render();
  }));
}
render();
return { compute };
}
