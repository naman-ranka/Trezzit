/* home.js: lab C landing page. */
import { initPage } from './page.js';
import { initHero } from './hero.js';
import { mountScan } from './scan-demo.js';
import { mountSplit } from './split-demo.js';
import { mountLedger } from './ledger-demo.js';
import { mountChat } from './chat-demo.js';

initPage();
initHero(document.querySelector('[data-hero]'));
mountScan(document.getElementById('scan-demo'), { splitTarget: '#split' });
mountSplit(document.getElementById('split-demo'), { sampleId: 'green-basket', listen: true, tipToggle: true, yours: false });
mountLedger(document.getElementById('ledger-demo'), { compact: true });
mountChat(document.getElementById('chat-demo'));
