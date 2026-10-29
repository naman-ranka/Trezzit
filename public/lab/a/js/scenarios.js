/* scenarios.js: "One place for everything you spend". Beside the real app's month (index.html), an item search
 * across every sample receipt: only what is yours (your share of shared lines). All amounts come from the kit's engine. */
import { CATEGORIES } from '../../_kit/receipts.js';
import { $, $$, esc, money, ICON, onceVisible } from './util.js';
import { loadModel, compute, SAMPLES, dateLabel } from './data.js';

/* Earlier receipts in the same made-up account (amounts in cents, your share first), so a search finds a habit, not
 * one line: the café and Value Mart bills are the ones on the app screenshot beside the search. */
const HISTORY = [
  { name: 'Oat milk latte', merchant: 'Corner Café', date: '2026-10-27', cat: 'dining', mine: 525, total: 525 },
  { name: 'Whole milk ½ gal', merchant: 'Value Mart', date: '2026-10-22', cat: 'groceries', mine: 71, total: 284 },
  { name: 'Paper towels 6pk', merchant: 'Home supplies', date: '2026-10-25', cat: 'household', mine: 325, total: 1299 },
  { name: 'Dish soap', merchant: 'Home supplies', date: '2026-10-25', cat: 'household', mine: 112, total: 449 },
  { name: 'Sunscreen stick SPF30', merchant: 'Corner Pharmacy', date: '2026-07-12', cat: 'personal-care', mine: 749, total: 749 },
  { name: 'Sunscreen SPF50 2pk', merchant: 'Green Basket Market', date: '2026-06-03', cat: 'personal-care', mine: 450, total: 1800 },
];

// the index needs every sample receipt: fetch them only as the search comes near (the first screen loads one receipt)
export function initScenarios() {
  const el = $('#search-demo');
  if (el) onceVisible(el, search, { threshold: 0, rootMargin: '0px 0px 900px 0px' });
}

/* ---------- search ---------- */
async function search() {
  const el = $('#search-demo');
  if (!el) return;
  const index = [];
  for (const s of SAMPLES) {
    const m = await loadModel(s.id);
    const r = compute(m);
    m.lines.forEach((l, i) => {
      const it = r.items.find((x) => x.index === i);
      const mine = it?.shares?.you || 0;
      // your spending only: a line with no share of yours is someone else's, not a $0.00 row
      if (!mine) return;
      const shared = Object.values(it.shares || {}).filter((c) => c > 0).length > 1;
      // a monthly bill is dated this month's 1st, so every answer is spending that already happened (the page is Oct 29)
      index.push({ id: s.id, name: l.pretty, merchant: m.merchant, date: s.recurring ? '2026-10-01' : m.date, cat: l.category, mine, total: it.totalCents, shared, i, monthly: !!s.recurring });
    });
  }
  HISTORY.forEach((h, k) => index.push({ ...h, shared: h.total !== h.mine, i: 100 + k }));
  // newest first, so every answer reads like the ledger
  index.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.i - b.i);

  el.classList.add('panel');
  el.innerHTML = `
    <label class="sd-input">${ICON.search}<span class="visually-hidden">Search your items</span>
      <input type="search" placeholder="Search items, stores, categories" autocomplete="off" spellcheck="false"></label>
    <div class="sd-chips" role="group" aria-label="Try a search">${['sunscreen', 'rent', 'milk', 'household'].map((q) => `<button type="button">${q}</button>`).join('')}</div>
    <div class="sd-results"></div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;
  const input = $('input', el);
  const out = $('.sd-results', el);
  const live = $('[data-live]', el);
  let liveT = 0;
  // always three rows tall (results are capped at three, and every chip finds three), so typing never moves the page
  const DEFAULT = 'sunscreen';
  const show = (q, { announce = true } = {}) => {
    // an empty box goes back to the opening answer (sunscreen), with its chip pressed
    const t = q.trim().toLowerCase() || DEFAULT;
    const hits = index.filter((x) => `${x.name} ${x.merchant} ${CATEGORIES[x.cat]?.label}`.toLowerCase().includes(t)).slice(0, 3);
    out.innerHTML = hits.length ? hits.map((x) => `<div class="sd-r"><span class="dot" style="--c:${CATEGORIES[x.cat]?.color}"></span>
      <span class="nm">${esc(x.name)}</span><span class="meta">${x.monthly ? 'Repeats monthly' : esc(x.merchant)} · ${dateLabel(x.date).replace(/, \d{4}$/, '')}</span>
      <span class="amt"><strong class="money">${money(x.mine)}</strong>${x.shared ? `<small class="money">of ${money(x.total)}</small>` : '<small>yours</small>'}</span></div>`).join('')
      : `<p class="sd-empty">None of your items match "${esc(q)}".</p>`;
    $$('.sd-chips button', el).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === t)));
    // one short summary for screen readers, once typing pauses (not every row on every keystroke)
    clearTimeout(liveT);
    if (announce) liveT = setTimeout(() => { live.textContent = `${hits.length || 'No'} result${hits.length === 1 ? '' : 's'} for ${t}`; }, 400);
  };
  input.addEventListener('input', () => show(input.value));
  $$('.sd-chips button', el).forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; show(input.value); }));
  // it opens on the headline's own search, already answered, so its height never changes on its own
  input.value = DEFAULT;
  show(input.value, { announce: false });
}
