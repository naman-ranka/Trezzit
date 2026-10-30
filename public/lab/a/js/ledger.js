/* ledger.js: "Everything you spent. Alone or shared." The month card holds every receipt on this page, newest first:
 * the Green Basket receipt from the story (shared), the pharmacy run (just you), the taqueria dinner (shared) and rent &
 * bills (shared, monthly). Only your share counts, and the total is always exactly the rows shown, set at once (no
 * count-up, so a fast scroll or a screenshot never catches a total that disagrees with its rows). Edit the split above
 * and the Green Basket row, its groceries / household breakdown and the total all follow (story.js sends 'tz:share').
 * While a search is on (scenarios.js adds .is-search), the card's header and total belong to the search. */
import { $, money, reduced, onceVisible } from './util.js';

/* your share of the other three rows, from the kit's engine over each sample (verify.mjs checks these against it):
 * Corner Pharmacy $48.22 (all yours) + Taqueria Sol $27.03 of $84.87 + rent & bills $639.35 of $2,632.40 */
export const OTHER_ROWS = 4822 + 2703 + 63935;

export function initLedger() {
  const card = $('#month');
  if (!card) return;
  const total = $('#m-total', card);
  const mine = $('#m-gb-v', card);
  const cats = $('#m-gb-cats', card);
  let share = window.__tzShare ?? 3000;
  let groceries = window.__tzSplit?.groceriesCents ?? 2200;
  const searching = () => card.classList.contains('is-search');
  const paint = () => {
    mine.textContent = money(share);
    // Green Basket is groceries and household only: your share of each
    const parts = [['Groceries', groceries], ['Household', share - groceries]].filter(([, c]) => c > 0);
    cats.innerHTML = parts.length ? parts.map(([k, c]) => `<span>${k} ${money(c)}</span>`).join('<i> · </i>') : '<span>None of it yours</span>';
    if (!searching()) total.textContent = money(OTHER_ROWS + share);
  };
  // the search hands the header back: the month, exactly its rows
  card.__month = () => { $('.m-k', card).textContent = 'You spent in October'; total.textContent = money(OTHER_ROWS + share); };
  document.addEventListener('tz:share', (e) => {
    share = e.detail.cents; groceries = e.detail.groceriesCents ?? groceries; paint();
  });
  paint();
  // the receipt you split is in your month: its row is highlighted once as the card comes into view (nothing hides,
  // nothing counts; the total is already right)
  if (reduced()) return;
  const r = card.getBoundingClientRect();
  if (r.top < innerHeight && r.bottom > 0) return;
  onceVisible(card, () => {
    card.classList.add('is-landing');
    setTimeout(() => card.classList.remove('is-landing'), 1800);
  }, { threshold: 0.6 });
}
