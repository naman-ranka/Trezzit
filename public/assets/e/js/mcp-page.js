/* mcp-page.js: /mcp. E's AI hero: one exchange in the chat demo, then the setup guide. */
import { initPage } from './page.js';
import { css } from './util.js';
import { mountChat } from './chat-demo.js';

initPage();
css('chat').then(() => mountChat(document.getElementById('chat-demo'), { scripts: ['split'], tools: false }));
