/* ledger-demo.js: "Understand". Your share only, sorted by category, with
 * this-vs-last-month and item-level search across every bill. */
import { CATEGORIES, PEOPLE, LAST_MONTH, octoberLedger } from './data.js';
import { esc, money, icon, onVisible, countMoney, reduced } from './util.js';

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
  const { entries, byCat, spent, paid, last } = data;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats[0][1];
  const delta = spent - last;
  root.classList.add('ledger');
  root.innerHTML = `
    <div class="lg-sum">
      <p class="lg-label">Spent in October <span class="lg-tag">Your share only</span></p>
      <p class="lg-total money" aria-live="off">${money(spent)}</p>
      <p class="lg-sub">You paid ${money(paid)} <span aria-hidden="true">·</span> <span class="${delta < 0 ? 'down' : 'up'}">${money(Math.abs(delta))} ${delta < 0 ? 'less' : 'more'} than September</span></p>
      <div class="lg-bar" aria-hidden="true">${cats.map(([k, c]) => `<i style="--c:${cat(k).color};--w:${(c / spent) * 100}%"></i>`).join('')}</div>
      <ul class="lg-cats short" role="list" aria-label="By category">
        ${cats.map(([k, c]) => {
          const prev = LAST_MONTH[k] || 0;
          const d = c - prev;
          const dTxt = prev === 0 ? 'new' : d === 0 ? 'same' : `${d < 0 ? '−' : '+'}${money(Math.abs(d))}`;
          return `<li><button type="button" class="lg-cat" data-cat="${k}" aria-pressed="false">
            <span class="lg-ci" style="--c:${cat(k).color}">${catIcon(k)}</span>
            <span class="lg-cn">${cat(k).label}</span>
            <span class="lg-cb" aria-hidden="true"><i style="--c:${cat(k).color};--w:${(c / max) * 100}%"></i></span>
            <b class="money">${money(c)}</b>
            <span class="lg-cd ${prev === 0 ? 'new' : d < 0 ? 'down' : d > 0 ? 'up' : ''}" title="vs September">${dTxt}</span>
          </button></li>`;
        }).join('')}
      </ul>
      <button type="button" class="c-link-btn lg-more">Show all ${cats.length} categories</button>
    </div>
    <div class="lg-find">
      <label class="lg-search">${icon.search}<span class="visually-hidden">Search your spending</span>
        <input type="search" placeholder="Search items, stores, categories" autocomplete="off" spellcheck="false"></label>
      <p class="lg-try"><span>Try</span>${['towels', 'cold brew', 'Taqueria', 'rent'].map((q) => `<button type="button" class="chip-q" data-q="${q}">${q}</button>`).join('')}</p>
      <p class="lg-count" aria-live="polite"></p>
      <ul class="lg-list" role="list"></ul>
    </div>`;

  const input = root.querySelector('input');
  const listEl = root.querySelector('.lg-list');
  const countEl = root.querySelector('.lg-count');
  let filterCat = null;

  const allLines = entries.flatMap((e) => e.lines.map((l) => ({ ...l, entry: e })));

  function entryRow(e) {
    const k = MAIN_CAT(e);
    const who = e.payer === 'you' ? 'you paid' : `${e.payer} paid`;
    return `<li class="lg-row">
      <span class="lg-ri" style="--c:${cat(k).color}">${e.kind === 'recurring' ? `<span class="lg-rec" title="Recurring">${icon.repeat}</span>` : ''}${catIcon(k)}</span>
      <span class="lg-rt"><b>${esc(e.title)}</b><small>${esc(e.group)} · ${e.date} · ${who}</small></span>
      <span class="lg-ra"><b class="money">${money(e.youCents)}</b>${e.totalCents !== e.youCents ? `<small class="money">of ${money(e.totalCents)}</small>` : ''}</span></li>`;
  }
  function lineRow(l, q) {
    const name = q ? esc(l.name).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>') : esc(l.name);
    return `<li class="lg-row lg-item">
      <span class="lg-ri sm" style="--c:${cat(l.cat).color}">${catIcon(l.cat)}</span>
      <span class="lg-rt"><b>${name}</b><small>${esc(l.entry.title)} · ${l.entry.date} · ${cat(l.cat).label}</small></span>
      <span class="lg-ra"><b class="money">${money(l.cents)}</b>${l.itemCents !== l.cents ? `<small class="money">of ${money(l.itemCents)}</small>` : ''}</span></li>`;
  }

  function render() {
    const q = input.value.trim();
    const ql = q.toLowerCase();
    root.querySelectorAll('.lg-cat').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === filterCat)));
    if (!q && !filterCat) {
      listEl.innerHTML = entries.slice(0, opts.rows || 6).map(entryRow).join('');
      countEl.textContent = `${entries.length} expenses this month`;
      return;
    }
    const hits = allLines.filter((l) => (!filterCat || l.cat === filterCat)
      && (!ql || l.name.toLowerCase().includes(ql) || l.entry.title.toLowerCase().includes(ql) || cat(l.cat).label.toLowerCase().includes(ql)));
    const sum = hits.reduce((a, l) => a + l.cents, 0);
    listEl.innerHTML = hits.length
      ? hits.slice(0, 8).map((l) => lineRow(l, q)).join('') + (hits.length > 8 ? `<li class="lg-moreline">and ${hits.length - 8} more items</li>` : '')
      : `<li class="lg-empty">No items match “${esc(q)}”.</li>`;
    countEl.innerHTML = hits.length
      ? `${hits.length} ${hits.length === 1 ? 'item' : 'items'}${filterCat ? ` in ${cat(filterCat).label}` : ''} <span aria-hidden="true">·</span> your share <b class="money">${money(sum)}</b>`
      : '';
  }

  const moreCats = root.querySelector('.lg-more');
  moreCats.addEventListener('click', () => {
    const ul = root.querySelector('.lg-cats');
    ul.classList.toggle('short');
    moreCats.textContent = ul.classList.contains('short') ? `Show all ${cats.length} categories` : 'Show fewer';
  });
  input.addEventListener('input', render);
  root.querySelectorAll('.chip-q').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.q; filterCat = null; render(); input.focus({ preventScroll: true }); }));
  root.querySelectorAll('.lg-cat').forEach((b) => b.addEventListener('click', () => {
    filterCat = filterCat === b.dataset.cat ? null : b.dataset.cat;
    if (filterCat) input.value = '';
    render();
  }));
  render();

  // count up the headline figure the first time it is seen
  const totalEl = root.querySelector('.lg-total');
  if (!reduced()) {
    totalEl.textContent = money(0);
    root.classList.add('pre');
    onVisible(root, () => { root.classList.remove('pre'); countMoney(totalEl, 0, spent, 900); }, { threshold: 0.4 });
  }
  return { data };
}
void PEOPLE;
