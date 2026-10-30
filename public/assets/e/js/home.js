/* home.js: lab E landing page (C's page with the best of A, B and D).
 * Only the hero is eager. Each demo (its module, its css/demo-*.css, receipts, fonts, data) loads when its
 * frame comes within reach of the screen; every frame already reserves its final height (no shift). */
import { initPage } from './page.js';
import { initHero } from './hero.js';
import { onVisible, css } from './util.js';

initPage();
initHero(document.querySelector('[data-hero]'));

// latches on the first call even when fn returns nothing
const once = (fn) => { let done = false; let p; return () => { if (!done) { done = true; p = fn(); } return p; }; };
// Before the visitor does anything, a demo loads only if it is actually on screen (a tall window, a #link).
// From the first scroll, tap or key on, demos load 500px ahead, so each one is ready before it arrives.
const lazies = [];
const lazy = (id, load) => {
  const el = document.getElementById(id);
  if (!el) return;
  // once mounted below the screen, the frame drops its reserved height and takes its real one: nothing on
  // screen moves, and no reserved band is left empty (on screen, the reservation stays)
  const settle = () => { if (el.getBoundingClientRect().top > innerHeight) el.style.minHeight = '0px'; };
  const go = once(() => { if (el.dataset.mounted) return undefined; el.dataset.mounted = '1'; return Promise.resolve(load(el)).then(settle); });
  lazies.push({ el, go });
  onVisible(el, go, { threshold: 0 });
};
const arm = once(() => {
  ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((t) => removeEventListener(t, arm));
  lazies.forEach(({ el, go }) => onVisible(el, go, { threshold: 0, rootMargin: '0px 0px 500px 0px' }));
});
['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((t) => addEventListener(t, arm, { passive: true }));

const splitEl = document.getElementById('split-demo');
// the grid mounts with the scan, so step 2 is ready by the time the scan finishes
const mountGrid = once(() => Promise.all([import('./grid-demo.js'), css('grid')]).then(([m]) => m.mountGrid(splitEl, { sampleId: 'green-basket', listen: true, summary: true, taxHint: false })));
// the AI adds a charge to the month: the month is mounted no later than the chat
const monthEl = document.getElementById('ledger-demo');
const mountMonth = once(() => Promise.all([import('./month-demo.js'), css('ledger'), css('month')]).then(([m]) => m.mountMonth(monthEl, { demoSearch: 'water', compactPayers: true, findFirst: true })));
// one receipt runs through the page: step 1 reads Green Basket (or the pharmacy, or your photo), "Split this
// receipt" hands it to step 2, and step 3 counts your share
lazy('scan-demo', (el) => { mountGrid(); return Promise.all([import('./scan-demo.js'), css('scan')]).then(([m]) => m.mountScan(el, { samples: ['green-basket', 'corner-pharmacy'], names: { 'green-basket': 'Green Basket' }, kinds: false, own: 'always', splitTarget: '#split', cats: false, fromTop: true, threshold: 0.6 })); });
lazy('split-demo', () => mountGrid());
lazy('ledger-demo', () => mountMonth());
lazy('chat-demo', (el) => { mountMonth(); return Promise.all([import('./chat-demo.js'), css('chat')]).then(([m]) => m.mountChat(el, { scripts: ['statement'], tools: false, preview: true })); });
// keyboard visitors tab faster than the lazy loaders can see: on the first Tab (or focus inside a section), mount everything
const mountAll = once(() => lazies.forEach(({ go }) => go()));
addEventListener('keydown', (e) => { if (e.key === 'Tab') mountAll(); });
document.querySelectorAll('#how, #ai').forEach((s) => s.addEventListener('focusin', mountAll));
if (scrollY > 0) arm();
