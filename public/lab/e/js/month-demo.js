/* month-demo.js: "Everything you spent, whoever paid." (home step 3, and /just-me).
 * One idea: D's month-scale proof (your bank's October next to what you spent), C's breakdown by who paid
 * (each row lists its purchases), and B's item search with a bank foil: one query, two searches.
 * Your bank can only search store names ("water": No results); Trezzit searches every item.
 * There is no default activity list: the list area holds only a search, a payer's purchases, or the one
 * row your AI just added (bus 'ai-added': "Added by AI", the total moves, the row lights up once).
 * The input and the list never disagree: an interrupted demo, or the AI's row arriving, clears the search. */
import { AI_ENTRY, BANK, BANK_PAID, CATEGORIES, PEOPLE, octoberLedger } from './data.js';
import { catIcon } from './ledger-demo.js';
import { esc, money, icon, onVisible, countMoney, reduced, css, bus } from './util.js';


const cat = (k) => CATEGORIES[k] || CATEGORIES.other;
const mainCat = (e) => {
  const by = {};
  e.lines.forEach((l) => { by[l.cat] = (by[l.cat] || 0) + l.cents; });
  return Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
};
const PAY = [
  ['alone', 'You paid alone', (e) => e.payer === 'you' && e.kind === 'personal'],
  ['split', 'You split it', (e) => e.payer === 'you' && e.kind !== 'personal'],
  ['other', 'Someone else paid', (e) => e.payer !== 'you'],
];
const andList = (a) => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const reEsc = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function mountMonth(root, opts = {}) {
  const L = await octoberLedger();
  await Promise.all([css('ledger'), css('month')]);
  root.classList.add('ledger', 'compact', 'by-payer', 'mo');
  const nBank = BANK.length;
  root.innerHTML = `
    <div class="lg-sum lg-sum-pay mo-sum">
      <p class="lg-label">October</p>
      <div class="mo-vs">
        <p class="mo-bank"><span class="mo-k">Your bank</span><b class="money">−${money(BANK_PAID)}</b><small>${nBank} payments</small></p>
        <p class="mo-mine"><span class="mo-k">You spent</span><span class="visually-hidden" data-spent-sr></span><b class="money" data-spent aria-hidden="true"></b></p>
      </div>
      <ul class="lg-pays" role="list" aria-label="By who paid">${PAY.map(([k, label]) => `<li><button type="button" class="lg-pay" data-pay="${k}" aria-pressed="false">
        <span class="lg-pk"><b>${label}</b></span><b class="money" data-paysum="${k}"></b></button></li>`).join('')}</ul>
    </div>
    <div class="lg-find">
      <label class="lg-search">${icon.search}<span class="visually-hidden">Search every item</span>
        <input type="search" placeholder="${esc(opts.placeholder || `Search every item, try “${opts.demoSearch || 'water'}”`)}" autocomplete="off" spellcheck="false"></label>
      <div class="mo-foil" hidden>
        <p class="mo-fk"><span class="bank-i" aria-hidden="true"></span>Your bank <span class="mo-fq"></span></p>
        <div class="mo-fr"></div>
      </div>
      <p class="lg-count" aria-live="polite"></p>
      <ul class="lg-list" role="list"></ul>
    </div>`;

  const input = root.querySelector('input');
  const listEl = root.querySelector('.lg-list');
  const countEl = root.querySelector('.lg-count');
  const foil = root.querySelector('.mo-foil');
  const spentEl = root.querySelector('[data-spent]');
  const spentSr = root.querySelector('[data-spent-sr]');
  let filterPay = null;
  let showAI = false; // the row your AI just added, shown alone until the visitor searches or filters
  let flashAI = false;

  function sums() {
    PAY.forEach(([k, , f]) => { root.querySelector(`[data-paysum="${k}"]`).textContent = money(L.entries.filter(f).reduce((a, e) => a + e.youCents, 0)); });
    spentSr.textContent = money(L.spent);
  }
  const who = (e) => (e.payer === 'you' ? 'you paid' : `${e.payer} paid`);
  function entryRow(e) {
    const k = mainCat(e);
    const sub = e.byAI ? `${esc(e.date)} · <span class="mo-ai">${icon.sparkle}Added by AI</span>`
      : e.kind === 'personal' ? `Just you · ${esc(e.date)}`
        : e.id === 'monthly-rent' ? `Repeats monthly · <span class="lg-who">${esc(who(e))}</span>`
          : `${esc(e.date)} · <span class="lg-who">${esc(who(e))}</span>`;
    return `<li class="lg-row${e.byAI ? ' lg-ai' : ''}" data-id="${esc(e.id)}">
      <span class="lg-ri" style="--c:${cat(k).color}">${e.kind === 'recurring' ? `<span class="lg-rec" title="Repeats monthly">${icon.repeat}</span>` : ''}${catIcon(k)}</span>
      <span class="lg-rt"><b>${esc(e.title)}</b><small>${sub}</small></span>
      <span class="lg-ra"><b class="money">${money(e.youCents)}</b>${e.totalCents !== e.youCents ? `<small class="money">of ${money(e.totalCents)}</small>` : ''}</span></li>`;
  }
  function lineRow(l, q) {
    const name = q ? esc(l.name).replace(new RegExp(`(${reEsc(esc(q))})`, 'ig'), '<mark>$1</mark>') : esc(l.name);
    return `<li class="lg-row lg-item">
      <span class="lg-ri sm" style="--c:${cat(l.cat).color}">${catIcon(l.cat)}</span>
      <span class="lg-rt"><b>${name}</b><small>${esc(l.entry.title)} · ${l.entry.date}</small></span>
      <span class="lg-ra"><b class="money">${money(l.cents)}</b>${l.itemCents !== l.cents ? `<small class="money">of ${money(l.itemCents)}</small>` : ''}</span></li>`;
  }
  // a search for something on a shared receipt that wasn't yours says whose it was, not "no match"
  const names = (ids) => ids.map((k) => (k === 'you' ? 'you' : PEOPLE[k]?.name || k));
  function emptyText(q, ql) {
    const o = ql.length > 2 && L.entries.flatMap((e) => e.others || []).find((l) => l.name.toLowerCase().includes(ql) && l.people.length);
    if (!o) return `Nothing called “${esc(q)}” in October.`;
    return `${esc(o.name)} was ${esc(andList(names(o.people)))}’s, so it isn’t in your spending.`;
  }

  function render() {
    const q = input.value.trim();
    const ql = q.toLowerCase();
    root.querySelectorAll('.lg-pay').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pay === filterPay)));
    root.classList.toggle('filtered', !!filterPay);
    root.classList.toggle('searching', !!q);
    // the row your AI added reads like a search answer: your bank's line above, Trezzit's row below
    const aiView = !q && !filterPay && showAI;
    foil.hidden = !q && !aiView;
    if (!q) {
      const pf = filterPay && PAY.find(([k]) => k === filterPay)[2];
      const rows = filterPay ? L.entries.filter(pf) : showAI ? L.entries.filter((e) => e.byAI) : [];
      listEl.innerHTML = rows.map(entryRow).join('');
      countEl.innerHTML = aiView ? '<span class="mo-tz">Trezzit</span>' : '';
      if (aiView) {
        const b = BANK.find((x) => x.id === AI_ENTRY.id);
        root.querySelector('.mo-fq').textContent = '';
        root.querySelector('.mo-fr').innerHTML = `<p class="mo-bl"><span>${esc(b.date)}</span><span>${esc(b.text)}</span><span class="money">−${money(b.cents)}</span></p>`;
      }
      if (flashAI) {
        const row = listEl.querySelector('.lg-ai');
        if (row) onVisible(row, () => { flashAI = false; row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }, { threshold: 0.9 });
      }
      return;
    }
    // your bank can only search what it has: store names
    const bankHits = BANK.filter((b) => b.text.toLowerCase().includes(ql));
    root.querySelector('.mo-fq').textContent = `“${q}”`;
    root.querySelector('.mo-fr').innerHTML = bankHits.length
      ? bankHits.map((b) => `<p class="mo-bl"><span>${esc(b.date)}</span><span>${esc(b.text)}</span><span class="money">−${money(b.cents)}</span></p>`).join('')
      : '<p class="mo-none">No results</p>';
    const all = L.entries.flatMap((e) => e.lines.map((l) => ({ ...l, entry: e })));
    const hits = all.filter((l) => l.name.toLowerCase().includes(ql) || l.entry.title.toLowerCase().includes(ql) || cat(l.cat).label.toLowerCase().includes(ql))
      .sort((a, b) => b.cents - a.cents);
    const cap = 4;
    listEl.innerHTML = hits.length
      ? hits.slice(0, cap).map((l) => lineRow(l, q)).join('') + (hits.length > cap ? `<li class="lg-moreline">and ${hits.length - cap} more items</li>` : '')
      : `<li class="lg-empty">${emptyText(q, ql)}</li>`;
    countEl.innerHTML = hits.length
      ? `<span class="mo-tz">Trezzit</span> ${hits.length} ${hits.length === 1 ? 'item' : 'items'} <span aria-hidden="true">·</span> your share <b class="money">${money(hits.reduce((a, l) => a + l.cents, 0))}</b>`
      : '<span class="mo-tz">Trezzit</span>';
  }

  input.addEventListener('input', () => { if (input.value.trim()) { filterPay = null; showAI = false; } render(); });
  // a click into a field that still holds text replaces it, never appends to it
  input.addEventListener('focus', () => input.select());
  root.querySelectorAll('.lg-pay').forEach((b) => b.addEventListener('click', () => {
    filterPay = filterPay === b.dataset.pay ? null : b.dataset.pay;
    showAI = false;
    input.value = '';
    render();
    if (filterPay && matchMedia('(max-width: 879px)').matches) {
      const r = listEl.getBoundingClientRect();
      if (r.top > innerHeight * 0.72) scrollBy({ top: r.top - innerHeight * 0.45, behavior: reduced() ? 'auto' : 'smooth' });
    }
  }));
  // the list area keeps the height of the demo's answer (bank foil plus a few items), measured with the
  // real markup, so the demo typing, a search or the AI's row never moves anything below the month
  const findEl = root.querySelector('.lg-find');
  const sample = opts.demoSearch || 'water';
  let lockedW = 0;
  const lockHeight = (force) => {
    // only a new width can change it (a taller window, or a full-page capture, must not re-render the list)
    if (force !== true && root.clientWidth === lockedW) return;
    lockedW = root.clientWidth;
    const keep = input.value;
    findEl.style.minHeight = '';
    input.value = sample;
    render();
    findEl.style.minHeight = `${findEl.offsetHeight}px`;
    input.value = keep;
    render();
  };

  sums();
  lockHeight(true);
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(lockHeight); });
  document.fonts?.ready.then(() => lockHeight(true));

  // the headline figure counts up the first time it is seen (never from $0.00)
  spentEl.textContent = money(L.spent);
  if (!reduced()) {
    const from = Math.round(L.spent * 0.6);
    spentEl.textContent = money(from);
    onVisible(root, () => countMoney(spentEl, from, L.spent, 800), { threshold: 0 });
  }

  // your AI added the missing charge: the totals move at once. A search on screen is the visitor's (or the
  // demo's proof) and is never wiped: the row shows in place only when the list is empty, or when the
  // chat's "See it in October" asks for it (that clears the search first, then lights the row once).
  let halt = () => {};
  const showRow = () => {
    halt();
    flashAI = true;
    showAI = true;
    filterPay = null;
    input.value = '';
    render();
  };
  const onAdded = () => {
    const before = L.spent - AI_ENTRY.youCents;
    sums();
    if (!input.value.trim() && !filterPay && !root.classList.contains('demoing')) showRow();
    countMoney(spentEl, before, L.spent, reduced() ? 0 : 600);
  };
  bus.on('ai-added', onAdded);
  bus.on('ai-show', showRow);

  // item search is the idea people miss, so it shows itself once: when the month is 40% on screen,
  // "water" types into the field, the bank finds nothing and Trezzit finds two items, then it clears.
  // Never takes focus; any touch, key or click in the month stops it; skipped with reduced motion.
  if (opts.demoSearch && (reduced() || !('IntersectionObserver' in window))) { input.value = opts.demoSearch; render(); }
  else if (opts.demoSearch) {
    let stop = false;
    // stopping mid-demo leaves an empty field and the list it matches (never half a word)
    halt = () => {
      if (stop) return;
      stop = true;
      if (root.classList.contains('demoing')) {
        root.classList.remove('demoing');
        input.value = '';
        countEl.setAttribute('aria-live', 'polite');
        render();
      }
    };
    ['pointerdown', 'keydown', 'focusin'].forEach((t) => root.addEventListener(t, halt, { once: true }));
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const q = opts.demoSearch;
      await new Promise((r) => setTimeout(r, 700));
      if (stop) return;
      root.classList.add('demoing');
      countEl.setAttribute('aria-live', 'off');
      for (let i = 1; i <= q.length && !stop; i += 1) {
        input.value = q.slice(0, i);
        if (i >= Math.min(4, q.length)) { filterPay = null; render(); }
        await new Promise((r) => setTimeout(r, 90));
      }
      if (stop) return;
      // the answer stays: the bank's "No results" next to Trezzit's items is the proof
      stop = true;
      root.classList.remove('demoing');
      countEl.setAttribute('aria-live', 'polite');
    }, { threshold: 0.4 });
    io.observe(root);
  }
  return { L, root };
}
