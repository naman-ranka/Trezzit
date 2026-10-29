/* hero.js: the one-time intro. Paper receipt, bank line, then the Trezzit card with "You spent $30.00"
 * from its first frame (only the category bar and the "owe you" line animate in). */
import { loadScan, receiptHTML, getSample } from '../../_kit/receipts.js';
import { $, reduced, paper } from './util.js';

export async function initHero() {
  const vis = $('#hero-visual');
  const slot = $('#hv-receipt');
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
  vis.classList.add('intro');
  root.classList.remove('intro-pending');
}
