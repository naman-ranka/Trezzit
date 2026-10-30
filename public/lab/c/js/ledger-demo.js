/* ledger-demo.js: "Understand". Your share only, sorted by category, with
 * this-vs-last-month and item-level search across every bill. */
import { CATEGORIES, PEOPLE, LAST_MONTH, octoberLedger } from './data.js';
import { esc, money, icon, onVisible, countMoney, reduced, css } from './util.js';

const CAT_ICON = {
  groceries: '<path d="M4 7h12l-1.2 8.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3zM7.5 7l2-3.5M12.5 7l-2-3.5" />',
  household: '<path d="M3.5 9.5L10 4l6.5 5.5M5.5 8v8h9V8" />',
  dining: '<path d="M6 3v6a2 2 0 0 0 2 2v6M10 3v6a2 2 0 0 1-2 2M14 3c-1.5 1-2 3-2 5s1 3 2 3v6" />',
  health: '<path d="M10 4v12M4 10h12" />',
  'personal-care': '<path d="M7 17V9.5a3 3 0 0 1 6 0V17zM8.5 6.5V3.5h3v3" />',
  gifts: '<path d="M4 8h12v3H4zM5 11v6h10v-6M10 8v9M10 8c-1-3-4-3.5-4-1.5S10 8 10 8s4 .5 4-1.5S11 5 10 8" />',
  rent: '<path d="M4 17V8l6-4.5L16 8v9zM8.5 17v-4.5h3V17" />',
  utilities: '<path d="M10 3.5c3 3.5 4.5 6 4.5 8.2a4.5 4.5 0 0 1-9 0C5.5 9.5 7 7 10 3.5z" />',
  internet: '<path d="M3.5 8.5a9.5 9.5 0 0 1 13 0M6 11.2a6 6 0 0 1 8 0M8.5 13.8a2.4 2.4 0 0 1 3 0" />',
  subscriptions: '<path d="M3.5 5.5h13v9h-13zM8.5 8v4l3.5-2z" />',
  other: '<circle cx="10" cy="10" r="5" />',
};
export const catIcon = (k) => `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${CAT_ICON[k] || CAT_ICON.other}</svg>`;
const cat = (k) => CATEGORIES[k] || CATEGORIES.other;
const MAIN_CAT = (e) => {
  const by = {};
  e.lines.forEach((l) => { by[l.cat] = (by[l.cat] || 0) + l.cents; });
  return Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
};

