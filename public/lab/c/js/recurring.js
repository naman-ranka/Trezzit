/* recurring page: what's coming up, the rent history, and where to change the split (roommates). */
import { initPage } from './page.js';
import { mountRent } from './rent-demo.js';

initPage();
// the rent editor lives on /roommates; here it only feeds the figures (a detached root, never shown)
mountRent(document.createElement('div'), { sideRoot: document.getElementById('rec-side'), moreHref: '../roommates/#rent-t' });
