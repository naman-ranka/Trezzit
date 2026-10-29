/* trips page: the taqueria split with a tip toggle, and a whole weekend settled */
import { initPage } from './page.js';
import { mountSplit } from './split-demo.js';
import { splitAmount } from '../../_kit/split-engine.js';
import { splitSample } from '../../_kit/receipts.js';
import { PEOPLE, getSample, sampleBill } from './data.js';
import { money, countMoney, esc } from './util.js';

initPage();
// collapsed like home (3 lines + "Show all 7 items"), so the tip and who owes whom are in the first screen
mountSplit(document.getElementById('split-demo'), { sampleId: 'taqueria-sol', tipToggle: true, balances: true, yours: false });

const TRIO = ['you', 'alex', 'priya'];
const av = (p) => `<span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? 'You' : PEOPLE[p].name[0]}</span>`;
const who = (p) => (p === 'you' ? 'You' : PEOPLE[p].name);

async function tripDemo(root) {
  const { bill } = await sampleBill('taqueria-sol');
  const taq = splitSample(getSample('taqueria-sol'), bill);
  const eqShares = (c) => splitAmount(c, { type: 'equal', people: TRIO }, TRIO).shares;
  const bills = [
    { id: 'cabin', title: 'Cabin, two nights', payer: 'alex', cents: 48000, shares: eqShares(48000), note: 'Split 3 ways' },
    { id: 'taq', title: 'Taqueria Sol', payer: 'you', cents: taq.totalCents, shares: Object.fromEntries(TRIO.map((p) => [p, taq.people[p].cents])), note: 'By item, tip in proportion' },
    { id: 'gas', title: 'Gas', payer: 'priya', cents: 6240, shares: eqShares(6240), note: 'Split 3 ways' },
    { id: 'food', title: 'Cabin groceries', payer: 'you', cents: 5730, shares: eqShares(5730), note: 'Split 3 ways' },
  ];
  const on = new Set(bills.map((b) => b.id));

  root.innerHTML = `<div class="trip">
    <p class="trip-h">Weekend at the lake <span>you, Alex and Priya</span></p>
    <div class="trip-you">
      <p><span>You paid</span><b class="money" data-k="paid"></b></p>
      <p><span>You spent</span><b class="money" data-k="spent"></b></p>
    </div>
    <div>
      <ul class="trip-bills" role="list">${bills.map((b) => `<li>
        <label class="tb-on"><input type="checkbox" checked data-id="${b.id}"><span class="visually-hidden">Include ${esc(b.title)}</span><span class="tick" aria-hidden="true"></span></label>
        <span><b>${esc(b.title)}</b><small>${who(b.payer)} paid · ${b.note}</small></span>
        <b class="money">${money(b.cents)}</b></li>`).join('')}</ul>
    </div>
    <div class="trip-side">
      <div class="settle">
        <h3>Settle up</h3>
        <ul role="list" aria-live="polite"></ul>
        <p class="settle-n"></p>
      </div>
    </div>
  </div>`;
  const ul = root.querySelector('.settle ul');
  const paidEl = root.querySelector('[data-k="paid"]');
  const spentEl = root.querySelector('[data-k="spent"]');

  function render(first) {
    const net = Object.fromEntries(TRIO.map((p) => [p, 0]));
    let paid = 0; let spent = 0;
    bills.filter((b) => on.has(b.id)).forEach((b) => {
      net[b.payer] += b.cents;
      if (b.payer === 'you') paid += b.cents;
      TRIO.forEach((p) => { net[p] -= b.shares[p] || 0; });
      spent += b.shares.you || 0;
    });
    // greedy: biggest debtor pays biggest creditor
    const debt = TRIO.filter((p) => net[p] < 0).map((p) => ({ p, c: -net[p] })).sort((a, b) => b.c - a.c);
    const cred = TRIO.filter((p) => net[p] > 0).map((p) => ({ p, c: net[p] })).sort((a, b) => b.c - a.c);
    const pays = [];
    while (debt.length && cred.length) {
      const d = debt[0]; const c = cred[0]; const x = Math.min(d.c, c.c);
      pays.push({ from: d.p, to: c.p, c: x });
      d.c -= x; c.c -= x;
      if (!d.c) debt.shift();
      if (!c.c) cred.shift();
    }
    // at least one bill always stays ticked, so there is always someone to pay
    ul.innerHTML = pays.map((x) => `<li>${av(x.from)}<span>${who(x.from)} ${x.from === 'you' ? 'pay' : 'pays'} ${x.to === 'you' ? 'you' : who(x.to)}</span><b class="money">${money(x.c)}</b></li>`).join('');
    noteEl.textContent = noteEl.dataset.txt = `${pays.length} ${pays.length === 1 ? 'payment settles' : 'payments settle'} ${on.size === 1 ? 'this bill' : on.size === 2 ? 'both bills' : `all ${on.size} bills`}.`;
    // the last ticked bill can't be unticked (the split's "someone has to pay" rule)
    root.querySelectorAll('input[type=checkbox]').forEach((x) => {
      if (on.size === 1 && x.checked) x.setAttribute('aria-disabled', 'true'); else x.removeAttribute('aria-disabled');
    });
    const prevPaid = first ? paid : (Number(paidEl.dataset.c) || 0);
    const prevSpent = first ? spent : (Number(spentEl.dataset.c) || 0);
    paidEl.dataset.c = paid; spentEl.dataset.c = spent;
    countMoney(paidEl, prevPaid, paid, first ? 0 : 400);
    countMoney(spentEl, prevSpent, spent, first ? 0 : 400);
  }
  const noteEl = root.querySelector('.settle-n');
  let noteT = 0;
  root.querySelectorAll('input[type=checkbox]').forEach((cb) => cb.addEventListener('change', () => {
    if (!cb.checked && on.size === 1) {
      cb.checked = true;
      const li = cb.closest('li');
      li.classList.remove('nope'); void li.offsetWidth; li.classList.add('nope');
      noteEl.textContent = 'Keep at least one bill.';
      noteEl.classList.add('warn');
      clearTimeout(noteT);
      noteT = setTimeout(() => { noteEl.textContent = noteEl.dataset.txt; noteEl.classList.remove('warn'); }, 1500);
      return;
    }
    if (cb.checked) on.add(cb.dataset.id); else on.delete(cb.dataset.id);
    cb.closest('li').classList.toggle('off', !cb.checked);
    render(false);
  }));
  render(true);
}
tripDemo(document.getElementById('trip-demo'));
