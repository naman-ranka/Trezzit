/* /trips: the taqueria split with a tip toggle (hero), then the whole weekend settled. The settle-up is the app's
 * Simplified debt view (a group setting, off by default): the same greedy pass over each person's net as the
 * backend's GroupBalanceService._generate_simplified_pairwise_structure, so its rows are what the app would show. */
import { initPage } from './page.js';
import { APP } from '../../_kit/scan-client.js';
import { mountGrid } from './grid-demo.js';
import { splitAmount } from '../../_kit/split-engine.js';
import { splitSample } from '../../_kit/receipts.js';
import { PEOPLE, getSample, sampleBill } from './data.js';
import { money, countMoney, esc, YOU_GLYPH } from './util.js';

initPage();
// "Split a bill, no account" opens the app's /split (the staging app on a preview of this site)
document.querySelectorAll('a[data-app-split]').forEach((a) => { a.href = `${APP}/split`; });
const TRIO = ['you', 'alex', 'priya'];
// the same tap grid as home (one way to say who had what), with the tip control above it. Every tap or tip flip feeds the weekend below, so the two demos never disagree.
let taqLive = null;
let setTaq = null;
mountGrid(document.getElementById('split-demo'), {
  sampleId: 'taqueria-sol', payer: 'alex', tipToggle: true,
  onChange: (r, st) => {
    taqLive = { shares: Object.fromEntries(TRIO.map((p) => [p, r.people[p]?.cents || 0])), note: st.tipMode === 'equal' ? 'By item, tip equally' : 'By item, tip in proportion' };
    setTaq?.(taqLive);
  },
});

const av = (p) => `<span class="av av-sm" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? YOU_GLYPH : PEOPLE[p].name[0]}</span>`;
const who = (p) => (p === 'you' ? 'You' : PEOPLE[p].name);

async function tripDemo(root) {
  const { bill } = await sampleBill('taqueria-sol');
  const taq = splitSample(getSample('taqueria-sol'), bill);
  const eqShares = (c) => splitAmount(c, { type: 'equal', people: TRIO }, TRIO).shares;
  const bills = [
    { id: 'cabin', title: 'Cabin, two nights', payer: 'alex', cents: 48000, shares: eqShares(48000), note: 'Split 3 ways' },
    { id: 'taq', title: 'Taqueria Sol', payer: 'alex', cents: taq.totalCents, shares: Object.fromEntries(TRIO.map((p) => [p, taq.people[p].cents])), note: 'By item, tip in proportion' },
    { id: 'gas', title: 'Gas', payer: 'priya', cents: 6240, shares: eqShares(6240), note: 'Split 3 ways' },
    { id: 'food', title: 'Cabin groceries', payer: 'you', cents: 5730, shares: eqShares(5730), note: 'Split 3 ways' },
  ];
  const on = new Set(bills.map((b) => b.id));

  root.innerHTML = `<div class="trip">
    <p class="trip-h">Weekend at the lake <span>you, Alex and Priya</span></p>
    <div>
      <ul class="trip-bills" role="list">${bills.map((b) => `<li>
        <label class="tb-on"><input type="checkbox" checked data-id="${b.id}"><span class="visually-hidden">Include ${esc(b.title)}</span><span class="tick" aria-hidden="true"></span></label>
        <span><b>${esc(b.title)}</b><small>${who(b.payer)} paid · <span data-note="${b.id}">${b.note}</span></small></span>
        <b class="money">${money(b.cents)}</b></li>`).join('')}</ul>
    </div>
    <div class="trip-side">
      <div class="trip-you">
        <p><span>You paid</span><b class="money" data-k="paid"></b></p>
        <p><span>You spent</span><b class="money" data-k="spent"></b></p>
      </div>
      <div class="settle">
        <h3>Settle up <span class="settle-tag">Simplified</span></h3>
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
    // the settle-up rows say it; the note line only speaks up when a tap is refused
    noteEl.textContent = noteEl.dataset.txt = '';
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
  const taqBill = bills.find((b) => b.id === 'taq');
  setTaq = ({ shares, note }) => {
    taqBill.shares = shares;
    taqBill.note = note;
    root.querySelector('[data-note="taq"]').textContent = note;
    render(false);
  };
  if (taqLive) setTaq(taqLive);
}
tripDemo(document.getElementById('trip-demo'));
