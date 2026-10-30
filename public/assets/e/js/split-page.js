/* split-page.js: /split. Step 1 is E's scan frame (a recorded sample, or your photo: scanned for real on
 * trezzit.com after the Gemini disclosure); whatever it reads lands in the split tool below. */
import { initPage } from './page.js';
import { css } from './util.js';
import { sampleBill } from './data.js';
import { mountSplitTool } from './split-tool.js';

initPage();
const tool = mountSplitTool(document.getElementById('split-tool'));
// the tool starts on the dinner the scan reads first, so the totals are there before the scan plays
sampleBill('taqueria-sol').then(({ raw, bill }) => tool.load({ sampleId: 'taqueria-sol', raw, bill }));
// a receipt the visitor picks replaces the tool's bill; the scan that plays by itself never overwrites their edits
const scanEl = document.getElementById('scan-demo');
let picked = false;
scanEl.addEventListener('click', (e) => { if (e.target.closest('.pick, .so-again, .scan-stage')) picked = true; });
scanEl.addEventListener('change', () => { picked = true; });
Promise.all([import('./scan-demo.js'), css('scan')]).then(([m]) => m.mountScan(scanEl, {
  samples: ['taqueria-sol', 'green-basket'], names: { 'taqueria-sol': 'Dinner', 'green-basket': 'Groceries' }, kinds: false, own: 'always',
  cats: false, fromTop: true, threshold: 0.4, splitTarget: '#split-tool',
  onDone: (result) => { tool.load(result, { user: picked }); picked = false; },
}));
