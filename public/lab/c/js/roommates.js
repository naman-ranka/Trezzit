/* roommates page: the grocery split, then the rent */
import { initPage } from './page.js';
import { mountSplit } from './split-demo.js';
import { mountRent } from './rent-demo.js';

initPage();
mountSplit(document.getElementById('split-demo'), { sampleId: 'green-basket', balances: true, yours: false });
mountRent(document.getElementById('rent-demo'), { compact: true });
