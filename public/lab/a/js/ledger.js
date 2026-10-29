/* ledger.js: "One place for everything you spend". The month card holds a personal bill, a monthly one and a shared
 * one; when it comes into view, the Green Basket receipt from the story lands in it as your share, and the month total
 * counts up by exactly that. Edit the split above and both change (story.js sends 'tz:share'). */
import { $, money, countTo, reduced, onceVisible } from './util.js';

const BASE = 122326; // the month before this receipt: $1,223.26 over 25 expenses (all made up, like the receipts)
const COUNT = 25;

export function initLedger() {
  const card = $('#month');
  if (!card) return;
  const total = $('#m-total', card);
  const count = $('#m-count', card);
  const mine = $('#m-gb-v', card);
  let share = window.__tzShare ?? 3000;
  let landed = false;
  const paint = () => {
    mine.textContent = money(share);
    if (landed) { total.textContent = money(BASE + share); count.textContent = String(COUNT + 1); }
  };
  document.addEventListener('tz:share', (e) => { share = e.detail.cents; paint(); });
  const land = () => {
    landed = true;
    paint();
    if (reduced()) { card.classList.remove('is-pending'); return; }
    total.textContent = money(BASE);
    card.classList.remove('is-pending');
    card.classList.add('is-landing');
    countTo(total, BASE, BASE + share, { dur: 700 });
    setTimeout(() => card.classList.remove('is-landing'), 1800);
  };
  // already on screen (a reload mid-page, or a jump): show it landed, no replay
  const r = card.getBoundingClientRect();
  if (reduced() || (r.top < innerHeight && r.bottom > 0)) { land(); return; }
  card.classList.add('is-pending');
  total.textContent = money(BASE);
  count.textContent = String(COUNT);
  onceVisible(card, () => setTimeout(land, 250), { threshold: 0.6 });
}
