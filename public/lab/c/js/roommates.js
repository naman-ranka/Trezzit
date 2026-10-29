/* roommates page */
import { initPage } from './page.js';
import { mountSplit } from './split-demo.js';

initPage();
mountSplit(document.getElementById('split-demo'), { sampleId: 'green-basket', expanded: true, balances: true });
