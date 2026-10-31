/* rent-demo.js: an itemized monthly rent you can reprice; every share follows to the cent.
 * mountRent(root, { compact, sideRoot, onChange }) — compact (roommates page) shows the rent and the four shares only;
 * sideRoot (recurring page) takes the 'Coming up' column, so it can lead the page; onChange(result) after every change. */
import { splitBill, distributeEqually } from '../../_kit/split-engine.js';
import { PEOPLE } from './data.js';
import { money, countMoney, icon, esc, YOU_GLYPH, css } from './util.js';

const ROOM = ['you', 'maya', 'jordan', 'sam'];
const PCT = { you: 25, maya: 25, jordan: 28, sam: 22 };
const eq = { type: 'equal', people: ROOM };
// the site's "now" is late October: Jun to Oct are history, Nov is next
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const MIN = 10000; // $100.00: a rent below that is a typo, not a rent
const HIST = 63935; // your share each month so far

export function mountRent(root, opts = {}) {
  css('rent'); // its styles (linked by the page already; loads them if not)
let rent = 240000;
let mode = 'auto';
function compute() {
  return splitBill({
    people: ROOM,
    items: [
      { name: 'Rent', amount: (rent / 100).toFixed(2), split: { type: 'percentage', percents: PCT } },
      { name: 'Water and sewer', amount: '68.40', split: eq },
      { name: 'Trash and recycling', amount: '24.00', split: eq },
      { name: 'Internet', amount: '65.00', split: eq },
      { name: 'Parking space', amount: '75.00', split: { type: 'exact', amounts: { jordan: '75.00' } } },
    ],
  });
}

const flix = distributeEqually(1799, 4); // Netflix Standard, Maya pays
// the mode toggle sits under the one row it changes (the next rent), not above the list
const MODE = `<li class="rec-mode"><span id="mode-l">Rent on the 1st</span>
      <div class="seg" role="radiogroup" aria-labelledby="mode-l">
        <button type="button" role="radio" aria-checked="true" tabindex="0" data-mode="auto">Add automatically</button>
        <button type="button" role="radio" aria-checked="false" tabindex="-1" data-mode="review">Ask me first</button>
      </div></li>`;
const SIDE = `<div class="rec-side">
    <p class="rec-sub">Coming up</p>
    <ul class="upcoming" role="list"></ul>
    <p class="hist-row"><span>Your rent share since June</span><b class="money" data-k="hist"></b></p>
    ${opts.moreHref ? `<a class="rec-more" href="${esc(opts.moreHref)}">Split rent by room size <span aria-hidden="true">→</span> Roommates</a>` : ''}
  </div>`;
root.innerHTML = `<div class="rec${opts.compact || opts.sideRoot ? ' rec-compact' : ''}">
  <div class="rec-sched">
    <div class="rec-top">
      <p class="rec-name"><span class="ic">${icon.repeat}</span><span><b>Monthly rent</b><small>Apartment 3B · on the 1st</small></span></p>
    </div>
    <div class="rec-edit">
      <label for="rent-in">Rent</label>
      <label class="money-in-field" for="rent-in">$<input id="rent-in" aria-label="Monthly rent" inputmode="decimal" pattern="[0-9,]*([.][0-9]{0,2})?" value="2,400.00" aria-describedby="rent-sub rent-help"></label>
      <span id="rent-sub" class="rec-rsub"></span>
      <span id="rent-help" class="rec-help">Type your rent</span>
      <span class="visually-hidden" role="status" data-say></span>
    </div>
    <ul class="rec-lines" role="list"></ul>
    <ul class="sp-people rec-shares" role="list">${ROOM.map((p) => `<li class="sp-person" data-p="${p}"><span class="av" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? YOU_GLYPH : PEOPLE[p].name[0]}</span><span class="sp-pn">${PEOPLE[p].name}</span><b class="money sp-pa"></b></li>`).join('')}</ul>
    <p class="sp-check rec-check">${icon.check}<span></span></p>
  </div>
  ${opts.compact || opts.sideRoot ? '' : SIDE}
</div>`;
if (opts.sideRoot) opts.sideRoot.innerHTML = SIDE;
const side = opts.sideRoot || root;

const input = root.querySelector('#rent-in');
// the field is as wide as its amount, so "$" sits against the figure like every other amount in the card
const mirror = document.createElement('span');
mirror.setAttribute('aria-hidden', 'true');
mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;left:0;top:0';
input.parentElement.appendChild(mirror);
const fitInput = () => { const cs = getComputedStyle(input); mirror.style.font = cs.font; mirror.style.fontVariantNumeric = cs.fontVariantNumeric; mirror.style.letterSpacing = cs.letterSpacing; mirror.textContent = input.value || '0'; input.style.width = `${Math.ceil(mirror.getBoundingClientRect().width) + 1}px`; };
input.addEventListener('input', fitInput);
fitInput();
const linesEl = root.querySelector('.rec-lines');
const upEl = side.querySelector('.upcoming');
const histEl = side.querySelector('[data-k="hist"]');
let prev = null;

