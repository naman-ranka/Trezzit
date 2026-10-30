/* just-me page: scan a receipt that is just yours; the read folds straight into your categories
 * (one bar, four amounts, one check), then the month. Home step 1 already shows the item-by-item read. */
import { initPage } from './page.js';
import { mountScan } from './scan-demo.js';
import { mountMonth } from './month-demo.js';

initPage();
mountScan(document.getElementById('scan-demo'), {
  samples: ['corner-pharmacy'], // a page called "Just yours" scans one receipt that is just yours: no tile row
  initial: 'corner-pharmacy',
  total: false, // the check under the categories says the total ("Adds up to $48.22")
});
// the same month as home (bank vs what you spent, who paid, item search), searching for a pharmacy item
mountMonth(document.getElementById('ledger-demo'), { demoSearch: 'sunscreen' });
