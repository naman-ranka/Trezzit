/* split-page.js: /split. The page explains splitting by item and shows it on sample receipts (E's scan frame
 * handing off to the tap grid); the splitting itself happens in the app's /split, where every "Split a bill"
 * button goes. On a Vercel preview of this site those buttons go to the staging app. */
import { initPage } from './page.js';
import { css } from './util.js';
import { APP } from '../../_kit/scan-client.js';

initPage();
document.querySelectorAll('a[data-app-split]').forEach((a) => { a.href = `${APP}/split`; });

const gridEl = document.getElementById('split-demo');
Promise.all([import('./grid-demo.js'), css('grid')]).then(([m]) => m.mountGrid(gridEl, {
  sampleId: 'taqueria-sol', listen: true, summary: true, tipToggle: true,
}));
const scanEl = document.getElementById('scan-demo');
Promise.all([import('./scan-demo.js'), css('scan')]).then(([m]) => m.mountScan(scanEl, {
  samples: ['taqueria-sol', 'green-basket'], names: { 'taqueria-sol': 'Dinner', 'green-basket': 'Groceries' }, kinds: false, own: false,
  cats: false, fromTop: true, threshold: 0.4, splitTarget: '#split-demo',
}));
