// "What did I actually spend in October?": the ledger, all from the computed world.
import { $, $$, esc, money, icon } from './ui.js';
import { getWorld, catOf, PEOPLE } from './world.js';

/* ---------- October ---------- */
const ICON_BG = { 'green-basket': '#047857', 'corner-pharmacy': '#dc2626', 'taqueria-sol': '#c2410c', netflix: '#9333ea', 'monthly-rent': '#0f1f3d' };
export async function initLedger() {
  const host = document.querySelector('[data-led]');
  if (!host) return;
  const w = await getWorld();
  const max = w.cats[0].cents;
  const nTop = matchMedia('(max-width: 520px)').matches ? 3 : 5;
  const top = w.cats.slice(0, nTop);
  const rest = w.cats.slice(nTop).reduce((a, c) => a + c.cents, 0);

  host.innerHTML = `<div class="panel led-list">
      <div class="toolbar" style="margin:8px 10px 4px">
        <div class="seg" role="group" aria-label="View" data-view>
          <button type="button" aria-pressed="true" data-v="trezzit">Trezzit</button>
          <button type="button" aria-pressed="false" data-v="bank">Your bank</button>
        </div>
      </div>
      <label class="search">${icon('search')}<span class="visually-hidden">Search items, stores, categories</span><input type="search" placeholder="Search any item or store" data-q autocomplete="off"></label>
      <div class="sugg" data-sugg><span class="visually-hidden">Try:</span>${['towels', 'avocados', 'sunscreen', 'groceries'].map((q) => `<button type="button" data-try="${q}">${q}</button>`).join('')}</div>
      <div data-list aria-live="polite"></div>
    </div>
    <div class="panel sum-card">
      <div class="kicker">October · your share only</div>
      <div class="paidspent"><div><span>You paid</span><b class="money">${money(w.paidCents)}</b></div><div class="sp"><span>You spent</span><b class="money">${money(w.spentCents)}</b></div></div>
      <div class="cats">${top.map((c) => `<div class="cat"><div class="l"><span>${esc(c.label)}</span><b class="money">${money(c.cents)}</b></div><div class="hbar"><i style="width:${Math.max(2, (c.cents / max) * 100)}%;background:${c.color}"></i></div></div>`).join('')}
        <div class="cat"><div class="l"><span>Everything else</span><b class="money">${money(rest)}</b></div><div class="hbar"><i style="width:${Math.max(2, (rest / max) * 100)}%;background:#94a3b8"></i></div></div></div>
    </div>`;

  const list = $('[data-list]', host);
  const q = $('[data-q]', host);
  let view = 'trezzit';
  const who = (b) => (b.payer === 'you' ? 'you paid' : `${PEOPLE[b.payer].name} paid`);

  function render() {
    const term = q.value.trim().toLowerCase();
    if (term) {
      const hits = w.items.filter((it) => [it.name, it.bill, catOf(it.category).label].some((s) => s.toLowerCase().includes(term)));
      list.innerHTML = hits.length
        ? hits.map((it) => `<div class="lrow"><span class="ic" style="background:${catOf(it.category).color}">${esc(it.name[0])}</span><span class="t"><b>${esc(it.name)}</b><span>${esc(it.bill)} · ${it.date}${it.n > 1 ? ` · split ${it.n} ways` : ''}</span></span><span class="v"><b class="money">${money(it.cents)}</b>${it.n > 1 ? `<span class="money">of ${money(it.totalCents)}</span>` : ''}</span></div>`).join('')
          + `<div class="led-foot"><span>${hits.length} item${hits.length === 1 ? '' : 's'}</span><b class="money">${money(hits.reduce((a, h) => a + h.cents, 0))}</b></div>`
        : `<p class="noresult">Nothing called “${esc(q.value.trim())}” in October.</p>`;
      return;
    }
    if (view === 'bank') {
      list.innerHTML = w.bank.map((b) => `<div class="lrow bank"><span class="ic">${icon('bank')}</span><span class="t"><b>${esc(b.text)}</b><span>${b.date}</span></span><span class="v"><b class="money">${money(b.cents)}</b></span></div>`).join('')
        + `<p class="noresult" style="padding:10px 16px">No dinner with Alex. No Netflix. No idea what was in the $100.00.</p>`
        + `<div class="led-foot"><span>Left your account</span><b class="money">${money(w.paidCents)}</b></div>`;
      return;
    }
    list.innerHTML = w.bills.map((b) => `<div class="lrow"><span class="ic" style="background:${ICON_BG[b.id]}">${b.recurring ? icon('repeat') : esc(b.title[0])}</span><span class="t"><b>${esc(b.title)}</b><span>${b.date} · ${b.group ? who(b) : 'personal'}</span></span><span class="v"><b class="money">${money(b.youCents)}</b>${b.youCents !== b.totalCents ? `<span class="money">of ${money(b.totalCents)}</span>` : ''}</span></div>`).join('')
      + `<div class="led-foot"><span>You spent</span><b class="money">${money(w.spentCents)}</b></div>`;
  }
  render();

  host.addEventListener('click', (e) => {
    const v = e.target.closest('button[data-v]');
    if (v) {
      view = v.dataset.v; q.value = '';
      $$('button[data-v]', host).forEach((b) => b.setAttribute('aria-pressed', String(b === v)));
      render();
    }
    const t = e.target.closest('button[data-try]');
    if (t) { q.value = t.dataset.try; searchView(); render(); }
  });
  // Searching always searches Trezzit items, so the Trezzit view is the pressed one.
  const searchView = () => {
    if (!q.value.trim() || view === 'trezzit') return;
    view = 'trezzit';
    $$('button[data-v]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === 'trezzit')));
  };
  q.addEventListener('input', () => { searchView(); render(); });
}
