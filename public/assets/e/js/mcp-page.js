/* mcp-page.js: /mcp. E's AI hero: one exchange in the chat demo, then the setup guide. */
import { initPage } from './page.js';
import { css } from './util.js';
import { mountChat } from './chat-demo.js';

initPage();
css('chat').then(() => mountChat(document.getElementById('chat-demo'), { scripts: ['split'], tools: false }));

// "The details" are folded: a link to one of them (/mcp#privacy, /mcp#tools) opens it.
const openHash = () => {
  const el = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView(); }
};
openHash();
addEventListener('hashchange', openHash);