export async function mountLedger(root, opts = {}) {
  const data = await octoberLedger();
  const { entries } = data;
  // One total for the month, rent included: the headline is everything you spent, your share only.
  // Rent leads the category list as one row (it links to its own page) and is left out of the
  // per-category bars, so it doesn't flatten the day-to-day ones.
  const fixed = entries.find((e) => e.id === 'monthly-rent');
  const dayToDay = entries.filter((e) => e !== fixed);
  const byCat = {};
  dayToDay.forEach((e) => e.lines.forEach((l) => { byCat[l.cat] = (byCat[l.cat] || 0) + l.cents; }));
  const spent = entries.reduce((a, e) => a + e.youCents, 0);
  const last = Object.values(LAST_MONTH).reduce((a, c) => a + c, 0);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats[0][1];
  const delta = spent - last;
  // colour means one thing at a time: rent, the top 3 categories in their hue, and one grey "Other"
  const rest = cats.slice(3).reduce((a, [, c]) => a + c, 0);
  const barParts = (fixed ? [[fixed.youCents, cat('rent').color]] : []).concat(cats.slice(0, 3).map(([k, c]) => [c, cat(k).color]), rest ? [[rest, '#cbd2dc']] : []);
  const nRows = cats.length + (fixed ? 1 : 0);
  css('ledger'); // its styles (linked by the page, or loaded by home.js before mounting)
  root.classList.add('ledger');
  if (opts.byPayer) root.classList.add('by-payer');
  // compact (home): fewer categories and rows on phones, so the demo stays one screen tall
  if (opts.compact) root.classList.add('compact');
  const chips = ['towels', 'cold brew', 'Taqueria'];
  const findHTML = `
    <div class="lg-find">
      <label class="lg-search">${icon.search}<span class="visually-hidden">Search every item</span>
        <input type="search" placeholder="${opts.compact ? 'Search items, like “towels”' : 'Search items, stores, categories'}" autocomplete="off" spellcheck="false"></label>
      ${opts.compact ? '' : `<p class="lg-try"><span>Try</span>${chips.map((q) => `<button type="button" class="chip-q" data-q="${q}" aria-pressed="false">${q}</button>`).join('')}</p>`}
      <p class="lg-count" aria-live="polite"></p>
      <ul class="lg-list" role="list"></ul>
    </div>`;
  // home (byPayer): the month is one total split by who paid, the heading's promise ("your share, whoever paid");
  // each row filters the list beside it. No categories, bar or deltas here: /just-me has those.
  const PAY = [
    ['alone', 'You paid alone', (e) => e.payer === 'you' && e.kind === 'personal'],
    ['split', 'You split it', (e) => e.payer === 'you' && e.kind !== 'personal'],
    ['other', 'Someone else paid', (e) => e.payer !== 'you'],
  ];
  const payHTML = `<div class="lg-sum lg-sum-pay">
      <p class="lg-label">October, your share</p>
      <p class="lg-total money"><span class="visually-hidden">${money(spent)}</span><span class="lg-n" aria-hidden="true">${money(spent)}</span></p>
      <ul class="lg-pays" role="list" aria-label="By who paid">${PAY.map(([k, label, f]) => `<li><button type="button" class="lg-pay" data-pay="${k}" aria-pressed="false">
        <span class="lg-pk"><b>${label}</b></span><b class="money">${money(entries.filter(f).reduce((a, e) => a + e.youCents, 0))}</b></button></li>`).join('')}</ul>
    </div>`;
  // the answer (the month's total, by who paid) comes before the details in reading and tab order
  root.innerHTML = opts.byPayer ? `${payHTML}${findHTML}` : `${findHTML}
    <div class="lg-sum">
      <p class="lg-label">Spent in October <span class="lg-tag">Your share only</span></p>
      <p class="lg-total money"><span class="visually-hidden">${money(spent)}</span><span class="lg-n" aria-hidden="true">${money(spent)}</span></p>
      <p class="lg-sub"><span class="${delta < 0 ? 'down' : 'up'}">${money(Math.abs(delta))} ${delta < 0 ? 'less' : 'more'} than September</span></p>
      <div class="lg-bar" aria-hidden="true">${barParts.map(([c, color]) => `<i style="--c:${color};--w:${(c / spent) * 100}%"></i>`).join('')}</div>
      <ul class="lg-cats short" role="list" aria-label="By category">
        ${fixed ? `<li><a class="lg-cat lg-fixed" href="${esc(opts.fixedHref || '../recurring/')}">
            <span class="lg-ci" style="--c:${cat('rent').color}">${catIcon('rent')}</span>
            <span class="lg-cn">Rent and bills</span>
            <span class="lg-cb lg-rtag" aria-hidden="true">${icon.repeat}Monthly</span>
            <b class="money">${money(fixed.youCents)}</b>
            <span class="lg-cd lg-fgo"><span aria-hidden="true">→</span><span class="visually-hidden">Repeats every month</span></span></a></li>` : ''}
        ${cats.map(([k, c]) => {
          const prev = LAST_MONTH[k] || 0;
          const d = c - prev;
          // neutral text with an arrow: red and green already mean categories here
          const dTxt = prev === 0 ? 'new' : d === 0 ? 'same' : `<span aria-hidden="true">${d < 0 ? '↓' : '↑'}</span><span class="visually-hidden">${d < 0 ? 'down' : 'up'} </span>${money(Math.abs(d))}`;
          return `<li><button type="button" class="lg-cat" data-cat="${k}" aria-pressed="false">
            <span class="lg-ci" style="--c:${cat(k).color}">${catIcon(k)}</span>
            <span class="lg-cn">${cat(k).label}</span>
            <span class="lg-cb" aria-hidden="true"><i style="--c:${cat(k).color};--w:${(c / max) * 100}%"></i></span>
            <b class="money">${money(c)}</b>
            <span class="lg-cd ${prev === 0 ? 'new' : d < 0 ? 'down' : d > 0 ? 'up' : ''}" title="vs September">${dTxt}</span>
          </button></li>`;
        }).join('')}
      </ul>
      <button type="button" class="c-link-btn lg-more">Show all ${nRows} categories</button>
    </div>`;

  const input = root.querySelector('input') || { value: '', addEventListener() {}, focus() {} };
  const listEl = root.querySelector('.lg-list');
  const countEl = root.querySelector('.lg-count');
  let filterCat = null;
  let filterPay = null;
  // home: the default list leads with what makes the total add up (rent, which Maya paid), then one row
  // per kind of payer; the rest folds into one line whose amount closes the sum to the headline
  const LEAD = ['monthly-rent', 'pizza', 'green-basket', 'corner-pharmacy'];
  let showAll = false;

  const allLines = entries.flatMap((e) => e.lines.map((l) => ({ ...l, entry: e })));

  function entryRow(e) {
    const k = MAIN_CAT(e);
    const who = e.payer === 'you' ? 'you paid' : `${e.payer} paid`;
    // say what a row is in the words a visitor already has: just you, who paid, what the rent covers
    // home (byPayer): no group name on every row (it is all the same apartment); rent is "Repeats monthly · Maya paid"
    const sub = e.kind === 'personal' ? `Just you · ${esc(e.date)}`
      : e.id === 'monthly-rent' ? (opts.byPayer ? `Repeats monthly · <span class="lg-who">${esc(who)}</span>` : `${esc(e.date)} · ${esc(who)} · rent, utilities, internet`)
        : opts.byPayer ? `${esc(e.date)} · <span class="lg-who">${esc(who)}</span>`
          : `${esc(e.group)} · ${esc(e.date)} · <span class="lg-who">${esc(who)}</span>`;
    return `<li class="lg-row" data-id="${esc(e.id)}">
      <span class="lg-ri" style="--c:${cat(k).color}">${e.kind === 'recurring' ? `<span class="lg-rec" title="Recurring">${icon.repeat}</span>` : ''}${catIcon(k)}</span>
      <span class="lg-rt"><b>${esc(e.title)}</b><small>${sub}</small></span>
      <span class="lg-ra"><b class="money">${money(e.youCents)}</b>${e.totalCents !== e.youCents ? `<small class="money">of ${money(e.totalCents)}</small>` : ''}</span></li>`;
  }
  function lineRow(l, q) {
    const name = q ? esc(l.name).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>') : esc(l.name);
    return `<li class="lg-row lg-item">
      <span class="lg-ri sm" style="--c:${cat(l.cat).color}">${catIcon(l.cat)}</span>
      <span class="lg-rt"><b>${name}</b><small>${esc(l.entry.title)} · ${l.entry.date} · ${cat(l.cat).label}</small></span>
      <span class="lg-ra"><b class="money">${money(l.cents)}</b>${l.itemCents !== l.cents ? `<small class="money">of ${money(l.itemCents)}</small>` : ''}</span></li>`;
  }

  // a search for something on a shared receipt that wasn't yours says whose it was, not "no match"
  const otherLines = entries.flatMap((e) => (e.others || []).map((o) => ({ ...o, entry: e })));
  const names = (ids) => ids.map((k) => (k === 'you' ? 'you' : PEOPLE[k]?.name || k));
  const andList = (a) => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  function emptyText(q, ql) {
    const o = !filterCat && ql.length > 2 && otherLines.find((l) => l.name.toLowerCase().includes(ql) && l.people.length);
    if (!o) return `No items match “${esc(q)}”.`;
    const who = names(o.people);
    return `${esc(o.name)} was ${esc(andList(who))}’s, so it isn’t in your spending.`;
  }

  function render() {
    const q = input.value.trim();
    const ql = q.toLowerCase();
    root.querySelectorAll('button.lg-cat').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === filterCat)));
    root.querySelectorAll('.chip-q').forEach((b) => b.setAttribute('aria-pressed', String(!!q && b.dataset.q === q)));
    root.querySelectorAll('.lg-pay').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pay === filterPay)));
    root.classList.toggle('filtered', !!filterPay);
    if (!q && !filterCat) {
      const pf = filterPay && PAY.find(([k]) => k === filterPay)[2];
      const rank = (e) => (LEAD.includes(e.id) ? LEAD.indexOf(e.id) : LEAD.length);
      let rows = entries.filter((e) => !pf || pf(e));
      if (opts.byPayer) rows = rows.slice().sort((x, y) => rank(x) - rank(y));
      let restHTML = '';
      if (opts.byPayer && !filterPay) {
        const lead = LEAD.map((id) => entries.find((e) => e.id === id)).filter(Boolean);
        const rest = entries.filter((e) => !lead.includes(e));
        rows = showAll ? lead.concat(rest) : lead;
        if (rest.length && !showAll) {
          restHTML = `<li class="lg-restline"><button type="button" class="lg-rest" aria-expanded="false"><span>${rest.length} more <small>${esc(andList(rest.map((e) => e.title)))}</small></span><b class="money">${money(rest.reduce((a, e) => a + e.youCents, 0))}</b></button></li>`;
        }
      }
      listEl.innerHTML = rows.map(entryRow).join('') + restHTML
        + (filterPay === 'other' && opts.rentHref ? `<li class="lg-rentlink"><a href="${esc(opts.rentHref)}">Split rent by room size <span aria-hidden="true">→</span></a></li>` : '');
      countEl.textContent = opts.compact ? '' : `${entries.length} expenses this month`;
      return;
    }
    const hits = allLines.filter((l) => (!filterCat || l.cat === filterCat)
      && (!ql || l.name.toLowerCase().includes(ql) || l.entry.title.toLowerCase().includes(ql) || cat(l.cat).label.toLowerCase().includes(ql)));
    const sum = hits.reduce((a, l) => a + l.cents, 0);
    const cap = opts.compact ? 5 : 8;
    listEl.innerHTML = hits.length
      ? hits.slice(0, cap).map((l) => lineRow(l, q)).join('') + (hits.length > cap ? `<li class="lg-moreline">and ${hits.length - cap} more items</li>` : '')
      : `<li class="lg-empty">${emptyText(q, ql)}</li>`;
    countEl.innerHTML = hits.length
      ? `${hits.length} ${hits.length === 1 ? 'item' : 'items'}${filterCat ? ` in ${cat(filterCat).label}` : ''} <span aria-hidden="true">·</span> your share <b class="money">${money(sum)}</b>`
      : '';
  }

  const moreCats = root.querySelector('.lg-more');
  moreCats?.addEventListener('click', () => {
    const ul = root.querySelector('.lg-cats');
    ul.classList.toggle('short');
    moreCats.textContent = ul.classList.contains('short') ? `Show all ${nRows} categories` : 'Show fewer';
  });
  listEl.addEventListener('click', (e) => {
    if (!e.target.closest('.lg-rest')) return;
    showAll = true;
    render();
    listEl.querySelector(`.lg-row[data-id="${entries.find((x) => !LEAD.includes(x.id))?.id}"]`)?.setAttribute('tabindex', '-1');
    listEl.querySelector('.lg-row[tabindex="-1"]')?.focus({ preventScroll: true });
  });
  // phones: the list sits under the who-paid rows; after a tap, bring the filtered bills into view
  const phone = matchMedia('(max-width: 879px)');
  const reveal = () => {
    if (!phone.matches) return;
    const r = listEl.getBoundingClientRect();
    if (r.top > innerHeight * 0.72) window.scrollBy({ top: r.top - innerHeight * 0.45, behavior: reduced() ? 'auto' : 'smooth' });
  };
  input.addEventListener('input', () => { if (input.value.trim()) { filterCat = null; filterPay = null; } render(); });
  root.querySelectorAll('.lg-pay').forEach((b) => b.addEventListener('click', () => {
    setPay(filterPay === b.dataset.pay ? null : b.dataset.pay);
    if (filterPay) reveal();
  }));
  function setPay(k, flashId) {
    filterPay = k;
    input.value = '';
    filterCat = null;
    render();
    // "See your share" from the scan: the row it talks about lights up once
    const row = flashId && listEl.querySelector(`.lg-row[data-id="${flashId}"]`);
    if (row) { row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
  }
  // the search column keeps its unfiltered height, so a search or an empty result never shrinks the card
  const findEl = root.querySelector('.lg-find');
  const lockHeight = () => {
    if (input.value.trim() || filterPay || filterCat || showAll) return;
    findEl.style.minHeight = '';
    findEl.style.minHeight = `${findEl.offsetHeight}px`;
  };
  // a tapped chip shows its results; only keyboard or mouse users get the caret (no soft keyboard over the results)
  const finePointer = matchMedia('(pointer: fine)');
  root.querySelectorAll('.chip-q').forEach((b) => b.addEventListener('click', (e) => {
    input.value = b.dataset.q; filterCat = null; render();
    if (e.detail === 0 || finePointer.matches) input.focus({ preventScroll: true });
  }));
  root.querySelectorAll('button.lg-cat').forEach((b) => b.addEventListener('click', () => {
    filterCat = filterCat === b.dataset.cat ? null : b.dataset.cat;
    if (filterCat) input.value = '';
    render();
  }));
  render();
  if (opts.byPayer) {
    lockHeight();
    let rz = 0;
    addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(lockHeight); });
    document.fonts?.ready.then(lockHeight);
  }


  // count up the headline figure the first time it is seen
  // never shows $0.00: starts at 60% of the total, as soon as the figure itself is on screen
  // the real figure is always in the DOM (screen readers, find-in-page); only an aria-hidden copy counts,
  // and it starts as soon as any part of the card is on screen (not the 40px figure itself)
  const totalEl = root.querySelector('.lg-n');
  if (!reduced()) {
    const from = Math.round(spent * 0.6);
    totalEl.textContent = money(from);
    root.classList.add('pre');
    onVisible(root, async () => {
      root.classList.add('counting');
      root.classList.remove('pre');
      await countMoney(totalEl, from, spent, 800);
      root.classList.remove('counting');
    }, { threshold: 0 });
  }
  // home: item search is the idea people miss, so it shows itself once. When the ledger is 40% on screen,
  // "towels" types into the field, the matching line shows, then it clears. Never takes focus; any touch,
  // key or click in the ledger stops it; skipped with reduced motion.
  if (opts.demoSearch && !reduced() && 'IntersectionObserver' in window) {
    let stop = false;
    const halt = () => { stop = true; };
    ['pointerdown', 'keydown', 'focusin'].forEach((t) => root.addEventListener(t, halt, { once: true }));
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const q = opts.demoSearch;
      await new Promise((r) => setTimeout(r, 700));
      root.classList.add('demoing');
      countEl.setAttribute('aria-live', 'off');
      // the list follows only once the word is distinctive ("towe"): short prefixes match many lines and would
      // make the card grow and shrink under the reader
      for (let i = 1; i <= q.length && !stop; i += 1) {
        input.value = q.slice(0, i);
        if (i >= Math.min(4, q.length)) { filterCat = null; filterPay = null; render(); }
        await new Promise((r) => setTimeout(r, 80));
      }
      await new Promise((r) => setTimeout(r, 2500));
      root.classList.remove('demoing');
      countEl.setAttribute('aria-live', 'polite');
      if (stop || input.value !== q) return;
      input.value = ''; render();
    }, { threshold: 0.4 });
    io.observe(root);
  }
  return { data, setPay, root };
}
