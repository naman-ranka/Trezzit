/* home.js: lab C landing page.
 * Only the hero is eager. Each demo (its module, its css/demo-*.css, receipts, fonts, data) loads when its
 * frame comes within reach of the screen; every frame already reserves its final height (no shift). */
import { initPage } from './page.js';
import { initHero } from './hero.js';
import { onVisible, css } from './util.js';

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
const mountSplit = once(() => Promise.all([import('./split-demo.js'), css('split')]).then(([m]) => m.mountSplit(splitEl, { sampleId: 'green-basket', listen: true, tipToggle: true, yours: false })));
// home keeps to the apartment story: the shared groceries and one receipt that is just yours (no strangers in the split).
// The pharmacy receipt answers in place (all yours, by category); only the shared one moves on, to the split.
lazy('scan-demo', (el) => { mountSplit(); return Promise.all([import('./scan-demo.js'), css('scan')]).then(([m]) => m.mountScan(el, { samples: ['green-basket', 'corner-pharmacy'], splitTarget: '#split', soloSummary: true })); });
lazy('split-demo', () => mountSplit());
lazy('ledger-demo', (el) => Promise.all([import('./ledger-demo.js'), css('ledger')]).then(([m]) => m.mountLedger(el, { compact: true, byPayer: true, rentHref: 'roommates/#rent', demoSearch: 'towels' })));
lazy('chat-demo', (el) => Promise.all([import('./chat-demo.js'), css('chat')]).then(([m]) => m.mountChat(el)));
// keyboard visitors tab faster than the lazy loaders can see: on the first Tab (or focus inside a section), mount everything
const mountAll = once(() => lazies.forEach(({ go }) => go()));
addEventListener('keydown', (e) => { if (e.key === 'Tab') mountAll(); });
document.querySelectorAll('#how, #ai').forEach((s) => s.addEventListener('focusin', mountAll));
if (scrollY > 0) arm();
