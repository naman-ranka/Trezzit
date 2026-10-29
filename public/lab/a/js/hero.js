/* hero.js: the one-time intro. Paper receipt, bank line, then "You spent" counts $100.00 down to $30.00. */
import { loadScan, receiptHTML, getSample } from '../../_kit/receipts.js';
import { $, countTo, reduced, sleep, paper } from './util.js';

export async function initHero() {
  const vis = $('#hero-visual');
  const slot = $('#hv-receipt');
  const val = $('#hv-spent-v');
  if (!vis) return;
  const desktop = matchMedia('(min-width: 1000px)').matches;
  if (desktop) {
    try {
      const raw = await loadScan('green-basket');
      slot.innerHTML = paper(receiptHTML(raw, { sample: getSample('green-basket') }));
    } catch { /* the cards carry the story without the paper */ }
  }
  const root = document.documentElement;
  if (reduced() || !root.classList.contains('intro-pending')) { root.classList.remove('intro-pending'); return; }
  val.textContent = '$100.00';
  vis.classList.add('intro');
  root.classList.remove('intro-pending');
  await sleep(1150);
  await countTo(val, 10000, 3000, { dur: 1000 });
}
