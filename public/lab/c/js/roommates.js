/* roommates page: the rent demo leads (home already plays the grocery split), beside one running
 * balance for the apartment. The balance is computed live from the rent card, plus this month's
 * groceries (home's default split, from the kit engine), Netflix and pizza night: per person, from your side. */
import { initPage } from './page.js';
import { mountRent } from './rent-demo.js';
import { distributeEqually } from '../../_kit/split-engine.js';
import { PEOPLE, getSample, sampleBill } from './data.js';
import { splitSample } from '../../_kit/receipts.js';
import { money, countMoney } from './util.js';

initPage();

const ROOM = ['you', 'maya', 'jordan', 'sam'];
const even = (cents) => Object.fromEntries(distributeEqually(cents, 4).map((c, i) => [ROOM[i], c]));
// the same two small bills the ledger and the AI answers use
const NETFLIX = { name: 'Netflix', payer: 'you', shares: even(2499) };
const PIZZA = { name: 'Pizza night', payer: 'jordan', shares: even(3800) };
let groc = null;
let rent = null;

const balEl = document.getElementById('bal-list');
const payerName = (p) => (p === 'you' ? 'you' : PEOPLE[p].name);
// every row opens to the 2-3 bills behind it, so the net never looks like a math slip
function renderBalance() {
  if (!groc || !rent || !balEl) return;
  const bills = [groc, rent, NETFLIX, PIZZA];
  const first = !balEl.children.length;
  ['maya', 'jordan', 'sam'].forEach((p) => {
    // what p owes you: their share of what you paid, less your share of what they paid
    const parts = bills.map((b) => ({ b, c: b.payer === 'you' ? b.shares[p] || 0 : b.payer === p ? -(b.shares.you || 0) : 0 })).filter((x) => x.c);
    const v = parts.reduce((a, x) => a + x.c, 0);
    let li = balEl.querySelector(`[data-p="${p}"]`);
    if (!li) {
      li = document.createElement('li');
      li.dataset.p = p;
      li.innerHTML = `<button type="button" class="bal-row" aria-expanded="false" aria-controls="bal-why-${p}"><span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${PEOPLE[p].name[0]}</span><span class="bal-w"></span><b class="money"></b><span class="bal-chev" aria-hidden="true"></span></button><ul class="bal-why" id="bal-why-${p}" role="list" hidden></ul>`;
      const btn = li.querySelector('.bal-row');
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        li.querySelector('.bal-why').hidden = !open;
      });
      balEl.appendChild(li);
    }
    li.querySelector('.bal-w').textContent = v < 0 ? `You owe ${PEOPLE[p].name}` : v > 0 ? `${PEOPLE[p].name} owes you` : `${PEOPLE[p].name} and you are even`;
    li.className = v < 0 ? 'neg' : v > 0 ? 'pos' : '';
    li.querySelector('.bal-why').innerHTML = parts.map(({ b, c }) => `<li><span><b>${b.name}</b> <small>${payerName(b.payer) === 'you' ? 'you paid' : `${payerName(b.payer)} paid`} · ${c > 0 ? `${PEOPLE[p].name}’s share` : 'your share'}</small></span><span class="money">${c > 0 ? '+' : '−'}${money(Math.abs(c))}</span></li>`).join('');
    const b = li.querySelector('.bal-row > b');
    const to = Math.abs(v);
    countMoney(b, first ? to : Number(b.dataset.c || to), to, first ? 0 : 380);
    b.dataset.c = to;
  });
}

// the Green Basket run as home splits it by default (you paid; the same $30 / $30 / $20 / $20)
sampleBill('green-basket').then(({ bill }) => {
  const r = splitSample(getSample('green-basket'), bill);
  groc = { name: 'Groceries', payer: 'you', shares: Object.fromEntries(ROOM.map((p) => [p, r.people[p]?.cents || 0])) };
  renderBalance();
});
mountRent(document.getElementById('rent-demo'), {
  compact: true,
  onChange: (r) => {
    rent = { name: 'Rent and bills', payer: 'maya', shares: Object.fromEntries(ROOM.map((p) => [p, r.people[p]?.cents || 0])) };
    renderBalance();
  },
});
