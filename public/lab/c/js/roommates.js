/* roommates page: the grocery split, then the rent, then one running balance for the apartment.
 * The balance is computed live from both demos (plus this month's Netflix and pizza night),
 * the way a roommate reads it: per person, netted, from your side. */
import { initPage } from './page.js';
import { mountSplit } from './split-demo.js';
import { mountRent } from './rent-demo.js';
import { distributeEqually } from '../../_kit/split-engine.js';
import { PEOPLE } from './data.js';
import { money, countMoney } from './util.js';

initPage();

const ROOM = ['you', 'maya', 'jordan', 'sam'];
const even = (cents) => Object.fromEntries(distributeEqually(cents, 4).map((c, i) => [ROOM[i], c]));
// the same two small bills the ledger and the AI answers use
const NETFLIX = { payer: 'you', shares: even(2499) };
const PIZZA = { payer: 'jordan', shares: even(3800) };
let groc = null;
let rent = null;

const balEl = document.getElementById('bal-list');
function renderBalance() {
  if (!groc || !rent || !balEl) return;
  const bills = [groc, rent, NETFLIX, PIZZA];
  const first = !balEl.children.length;
  ['maya', 'jordan', 'sam'].forEach((p) => {
    // what p owes you: their share of what you paid, less your share of what they paid
    const v = bills.reduce((a, b) => a + (b.payer === 'you' ? b.shares[p] || 0 : 0) - (b.payer === p ? b.shares.you || 0 : 0), 0);
    let li = balEl.querySelector(`[data-p="${p}"]`);
    if (!li) {
      li = document.createElement('li');
      li.dataset.p = p;
      li.innerHTML = `<span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${PEOPLE[p].name[0]}</span><span class="bal-w"></span><b class="money"></b>`;
      balEl.appendChild(li);
    }
    li.querySelector('.bal-w').textContent = v < 0 ? `You owe ${PEOPLE[p].name}` : v > 0 ? `${PEOPLE[p].name} owes you` : `${PEOPLE[p].name} and you are even`;
    li.className = v < 0 ? 'neg' : v > 0 ? 'pos' : '';
    const b = li.querySelector('b');
    const to = Math.abs(v);
    countMoney(b, first ? to : Number(b.dataset.c || to), to, first ? 0 : 380);
    b.dataset.c = to;
  });
}

mountSplit(document.getElementById('split-demo'), {
  sampleId: 'green-basket', yours: false,
  onChange: (r, st) => {
    groc = { payer: st.payer, shares: Object.fromEntries(ROOM.map((p) => [p, r.people[p]?.cents || 0])) };
    renderBalance();
  },
});
mountRent(document.getElementById('rent-demo'), {
  compact: true,
  onChange: (r) => {
    rent = { payer: 'maya', shares: Object.fromEntries(ROOM.map((p) => [p, r.people[p]?.cents || 0])) };
    renderBalance();
  },
});
