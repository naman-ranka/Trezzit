// Prototype D boot.
import { initChrome } from './chrome.js';
import { initChats } from './chat.js';
import { initScan } from './scan-demo.js';
import { initSplit } from './split-demo.js';
import { initLedger } from './stories.js';

initChrome();
initChats().catch((e) => console.error(e));
const split = await initSplit().catch((e) => { console.error(e); return null; });
initScan((id) => split?.show(id));
initLedger();
