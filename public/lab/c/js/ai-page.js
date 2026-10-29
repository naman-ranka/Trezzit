/* AI page */
import { initPage } from './page.js';
import { mountChat } from './chat-demo.js';

initPage();
mountChat(document.getElementById('chat-demo'), { scripts: ['statement', 'split', 'groceries', 'owe'] });
