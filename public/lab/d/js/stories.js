// "What did I actually spend in October?": the ledger, all from the computed world.
import { $, $$, esc, money, icon, onVisible } from './ui.js';
import { getWorld, catOf, PEOPLE, tone, OTHER_TONE } from './world.js';

/* ---------- October ---------- */
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
          <button type="button" aria-pressed="false" data-v="bank">Your bank</button>
          <button type="button" aria-pressed="true" data-v="trezzit">Trezzit</button>
        </div>
      </div>
      <label class="search" data-find>${icon('search')}<span class="visually-hidden">Search items, stores, categories</span><input type="search" placeholder="Search any item, try towels" aria-label="Search your expenses" data-q autocomplete="off"></label>
      <div data-list aria-live="polite"></div>
    </div>
    <div class="panel sum-card">
      <div class="kicker">October</div>
      <div class="paidspent"><div><span>You paid</span><b class="money">${money(w.paidCents)}</b></div><div class="sp"><span>You spent</span><b class="money">${money(w.spentCents)}</b></div></div>
      <div class="cats">${top.map((c, i) => `<div class="cat"><div class="l"><span>${esc(c.label)}</span><b class="money">${money(c.cents)}</b></div><div class="hbar"><i style="width:${Math.max(2, (c.cents / max) * 100)}%;background:${tone(i)}"></i></div></div>`).join('')}
        <div class="cat"><div class="l"><span>Everything else</span><b class="money">${money(rest)}</b></div><div class="hbar"><i style="width:${Math.max(2, (rest / max) * 100)}%;background:${OTHER_TONE}"></i></div></div></div>
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
        ? hits.map((it) => `<div class="lrow"><span class="ic">${esc(it.name[0])}</span><span class="t"><b>${esc(it.name)}</b><span>${esc(it.bill)} · ${it.date}${it.n > 1 ? ` · split ${it.how}` : ''}</span></span><span class="v"><b class="money">${money(it.cents)}</b>${it.n > 1 ? `<span class="money">of ${money(it.totalCents)}</span>` : ''}</span></div>`).join('')
          + `<div class="led-foot"><span>${hits.length} item${hits.length === 1 ? '' : 's'}</span><b class="money">${money(hits.reduce((a, h) => a + h.cents, 0))}</b></div>`
        : `<p class="noresult">Nothing called “${esc(q.value.trim())}” in October.</p>`;
      return;
    }
    if (view === 'bank') {
      list.innerHTML = w.bank.map((b) => `<div class="lrow bank"><span class="ic">${icon('bank')}</span><span class="t"><b>${esc(b.text)}</b><span>${b.date}</span></span><span class="v"><b class="money">${money(b.cents)}</b></span></div>`).join('')
        + `<p class="bank-cap">No dinner with Alex. No Netflix. No idea what was in the $100.00.</p>`;
      return;
    }
    list.innerHTML = w.bills.map((b) => `<div class="lrow"><span class="ic"${b.recurring ? ' aria-label="Monthly" role="img"' : ''}>${b.recurring ? icon('repeat') : b.byAI ? icon('spark') : esc(b.title[0])}</span><span class="t"><b>${esc(b.title)}</b><span>${b.date} · ${b.byAI ? 'added by your AI' : b.group ? who(b) : 'personal'}</span></span><span class="v"><b class="money">${money(b.youCents)}</b>${b.youCents !== b.totalCents ? `<span class="money">of ${money(b.totalCents)}</span>` : ''}</span></div>`).join('');
  }
  const panel = $('.led-list', host);
  const setView = (v, { stagger = false } = {}) => {
    view = v; q.value = '';
    $$('button[data-v]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    // Search only means something in the Trezzit view; the bank has no items to find.
    $$('[data-find]', host).forEach((el) => { el.hidden = view === 'bank'; });
    render();
    // The 4 bank lines open out into the 6 real expenses, one after another.
    if (stagger) $$('.lrow', list).forEach((r, i) => { r.style.animationDelay = `${i * 70}ms`; });
  };
  /* Reserve the taller (Trezzit) view's height, so the flip below never moves the page. */
  const reserve = () => {
    const was = view; panel.style.minHeight = '';
    setView('trezzit'); const h = panel.offsetHeight;
    setView(was); panel.style.minHeight = h + 'px';
  };
  // Opens on what your bank shows; once in view it turns into what you spent (once, unless you got there first).
  let touched = false;
  setView('bank'); reserve();
  addEventListener('resize', () => { if (innerWidth !== reserve.w) { reserve.w = innerWidth; reserve(); } }, { passive: true });
  reserve.w = innerWidth;
  onVisible(panel, () => setTimeout(() => { if (!touched) setView('trezzit', { stagger: true }); }, 1800), 0.5);

  host.addEventListener('click', (e) => {
    const v = e.target.closest('button[data-v]');
    if (v) { touched = true; setView(v.dataset.v); }
  });
  // Searching always searches Trezzit items, so the Trezzit view is the pressed one.
  const searchView = () => {
    if (!q.value.trim() || view === 'trezzit') return;
    view = 'trezzit';
    $$('button[data-v]', host).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === 'trezzit')));
    $$('[data-find]', host).forEach((el) => { el.hidden = false; });
  };
  q.addEventListener('input', () => { touched = true; searchView(); render(); });
}
