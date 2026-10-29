/* recurring page */
import { initPage } from './page.js';
import { mountRent } from './rent-demo.js';

initPage();
mountRent(document.getElementById('rec-demo'), { sideRoot: document.getElementById('rec-side') });
