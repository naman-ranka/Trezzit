/* home.js: lab C landing page.
 * Only the hero is eager. Each demo (and the receipts, fonts and data it needs) loads when its
 * frame comes within reach of the screen; every frame already reserves its final height (no shift). */
import { initPage } from './page.js';
import { initHero } from './hero.js';
import { onVisible } from './util.js';

initPage();
initHero(document.querySelector('[data-hero]'));

const once = (fn) => { let p = null; return () => (p ||= fn()); };
// Before the visitor does anything, a demo loads only if it is actually on screen (a tall window, a #link).
// From the first scroll, tap or key on, demos load 500px ahead, so each one is ready before it arrives.
const lazies = [];
const lazy = (id, load) => {
  const el = document.getElementById(id);
  if (!el) return;
  const go = once(() => load(el));
  lazies.push({ el, go });
  onVisible(el, go, { threshold: 0 });
};
const arm = once(() => {
  ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((t) => removeEventListener(t, arm));
  lazies.forEach(({ el, go }) => onVisible(el, go, { threshold: 0, rootMargin: '0px 0px 500px 0px' }));
});
['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((t) => addEventListener(t, arm, { passive: true }));

const splitEl = document.getElementById('split-demo');
// the scan's "Split this receipt" hands its result to the split, so the split is mounted no later than the scan
const mountSplit = once(() => import('./split-demo.js').then((m) => m.mountSplit(splitEl, { sampleId: 'green-basket', listen: true, tipToggle: true, yours: false })));
lazy('scan-demo', (el) => { mountSplit(); import('./scan-demo.js').then((m) => m.mountScan(el, { samples: ['green-basket', 'taqueria-sol', 'corner-pharmacy'], splitTarget: '#split', soloHref: 'just-me/' })); });
lazy('split-demo', () => mountSplit());
lazy('ledger-demo', (el) => import('./ledger-demo.js').then((m) => m.mountLedger(el, { compact: true, fixedHref: 'recurring/', highlight: 'pizza' })));
lazy('chat-demo', (el) => import('./chat-demo.js').then((m) => m.mountChat(el)));
if (scrollY > 0) arm();
