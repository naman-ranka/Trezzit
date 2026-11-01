/* /recurring: what's coming up leads (the hero), with the rent's mode switch (Auto / Remind me, the app's words);
 * the rent card further down is the same series' template: change the rent there and the months to come follow. */
import { initPage } from './page.js';
import { mountRent } from './rent-demo.js';

initPage();
mountRent(document.getElementById('rec-demo'), { sideRoot: document.getElementById('rec-side') });
