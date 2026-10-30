// Prototype D boot.
import { initChrome } from './chrome.js';
import { initChats } from './chat.js';
import { initSplit } from './split-demo.js';
import { initLedger } from './stories.js';

initChrome();
initChats().catch((e) => console.error(e));
await initSplit().catch((e) => { console.error(e); return null; });
initLedger();
