/* scan-page.js: /lab/a/scan/. Scan a receipt; the result drops straight into the split.
 * ?r=<sample id> (or ?r=live, from the landing page's own scan) picks the receipt to start with.
 * Arriving with #split (the landing's "Split it yourself"): the scan renders finished, at once,
 * and the page opens on step 2 after everything above it has its final height. */
import { $ } from './util.js';
import { mountScan } from './scan-demo.js';
import { mountSplit } from './split-play.js';
import { SAMPLES, modelFrom } from './data.js';

const want = new URLSearchParams(location.search).get('r');
const arriving = !!want && location.hash === '#split';
if (arriving && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
let liveModel = null;
if (want === 'live') {
  try { const v = JSON.parse(sessionStorage.getItem('tz-a-live') || 'null'); if (v?.bill) liveModel = modelFrom({ source: 'live', raw: v.raw, bill: v.bill }); } catch { /* fall back to a sample */ }
}
const start = SAMPLES.some((s) => s.id === want) ? want : 'green-basket';

const play = mountSplit($('#play-root'), { initial: liveModel || start });
const scanner = mountScan($('#scan-demo'), {
  splitLabel: 'Split it',
  autoStart: false,
  onResult(model) { play.load(model.source === 'live' ? model : model.id); },
  onSplit() {
    $('#split').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  },
});
const scanned = liveModel ? Promise.resolve() : scanner.run(start, { instant: arriving });
if (arriving) {
  Promise.all([play.ready, scanned]).then(() => requestAnimationFrame(() => $('#split').scrollIntoView()));
}
