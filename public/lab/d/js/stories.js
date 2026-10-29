// "One list. Shared or not.": the ledger, all from the computed world.
import { $, $$, esc, money, icon, announce } from './ui.js';
import { getWorld, derive, catOf, PEOPLE, tone, OTHER_TONE } from './world.js';

const nameOf = (k) => (k === 'you' ? 'You' : PEOPLE[k]?.name || k);
const MAX_HITS = 8;

/* ---------- October ---------- */
export async function initLedger() {
  const host = document.querySelector('[data-led]');
  if (!host) return;
  const w = await getWorld();
  const nTop = matchMedia('(max-width: 520px)').matches ? 3 : 5;
  // The list as it stands: the split above can change the Green Basket row (and so everything it adds up to).
  let cur = { bills: w.bills, ...derive(w.bills) };

  host.innerHTML = `<div class="panel led-list">
      <div class="toolbar" style="margin:8px 10px 4px">
        <div class="seg" role="group" aria-label="View" data-view>
          <button type="button" aria-pressed="false" data-v="bank">Your bank</button>
          <button type="button" aria-pressed="true" data-v="trezzit">Trezzit</button>
        </div>
      </div>
      <label class="search" data-find>${icon('search')}<span class="visually-hidden">Search items, stores, people</span><input type="search" placeholder="Search any item, try towels" aria-label="Search your expenses" data-q autocomplete="off"></label>
      <div data-list></div>
    </div>
    <div class="panel sum-card" data-sum></div>`;

  const list = $('[data-list]', host);
  const sum = $('[data-sum]', host);
  const q = $('[data-q]', host);
  let view = 'trezzit';
  const who = (b) => (b.payer === 'you' ? 'you paid' : `${PEOPLE[b.payer].name} paid`);

  function renderSum() {
    const max = cur.cats[0].cents;
    const top = cur.cats.slice(0, nTop);
    const rest = cur.cats.slice(nTop).reduce((a, c) => a + c.cents, 0);
    sum.innerHTML = `<div class="kicker">October</div>
      <div class="paidspent"><div class="pd"><span>You paid</span><b class="money">${money(w.paidCents)}</b></div><div class="sp"><span>You spent</span><b class="money" data-spent>${money(cur.spentCents)}</b></div></div>
      <div class="cats">${top.map((c, i) => `<div class="cat"><div class="l"><span>${esc(c.label)}</span><b class="money">${money(c.cents)}</b></div><div class="hbar"><i style="width:${Math.max(2, (c.cents / max) * 100)}%;background:${tone(i)}"></i></div></div>`).join('')}
        <div class="cat"><div class="l"><span>Everything else</span><b class="money">${money(rest)}</b></div><div class="hbar"><i style="width:${Math.max(2, (rest / max) * 100)}%;background:${OTHER_TONE}"></i></div></div></div>`;
  }

  /* Search every line on every receipt, yours or not, by item, store, category, group or person. */
  function search(term) {
    return cur.lines.filter((it) => {
      const people = [...it.owners, it.payer].filter((k) => k !== 'you').map((k) => PEOPLE[k]?.name || '');
      return [it.name, it.bill, catOf(it.category).label, it.group, ...people].some((s) => s && s.toLowerCase().includes(term));
    });
  }
  const whose = (it) => {
    const n = it.owners.map(nameOf);
    return `${n.length < 2 ? n[0] : `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`}’s`;
  };

  function render() {
    const term = q.value.trim().toLowerCase();
    if (term) {
      const hits = search(term);
      const shown = hits.slice(0, MAX_HITS);
      list.innerHTML = hits.length
        ? shown.map((it) => `<div class="lrow"><span class="ic" aria-hidden="true">${esc(it.name[0])}</span><span class="t"><b>${esc(it.name)}</b><span>${esc(it.bill)} · ${it.date}${it.cents && it.n > 1 ? ` · split ${it.how}` : ''}</span></span><span class="v"><b class="money">${money(it.cents)}</b>${!it.cents ? `<span>${esc(whose(it))}</span>` : it.n > 1 ? `<span class="money">of ${money(it.totalCents)}</span>` : ''}</span></div>`).join('')
          + (hits.length > shown.length ? `<p class="led-more">+ ${hits.length - shown.length} more</p>` : '')
          + `<div class="led-foot"><span>${hits.length} item${hits.length === 1 ? '' : 's'} · your share</span><b class="money">${money(hits.reduce((a, h) => a + h.cents, 0))}</b></div>`
        : `<p class="noresult">Nothing called “${esc(q.value.trim())}” in October.</p>`;
      announce(hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'} for ${q.value.trim()}.` : `No results for ${q.value.trim()}.`);
      return;
    }
    if (view === 'bank') {
      list.innerHTML = w.bank.map((b) => `<div class="lrow bank"><span class="ic" aria-hidden="true">${icon('bank')}</span><span class="t"><b>${esc(b.text)}</b><span>${b.date}</span></span><span class="v"><b class="money">${money(b.cents)}</b></span></div>`).join('')
        + '<p class="bank-cap">No dinner with Alex. No Netflix. No idea what was in the $100.00.</p>';
      return;
    }
    list.innerHTML = cur.bills.map((b) => `<div class="lrow" data-bill-row="${b.id}"><span class="ic"${b.recurring ? ' aria-label="Monthly" role="img"' : ' aria-hidden="true"'}>${b.recurring ? icon('repeat') : b.byAI ? icon('spark') : esc(b.title[0])}</span><span class="t"><b>${esc(b.title)}</b><span>${b.date} · ${b.byAI ? 'added by your AI' : b.group ? who(b) : 'personal'}</span></span><span class="v"><b class="money">${money(b.youCents)}</b>${b.youCents !== b.totalCents ? `<span class="money">of ${money(b.totalCents)}</span>` : ''}</span></div>`).join('');
  }

  const setView = (v) => {
    view = v; q.value = '';
    $$('button[data-v]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    // Search only means something in the Trezzit view; the bank has no items to find.
    $$('[data-find]', host).forEach((el) => { el.hidden = view === 'bank'; });
    // The bank only knows what you paid: the spent side of the card steps back.
    host.classList.toggle('is-bank', view === 'bank');
    render();
  };

  renderSum();
  setView('trezzit');

  host.addEventListener('click', (e) => {
    const v = e.target.closest('button[data-v]');
    if (!v || v.dataset.v === view) return;
    setView(v.dataset.v);
    announce(view === 'bank'
      ? `Your bank: ${w.bank.length} payments, ${money(w.paidCents)}.`
      : `Trezzit: ${cur.bills.length} expenses, you spent ${money(cur.spentCents)}.`);
  });
  // Searching always searches Trezzit items, so the Trezzit view is the pressed one.
  q.addEventListener('input', () => {
    if (q.value.trim() && view !== 'trezzit') {
      view = 'trezzit'; host.classList.remove('is-bank');
      $$('button[data-v]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === 'trezzit')));
    }
    render();
  });

  /* The split above changed who had what on the Green Basket receipt: this list follows,
     and the figures that moved flash once the next time the list is on screen. */
  let flash = false;
  document.addEventListener('d:split', (e) => {
    const { id, split } = e.detail;
    const was = cur.spentCents;
    const bills = cur.bills.map((b) => (b.id === id ? { ...b, split, youCents: split.people.you?.cents || 0 } : b));
    cur = { bills, ...derive(bills) };
    if (cur.spentCents === was) return;
    renderSum(); render();
    flash = true; maybeFlash();
  });
  const onScreen = () => { const r = host.getBoundingClientRect(); return r.top < innerHeight * 0.8 && r.bottom > innerHeight * 0.2; };
  function maybeFlash() {
    if (!flash || !onScreen()) return;
    flash = false;
    [$('[data-spent]', host)?.parentElement, $('[data-bill-row="green-basket"]', host)].forEach((el) => {
      if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    });
  }
  addEventListener('scroll', maybeFlash, { passive: true });
}
