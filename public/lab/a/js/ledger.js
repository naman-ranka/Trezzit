/* ledger.js: "One place for everything you spend". The month card holds rent (monthly, shared), a shared market run,
 * a personal coffee and, when it comes into view, the Green Basket receipt from the story, landing as your share while
 * the month total counts up by exactly that. The total is always exactly the rows shown. Edit the split above and the
 * row, its groceries / household breakdown and the total all follow (story.js sends 'tz:share').
 * While a search is on (scenarios.js adds .is-search), the card's header and total belong to the search. */
import { $, $$, money, countTo, reduced, onceVisible, avatar, esc, ICON } from './util.js';
import { PEOPLE } from './data.js';
import { balances, ROOMMATES } from './balances.js';

const BASE = 60000 + 920 + 970; // the other three rows: rent share $600.00 + farmers market $9.20 + café $9.70 = $618.90

export function initLedger() {
  const card = $('#month');
  if (!card) return;
  const total = $('#m-total', card);
  const mine = $('#m-gb-v', card);
  const cats = $('#m-gb-cats', card);
  let share = window.__tzShare ?? 3000;
  let groceries = window.__tzSplit?.groceriesCents ?? 2200;
  let landed = false;
  const searching = () => card.classList.contains('is-search');
  const paint = () => {
    mine.textContent = money(share);
    // Green Basket is groceries and household only: your share of each
    const parts = [['Groceries', groceries], ['Household', share - groceries]].filter(([, c]) => c > 0);
    // one line on desktop; on phones each category takes its own line (a tiny itemization, never truncated)
    cats.innerHTML = parts.length ? parts.map(([k, c]) => `<span>${k} ${money(c)}</span>`).join('<i> · </i>') : '<span>None of it yours</span>';
    if (landed && !searching()) total.textContent = money(BASE + share);
  };
  // the search hands the header back: the month, exactly its rows
  card.__month = () => { $('.m-k', card).textContent = 'You spent in October'; total.textContent = money(landed ? BASE + share : BASE); };
  document.addEventListener('tz:share', (e) => { share = e.detail.cents; groceries = e.detail.groceriesCents ?? groceries; paint(); });
  const land = () => {
    landed = true;
    paint();
    if (reduced() || searching()) { card.classList.remove('is-pending'); return; }
    total.textContent = money(BASE);
    card.classList.remove('is-pending');
    card.classList.add('is-landing');
    countTo(total, BASE, BASE + share, { dur: 700 });
    setTimeout(() => card.classList.remove('is-landing'), 1800);
  };
  paint();
  initBalances();
  // already on screen (a reload mid-page, or a jump): show it landed, no replay
  const r = card.getBoundingClientRect();
  if (reduced() || (r.top < innerHeight && r.bottom > 0)) { land(); return; }
  card.classList.add('is-pending');
  total.textContent = money(BASE);
  onceVisible(card, () => setTimeout(land, 250), { threshold: 0.6 });
}

/* The balances strip: what each roommate owes you, net across this month's shared bills. "Settle up" records it
 * (no money moves, as in the app); Undo brings the balances back. Any edit to the split above starts fresh. */
function initBalances() {
  const box = $('#m-bal');
  if (!box) return;
  box.innerHTML = `
    <div class="mb-hd"><p class="mb-k">Roommates owe you <strong class="money" data-t></strong></p>
      <button type="button" class="mb-btn" aria-pressed="false">Settle up</button></div>
    <ul class="mb-people" role="list">${ROOMMATES.map((p) => `<li class="mb-p" data-p="${p}">${avatar(PEOPLE[p])}<span class="nm">${esc(PEOPLE[p].name)}</span><span class="v money"></span></li>`).join('')}</ul>
    <p class="mb-note" aria-live="polite"></p>`;
  const k = $('.mb-k', box);
  const btn = $('.mb-btn', box);
  const note = $('.mb-note', box);
  let settled = false;
  const paint = () => {
    const b = balances();
    const net = ROOMMATES.reduce((a, p) => a + b[p], 0);
    box.classList.toggle('is-settled', settled);
    k.innerHTML = settled ? 'All settled' : net >= 0 ? `Roommates owe you <strong class="money">${money(net)}</strong>` : `You owe roommates <strong class="money">${money(-net)}</strong>`;
    $$('.mb-p', box).forEach((li) => {
      const c = b[li.dataset.p];
      const v = $('.v', li);
      li.classList.toggle('is-neg', !settled && c < 0);
      v.innerHTML = settled ? `${ICON.check}<span class="visually-hidden">settled</span>` : c < 0 ? `<small>you owe</small>${money(-c)}` : money(c);
    });
    btn.textContent = settled ? 'Undo' : 'Settle up';
    btn.setAttribute('aria-pressed', String(settled));
    btn.disabled = !settled && ROOMMATES.every((p) => b[p] === 0);
  };
  btn.addEventListener('click', () => {
    settled = !settled;
    note.textContent = settled ? 'Recorded. No money moved.' : '';
    paint();
  });
  document.addEventListener('tz:share', () => { settled = false; note.textContent = ''; paint(); });
  paint();
}
