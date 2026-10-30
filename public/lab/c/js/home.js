/* home.js: lab C landing page.
 * Only the hero is eager. Each demo (and the receipts, fonts and data it needs) loads when its
 * frame comes within reach of the screen; every frame already reserves its final height (no shift). */
import { initPage } from './page.js';
import { initHero } from './hero.js';
import { onVisible } from './util.js';

initPage();
initHero(document.querySelector('[data-hero]'));

// latches on the first call even when fn returns nothing (a block-bodied loader used to run twice)
const once = (fn) => { let done = false; let p; return () => { if (!done) { done = true; p = fn(); } return p; }; };
// Before the visitor does anything, a demo loads only if it is actually on screen (a tall window, a #link).
// From the first scroll, tap or key on, demos load 500px ahead, so each one is ready before it arrives.
const lazies = [];
const lazy = (id, load) => {
  const el = document.getElementById(id);
  if (!el) return;
  const go = once(() => { if (el.dataset.mounted) return undefined; el.dataset.mounted = '1'; return load(el); });
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
// home keeps to the apartment story: the shared groceries and one receipt that is just yours (no strangers in the split)
// a receipt that is just yours: "See your share" goes to step 3 with "You paid alone" open and that receipt lit
const sortSolo = () => {
  const l = lazies.find((x) => x.el.id === 'ledger-demo');
  Promise.resolve(l?.go()).then((api) => {
    api?.setPay('alone', 'corner-pharmacy');
    document.getElementById('understand')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
};
lazy('scan-demo', (el) => { mountSplit(); return import('./scan-demo.js').then((m) => m.mountScan(el, { samples: ['green-basket', 'corner-pharmacy'], splitTarget: '#split', onSolo: sortSolo })); });
lazy('split-demo', () => mountSplit());
lazy('ledger-demo', (el) => import('./ledger-demo.js').then((m) => m.mountLedger(el, { compact: true, byPayer: true, rentHref: 'roommates/#rent' })));
lazy('chat-demo', (el) => import('./chat-demo.js').then((m) => m.mountChat(el)));
// keyboard visitors tab faster than the lazy loaders can see: on the first Tab (or focus inside a section), mount everything
const mountAll = once(() => lazies.forEach(({ go }) => go()));
addEventListener('keydown', (e) => { if (e.key === 'Tab') mountAll(); });
document.querySelectorAll('#how, #ai').forEach((s) => s.addEventListener('focusin', mountAll));
if (scrollY > 0) arm();
