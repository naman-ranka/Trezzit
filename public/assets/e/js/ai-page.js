/* AI page */
import { initPage } from './page.js';
import { mountChat } from './chat-demo.js';

initPage();
// one exchange, no prompt chips and no tool lines: the draft and the saved total are the proof
mountChat(document.getElementById('chat-demo'), { scripts: ['split'], tools: false });
