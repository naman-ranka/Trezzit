/* splitwise-page.js: /splitwise-alternative. The tap grid on the $100.00 grocery run, mounted when it nears the screen. */
import { initPage } from './page.js';
import { css, onVisible } from './util.js';

initPage();
const el = document.getElementById('sw-grid');
onVisible(el, () => Promise.all([import('./grid-demo.js'), css('grid')]).then(([m]) => m.mountGrid(el, { sampleId: 'green-basket', summary: true, taxHint: false })), { threshold: 0, rootMargin: '0px 0px 400px 0px' });
