/* AI page */
import { initPage } from './page.js';
import { mountChat } from './chat-demo.js';

initPage();
mountChat(document.getElementById('chat-demo'), { scripts: ['split', 'groceries', 'statement', 'rent', 'owe', 'settle'] });
