/* hero.js: the one-time intro. The bank line, then the Trezzit card with "You spent $30.00" from its first frame
 * (only the bar grows in). The paper receipt is not in the hero: its first full appearance is the scan below. */
import { $, reduced } from './util.js';

export function initHero() {
  const vis = $('#hero-visual');
  if (!vis) return;
  const root = document.documentElement;
  if (reduced() || !root.classList.contains('intro-pending')) { root.classList.remove('intro-pending'); return; }
  vis.classList.add('intro');
  root.classList.remove('intro-pending');
}