function render() {
  const r = compute();
  // one name for the rent's split, said once, on its own line: by room size, with your percent beside your share
  // the rent itself is the editable row (its split on one sub-line under the amount); the bills follow
  const method = { 0: 'By room size', 1: 'Equally', 2: 'Equally', 3: 'Equally', 4: 'Just Jordan' };
  root.querySelector('#rent-sub').textContent = `${method[0]} (${ROOM.map((p) => PCT[p]).join('/')}%) · you ${money(r.items[0].shares.you)}`;
  linesEl.innerHTML = r.items.slice(1).map((it, j) => `<li><span>${esc(it.name)}</span><b class="money">${money(it.totalCents)}</b><span>${method[j + 1]}${it.shares.you ? ` · you ${money(it.shares.you)}` : ''}</span></li>`).join('')
    + `<li class="rec-total"><span>Each month</span><b class="money">${money(r.totalCents)}</b></li>`;
  ROOM.forEach((p) => {
    const b = root.querySelector(`.sp-person[data-p="${p}"] .sp-pa`);
    countMoney(b, prev ? prev.people[p].cents : r.people[p].cents, r.people[p].cents, prev ? 380 : 0);
  });
  root.querySelector('.rec-check span').innerHTML = `Adds up to <b class="money">${money(r.check.sumCents)}</b>`;
  opts.onChange?.(r);
  if (opts.compact) { prev = r; return; }
  const you = r.people.you.cents;
  // the control under Nov 1 says how rent arrives; the rows after it carry no repeated status
  const rows = [
    ['Nov', 1, 'Monthly rent', 'Rent + utilities · your share', money(you)],
    ['Nov', 12, 'Netflix', 'Maya pays · split 4 ways', money(flix[0])],
    ['Nov', 15, 'Gym membership', 'Just you', '$39.00'],
    ['Dec', 1, 'Monthly rent', '', money(you)],
  ].map(([m, d, t, s, a]) => `<li class="up-row"><span class="mr-d"><small>${m}</small>${d}</span><span><b>${t}</b>${s ? `<small>${s}</small>` : ''}</span><span class="up-r"><b class="money">${a}</b></span></li>`);
  // the toggle is drawn once, then kept (re-rendering it would drop keyboard focus)
  if (!upEl.querySelector('.rec-mode')) {
    upEl.innerHTML = rows[0] + MODE + rows.slice(1).join('');
    bindMode();
  } else {
    const live = [...upEl.querySelectorAll('.up-row')];
    rows.forEach((html, i) => { live[i].outerHTML = html; });
  }
  // history only: Jun to Oct is what you spent (Nov is still to come)
  const total = MONTHS.length * HIST;
  countMoney(histEl, prev ? Number(histEl.dataset.c) : total, total, prev ? 380 : 0);
  histEl.dataset.c = total;
  prev = r;
}

const sayEl = root.querySelector('[data-say]');
let sayT = 0;
// one short status, spoken once the typing pauses (never a list of four amounts per keystroke)
function say(msg, wait = 900) {
  clearTimeout(sayT);
  sayT = setTimeout(() => { sayEl.textContent = msg; }, wait);
}
const sayShare = () => { const r = compute(); say(`Your share ${money(r.people.you.cents)} of ${money(r.totalCents)}.`); };
const help = root.querySelector('#rent-help');
const HELP = help.textContent;
let helpT = 0;
function flashHelp(msg) {
  help.textContent = msg;
  help.classList.add('warn');
  say(msg, 300);
  clearTimeout(helpT);
  helpT = setTimeout(() => { help.textContent = HELP; help.classList.remove('warn'); }, 2200);
}
const MAX = 1000000; // $10,000.00
function setRent(cents, fromInput = false) {
  rent = Math.max(MIN, Math.min(MAX, Math.round(cents)));
  if (!fromInput) { input.value = (rent / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); lastText = input.value; }
  fitInput();
  render();
}
// the field and the math never disagree: only a well-formed amount changes the rent;
// anything else keeps the last good rent until the field is left (then it snaps back)
const RANGE = 'Between $100 and $10,000';
const NUM = 'Numbers only'; // a letter is refused with this, never with the range message
const VALID = /^\d[\d,]*(\.\d{0,2})?$/;
input.addEventListener('beforeinput', (e) => {
  if (e.data && /[^0-9.,]/.test(e.data)) { e.preventDefault(); flashHelp(NUM); }
});
let lastText = input.value;
input.addEventListener('input', () => {
  const raw = input.value.trim();
  if (raw === '') return; // clearing to retype: the math keeps the last rent until a new one is typed
  if (!VALID.test(raw)) { input.value = lastText; flashHelp(NUM); return; } // refuse a malformed edit ("1.2.3")
  lastText = raw;
  const v = Math.round(Number(raw.replace(/,/g, '')) * 100);
  if (!Number.isFinite(v)) return;
  // out of range ("2" on the way to "2600", or one zero too many): the math waits; leaving the field clamps it
  if (v < MIN || v > MAX) return;
  setRent(v, true);
  sayShare();
});
// leaving the field (or Enter) formats it; only then is an amount outside $100 to $10,000 clamped, and it says why
let before = rent;
input.addEventListener('focus', () => { before = rent; });
function commit() {
  const v = Math.round(Number(input.value.trim().replace(/,/g, '')) * 100);
  if (input.value.trim() && Number.isFinite(v) && (v < MIN || v > MAX)) {
    setRent(v); flashHelp(RANGE);
    const r = compute(); say(`${RANGE}. Your share ${money(r.people.you.cents)} of ${money(r.totalCents)}.`, 300);
    return;
  }
  setRent(rent);
}
input.addEventListener('blur', commit);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commit(); }
  // Esc puts back the rent the field had when you came in
  else if (e.key === 'Escape') { e.preventDefault(); setRent(before); sayShare(); }
});
function bindMode() {
  const radios = [...side.querySelectorAll('[data-mode]')];
  const pick = (b, focus) => {
    mode = b.dataset.mode;
    radios.forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
    if (focus) b.focus();
    render();
  };
  radios.forEach((b) => b.addEventListener('click', () => pick(b)));
  // a radio group: one tab stop, arrow keys move and select
  radios[0].parentElement.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const k = radios.indexOf(document.activeElement);
    pick(radios[(Math.max(0, k) + d + radios.length) % radios.length], true);
  });
}
render();
return { compute };
}
