/* /roommates: the rent card leads; one running balance for the apartment follows the groceries grid.
 * The balance is computed live from the rent card, plus this month's
 * groceries (the grid's current split, from the kit engine) and Netflix: per person, from your side.
 * Same October as home: you pay the rent and the groceries, Maya pays Netflix. */
import { initPage } from './page.js';
import { mountRent } from './rent-demo.js';
import { distributeEqually } from '../../_kit/split-engine.js';
import { PEOPLE, getSample, sampleBill } from './data.js';
import { splitSample } from '../../_kit/receipts.js';
import { money, countMoney, css, onVisible } from './util.js';

initPage();

// the grocery grid further down mounts as it nears the screen (its frame reserves its height)
const gridEl = document.getElementById('rm-grid');
if (gridEl) onVisible(gridEl, () => Promise.all([import('./grid-demo.js'), css('grid')]).then(([m]) => m.mountGrid(gridEl, { sampleId: 'green-basket', summary: true, taxHint: false, onChange: (res) => setGroc(res) })), { threshold: 0, rootMargin: '0px 0px 400px 0px' });

const ROOM = ['you', 'maya', 'jordan', 'sam'];
const even = (cents) => Object.fromEntries(distributeEqually(cents, 4).map((c, i) => [ROOM[i], c]));
// the same two small bills the ledger and the AI answers use
const NETFLIX = { name: 'Netflix', payer: 'maya', shares: even(1799) };
let groc = null;
let rent = null;

const balEl = document.getElementById('bal-list');
const payerName = (p) => (p === 'you' ? 'you' : PEOPLE[p].name);
// every row opens to the 2-3 bills behind it, so the net never looks like a math slip
function renderBalance() {
  if (!groc || !rent || !balEl) return;
  const bills = [rent, groc, NETFLIX];
  const first = !balEl.dataset.live;
  balEl.dataset.live = '1';
  ['maya', 'jordan', 'sam'].forEach((p) => {
    // what p owes you: their share of what you paid, less your share of what they paid
    const parts = bills.map((b) => ({ b, c: b.payer === 'you' ? b.shares[p] || 0 : b.payer === p ? -(b.shares.you || 0) : 0 })).filter((x) => x.c);
    const v = parts.reduce((a, x) => a + x.c, 0);
    // the rows are in the HTML (their first figures included), so nothing moves when this runs; bind them once
    let li = balEl.querySelector(`[data-p="${p}"]`);
    if (!li) {
      li = document.createElement('li');
      li.dataset.p = p;
      li.innerHTML = `<button type="button" class="bal-row" aria-expanded="false" aria-controls="bal-why-${p}"><span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${PEOPLE[p].name[0]}</span><span class="bal-w"></span><b class="money"></b><span class="bal-chev" aria-hidden="true"></span></button><ul class="bal-why" id="bal-why-${p}" role="list" hidden></ul>`;
      balEl.appendChild(li);
    }
    if (!li.dataset.bound) {
      li.dataset.bound = '1';
      const btn = li.querySelector('.bal-row');
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        li.querySelector('.bal-why').hidden = !open;
      });
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
// the groceries line follows the grid below: every tap there re-splits the run, and the balance moves with it
function setGroc(r) {
  groc = { name: 'Groceries', payer: 'you', shares: Object.fromEntries(ROOM.map((p) => [p, r.people[p]?.cents || 0])) };
  renderBalance();
}
// until the grid mounts, the run as home splits it by default (the same $30 / $30 / $20 / $20)
sampleBill('green-basket').then(({ bill }) => { if (!groc) setGroc(splitSample(getSample('green-basket'), bill)); });
mountRent(document.getElementById('rent-demo'), {
  compact: true,
  onChange: (r) => {
    rent = { name: 'Rent and bills', payer: 'you', shares: Object.fromEntries(ROOM.map((p) => [p, r.people[p]?.cents || 0])) };
    renderBalance();
  },
});
