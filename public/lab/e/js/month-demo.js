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
// a search hit names the bill it came from: the rent bill's utilities read as the apartment's bills, not "rent"
const srcTitle = (e) => (e.id === 'monthly-rent' ? `${e.group || 'Apartment 3B'} bills` : e.title);
const andList = (a) => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
// the words people type first, mapped to the items that answer them (the bank can still only match store names)
const ALIAS = { coffee: 'cold brew', snack: 'kale chips', snacks: 'kale chips', chips: 'kale chips', paper: 'hand towels', 'paper towels': 'hand towels', dinner: 'taqueria', burrito: 'burrito', tacos: 'taqueria' };
const reEsc = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function mountMonth(root, opts = {}) {
  const L = await octoberLedger();
  await Promise.all([css('ledger'), css('month')]);
  root.classList.add('ledger', 'compact', 'by-payer', 'mo');
  // E r4: the payer rows are totals, not filters (search is step 3's one control); home hides them on phones
  root.classList.toggle('mo-pays-wide', opts.payersOnPhone === false);
  // E r5: home drops the payer rows at every width (the step's heading says "whoever paid"; /just-me keeps
  // them), and on phones the search comes first, so its answer sits above the keyboard, not under the tiles
  const payers = opts.payers !== false;
  root.classList.toggle('mo-find-first', !!opts.findFirst);
  root.classList.toggle('mo-pays-compact', payers && !!opts.compactPayers);
  // the gap between the two tiles, named in each: the rent transfer, and your share of it
  const rentBank = BANK.find((b) => b.id === 'monthly-rent');
  const rentMine = L.entries.find((e) => e.id === 'monthly-rent');
  root.innerHTML = `
    <div class="lg-sum lg-sum-pay mo-sum">
      <p class="lg-label">October</p>
      <div class="mo-vs">
        <p class="mo-bank"><span class="mo-k">Your bank</span><b class="money">−${money(BANK_PAID)}</b>${rentBank ? `<small class="mo-why mono">${esc(rentBank.text.split(' ')[0])} <span class="money">−${money(rentBank.cents)}</span></small>` : ''}</p>
        <p class="mo-mine"><span class="mo-k">You spent</span><b class="money" data-spent></b>${rentMine && !opts.compactPayers ? `<small class="mo-why">Rent, your share <span class="money">${money(rentMine.youCents)}</span></small>` : ''}</p>
      </div>
      ${payers ? `<ul class="lg-pays" role="list" aria-label="By who paid">${PAY.map(([k, label]) => `<li><span class="lg-pay is-static">
        <span class="lg-pk"><b>${label}</b></span><b class="money" data-paysum="${k}"></b></span></li>`).join('')}</ul>` : ''}
    </div>
    <div class="lg-find">
      <label class="lg-search">${icon.search}<span class="visually-hidden">Search every item</span>
        <input type="search" placeholder="${esc(opts.placeholder || `Try “${opts.demoSearch || 'water'}”`)}" autocomplete="off" spellcheck="false"></label>
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
  let filterPay = null;
  let showAI = false; // the row your AI just added, shown alone until the visitor searches or filters
  let flashAI = false;

  function sums() {
    if (payers) PAY.forEach(([k, , f]) => { root.querySelector(`[data-paysum="${k}"]`).textContent = money(L.entries.filter(f).reduce((a, e) => a + e.youCents, 0)); });
  }
  const who = (e) => (e.payer === 'you' ? 'you paid' : `${e.payer} paid`);
  function entryRow(e) {
    const k = mainCat(e);
    const sub = e.byAI ? `${esc(e.date)} · <span class="mo-ai">Added by AI</span>`
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
      <span class="lg-rt"><b>${name}</b><small>${esc(srcTitle(l.entry))} · ${esc(l.entry.date).replace(' ', '&nbsp;')}</small></span>
      <span class="lg-ra"><b class="money">${money(l.cents)}</b>${l.itemCents !== l.cents ? `<small class="money">of ${money(l.itemCents)}</small>` : l.taxCents ? `<small><span class="money">${money(l.priceCents)}</span> + tax</small>` : ''}</span></li>`;
  }
  // a search for something on a shared receipt that wasn't yours says whose it was, not "no match"
  const names = (ids) => ids.map((k) => (k === 'you' ? 'you' : PEOPLE[k]?.name || k));
  function emptyText(q, ql) {
    const al = ALIAS[ql];
    const o = ql.length > 2 && L.entries.flatMap((e) => e.others || []).find((l) => (l.name.toLowerCase().includes(ql) || (al && l.name.toLowerCase().includes(al))) && l.people.length);
    if (!o) return `Nothing called “${esc(q)}” in October.`;
    const pl = /[^s]s$/i.test(o.name.trim());
    return `${esc(o.name)} ${pl ? 'were' : 'was'} ${esc(andList(names(o.people)))}’s, so ${pl ? 'they aren’t' : 'it isn’t'} in your spending.`;
  }

  function render() {
    const q = input.value.trim();
    const ql = q.toLowerCase();
    root.classList.toggle('filtered', !!filterPay);
    root.classList.toggle('searching', !!q);
    // the row your AI added reads like a search answer: your bank's line above, Trezzit's row below
    const aiView = !q && !filterPay && showAI;
    foil.hidden = !q && !aiView;
    if (!q) {
      const pf = filterPay && PAY.find(([k]) => k === filterPay)[2];
      const rows = filterPay ? L.entries.filter(pf) : showAI ? L.entries.filter((e) => e.byAI) : [];
      listEl.innerHTML = rows.map(entryRow).join('') + (aiView ? '<li class="lg-empty mo-ainote">Everything your AI adds shows in your activity.</li>' : '');
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
    root.querySelector('.mo-fq').textContent = `“${q}”${bankHits.length > 1 ? ` · ${bankHits.length} charges` : ''}`;
    root.querySelector('.mo-fr').innerHTML = bankHits.length
      ? bankHits.slice(0, 1).map((b) => `<p class="mo-bl"><span>${esc(b.date)}</span><span>${esc(b.text)}</span><span class="money">−${money(b.cents)}</span></p>`).join('')
      : '<p class="mo-none">No results</p>';
    const all = L.entries.flatMap((e) => e.lines.map((l) => ({ ...l, entry: e })));
    const al = ALIAS[ql];
    const has = (t) => t.toLowerCase().includes(ql) || (al && t.toLowerCase().includes(al));
    const hits = all.filter((l) => has(l.name) || has(l.entry.title) || cat(l.cat).label.toLowerCase().includes(ql))
      .sort((a, b) => b.cents - a.cents);
    // the answer area holds two rows (the demo's answer), so a longer answer never moves the page: the rest is a count
    const cap = 2;
    listEl.innerHTML = hits.length
      ? hits.slice(0, cap).map((l) => lineRow(l, q)).join('')
      : `<li class="lg-empty">${emptyText(q, ql)}</li>`;
    countEl.innerHTML = hits.length
      ? `<span class="mo-tz">Trezzit${hits.length > cap ? ` <span class="mo-n">· ${hits.length} items</span>` : ''}</span><b class="money">${money(hits.reduce((a, l) => a + l.cents, 0))}</b>`
      : '<span class="mo-tz">Trezzit</span>';
  }

  let free = false;
  input.addEventListener('input', (e) => {
    if (e.isTrusted && !free) { free = true; findEl.style.minHeight = ''; }
    if (input.value.trim()) { filterPay = null; showAI = false; }
    render();
  });
  // a click into a field that still holds text replaces it, never appends to it
  input.addEventListener('focus', () => input.select());
  // phones: focusing the field brings it up under the nav, so the bank's answer and the first hits stay
  // above the keyboard (decided on the visual viewport, which the keyboard shrinks)
  input.addEventListener('focus', () => {
    if (!matchMedia('(max-width: 767px)').matches) return;
    setTimeout(() => {
      const vh = window.visualViewport?.height || innerHeight;
      const top = input.getBoundingClientRect().top;
      if (top >= 64 && top <= Math.min(160, vh * 0.3)) return;
      scrollBy({ top: top - 72, behavior: reduced() ? 'auto' : 'smooth' });
    }, 80);
  });
  // the list area keeps the height of the demo's answer (bank foil plus a few items), measured with the
  // real markup, so the demo typing, a search or the AI's row never moves anything below the month
  const findEl = root.querySelector('.lg-find');
  const sample = opts.demoSearch || 'water';
  let lockedW = 0;
  const lockHeight = (force) => {
    // only a new width can change it (a taller window, or a full-page capture, must not re-render the list)
    if (free || (force !== true && root.clientWidth === lockedW)) return;
    lockedW = root.clientWidth;
    const keep = input.value;
    findEl.style.minHeight = '';
    // the tallest of the answers people try first (two rows each), so none of them moves the page
    let max = 0;
    // (the demo's answer, and every shorter prefix it types on the way: the shells show from the first letter)
    for (let i = 1; i <= sample.length; i += 1) { input.value = sample.slice(0, i); render(); max = Math.max(max, findEl.offsetHeight); }
    // and the row your AI adds, with its note (home)
    const ai = showAI; const fl = flashAI; const fp = filterPay;
    showAI = true; flashAI = false; filterPay = null; input.value = ''; render(); max = Math.max(max, findEl.offsetHeight);
    showAI = ai; flashAI = fl; filterPay = fp;
    findEl.style.minHeight = `${max}px`;
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
  // the tiles move only where they can be seen: if the month is off screen when the AI writes back, the
  // change waits and plays when you scroll back to it (or follow "See it in October"), never silently
  const onAdded = () => onVisible(root.querySelector('.mo-vs'), () => {
    const before = L.spent - AI_ENTRY.youCents;
    sums();
    if (!input.value.trim() && !filterPay && !root.classList.contains('demoing')) showRow();
    countMoney(spentEl, before, L.spent, reduced() ? 0 : 900);
  }, { threshold: 0.9 });
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
        filterPay = null; render();
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
