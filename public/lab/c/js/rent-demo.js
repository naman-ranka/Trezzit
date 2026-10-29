/* rent-demo.js: an itemized monthly rent you can reprice; every share follows to the cent.
 * mountRent(root, { compact }) — compact (roommates page) shows the rent and the four shares only. */
import { splitBill, distributeEqually } from '../../_kit/split-engine.js';
import { PEOPLE } from './data.js';
import { money, countMoney, icon, esc } from './util.js';

const ROOM = ['you', 'maya', 'jordan', 'sam'];
const PCT = { you: 25, maya: 25, jordan: 28, sam: 22 };
const eq = { type: 'equal', people: ROOM };
const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
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
root.innerHTML = `<div class="rec${opts.compact ? ' rec-compact' : ''}">
  <div class="rec-sched">
    <div class="rec-top">
      <p class="rec-name"><span class="ic">${icon.repeat}</span><span><b>Monthly rent</b><small>Apartment 3B · every month on the 1st · Maya pays</small></span></p>
    </div>
    <div class="rec-edit">
      <label for="rent-in">Rent</label>
      <span class="money-in-field">$<input id="rent-in" inputmode="decimal" pattern="[0-9,]*([.][0-9]{0,2})?" value="2,400.00" aria-describedby="rent-help"></span>
      <span class="step-btns"><button type="button" data-step="-2500" aria-label="Lower rent by $25">−</button><button type="button" data-step="2500" aria-label="Raise rent by $25">+</button></span>
      <span id="rent-help" class="muted small">Split 25 · 25 · 28 · 22 %</span>
    </div>
    <ul class="rec-lines" role="list"></ul>
    <ul class="sp-people rec-shares" role="list" aria-live="polite">${ROOM.map((p) => `<li class="sp-person" data-p="${p}"><span class="av" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? 'You' : PEOPLE[p].name[0]}</span><span class="sp-pn">${PEOPLE[p].name}</span><b class="money sp-pa"></b></li>`).join('')}</ul>
    <p class="sp-check rec-check">${icon.check}<span></span></p>
  </div>
  ${opts.compact ? '' : `<div class="rec-side">
    <div class="rec-mode"><span id="mode-l">On the 1st</span>
      <div class="seg" role="radiogroup" aria-labelledby="mode-l">
        <button type="button" role="radio" aria-checked="true" data-mode="auto">Add automatically</button>
        <button type="button" role="radio" aria-checked="false" data-mode="review">Ask me first</button>
      </div>
    </div>
    <p class="rec-sub">Coming up</p>
    <ul class="upcoming" role="list"></ul>
    <div class="hist">
      <div class="hist-top"><span>Your rent share since July</span><b class="money" data-k="hist"></b></div>
      <div class="hist-bars" aria-hidden="true"></div>
      <div class="hist-lbl" aria-hidden="true">${MONTHS.map((m) => `<span>${m}</span>`).join('')}<span class="nx">Dec</span></div>
    </div>
  </div>`}
</div>`;

const input = root.querySelector('#rent-in');
const linesEl = root.querySelector('.rec-lines');
const upEl = root.querySelector('.upcoming');
const bars = root.querySelector('.hist-bars');
const histEl = root.querySelector('[data-k="hist"]');
let prev = null;

function render() {
  const r = compute();
  const method = { 0: 'By percent', 1: 'Equally', 2: 'Equally', 3: 'Equally', 4: 'Just Jordan' };
  linesEl.innerHTML = r.items.map((it, i) => `<li><span>${esc(it.name)}</span><b class="money">${money(it.totalCents)}</b><span>${method[i]}${it.shares.you ? ` · you ${money(it.shares.you)}` : ""}</span></li>`).join('')
    + `<li class="rec-total"><span>Each month</span><b class="money">${money(r.totalCents)}</b></li>`;
  ROOM.forEach((p) => {
    const b = root.querySelector(`.sp-person[data-p="${p}"] .sp-pa`);
    countMoney(b, prev ? prev.people[p].cents : r.people[p].cents, r.people[p].cents, prev ? 380 : 0);
  });
  root.querySelector('.rec-check span').innerHTML = `Shares add up to <b class="money">${money(r.check.sumCents)}</b>, exactly.`;
  if (opts.compact) { prev = r; return; }
  const you = r.people.you.cents;
  const st = mode === 'auto' ? '<span class="up-status auto">Adds automatically</span>' : '<span class="up-status review">You review it</span>';
  upEl.innerHTML = [
    ['Dec', 1, 'Monthly rent', `Your share of ${money(r.totalCents)}`, money(you), st],
    ['Dec', 5, 'Netflix', 'Split 4 ways: $6.25, $6.25, $6.25, $6.24', money(flix[0]), '<span class="up-status auto">Adds automatically</span>'],
    ['Dec', 15, 'Gym membership', 'Just you', '$39.00', '<span class="up-status auto">Adds automatically</span>'],
    ['Jan', 1, 'Monthly rent', 'Same split', money(you), st],
  ].map(([m, d, t, s, a, status]) => `<li class="up-row"><span class="mr-d"><small>${m}</small>${d}</span><span><b>${t}</b><small>${s}</small></span><span class="up-r"><b class="money">${a}</b>${status}</span></li>`).join('');
  const vals = [...MONTHS.map(() => HIST), you];
  const max = Math.max(...vals) * 1.08;
  bars.innerHTML = vals.map((v, i) => `<i class="${i === vals.length - 1 ? 'nx' : i === vals.length - 2 ? 'now' : ''}" style="--h:${(v / max) * 100}%"></i>`).join('');
  // history only: Jul to Nov is what you spent; Dec is the next one, drawn as an outline
  const total = vals.slice(0, -1).reduce((a, b) => a + b, 0);
  countMoney(histEl, prev ? Number(histEl.dataset.c) : total, total, prev ? 380 : 0);
  histEl.dataset.c = total;
  prev = r;
}

function setRent(cents, fromInput = false) {
  rent = Math.max(0, Math.min(1000000, Math.round(cents)));
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
  if (v > 1000000) { setRent(1000000); return; }
  setRent(v, true);
});
input.addEventListener('blur', () => setRent(rent));
root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => setRent(rent + Number(b.dataset.step))));
root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  root.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  render();
}));
render();
return { compute };
}
