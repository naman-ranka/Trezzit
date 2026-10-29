// Prototype D boot.
import { initChrome } from './chrome.js';
import { initChats } from './chat.js';
import { initSplit } from './split-demo.js';
import { initLedger } from './stories.js';

initChrome();
initChats().catch((e) => { console.error(e); document.getElementById('hero-chat')?.classList.remove('intro-pending'); });
await initSplit().catch((e) => { console.error(e); return null; });
initLedger();
