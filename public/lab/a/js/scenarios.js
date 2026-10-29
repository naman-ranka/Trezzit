/* scenarios.js: "One place for everything you spend". Beside the real app's month (index.html), an item search
 * across every sample receipt: only what is yours (your share of shared lines). All amounts come from the kit's engine. */
import { CATEGORIES } from '../../_kit/receipts.js';
import { $, $$, esc, money, ICON } from './util.js';
import { loadModel, compute, SAMPLES, dateLabel } from './data.js';

export async function initScenarios() {
  await search();
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
      index.push({ id: s.id, name: l.pretty, merchant: m.merchant, date: m.date, cat: l.category, mine, total: it.totalCents, shared, i });
    });
  }

  el.classList.add('panel');
  el.innerHTML = `
    <label class="sd-input">${ICON.search}<span class="visually-hidden">Search your items</span>
      <input type="search" placeholder="Search items, stores, categories" autocomplete="off" spellcheck="false"></label>
    <div class="sd-chips" role="group" aria-label="Try a search">${['sunscreen', 'milk', 'household', 'rent'].map((q) => `<button type="button">${q}</button>`).join('')}</div>
    <div class="sd-results" aria-live="polite" aria-atomic="true"></div>`;
  const input = $('input', el);
  const out = $('.sd-results', el);
  // always two rows tall (results are capped at two), so typing never moves the page under the card
  const newest = index.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.i - b.i).slice(0, 2);
  const show = (q) => {
    const t = q.trim().toLowerCase();
    const hits = t ? index.filter((x) => `${x.name} ${x.merchant} ${CATEGORIES[x.cat]?.label}`.toLowerCase().includes(t)).slice(0, 2) : newest;
    out.innerHTML = hits.length ? hits.map((x) => `<div class="sd-r"><span class="dot" style="--c:${CATEGORIES[x.cat]?.color}"></span>
      <span class="nm">${esc(x.name)}</span><span class="meta">${esc(x.merchant)} · ${dateLabel(x.date).replace(/, \d{4}$/, '')}</span>
      <span class="amt"><strong class="money">${money(x.mine)}</strong>${x.shared ? `<small class="money">of ${money(x.total)}</small>` : '<small>yours</small>'}</span></div>`).join('')
      : `<p class="sd-empty">None of your items match "${esc(q)}".</p>`;
    $$('.sd-chips button', el).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === t)));
  };
  input.addEventListener('input', () => show(input.value));
  $$('.sd-chips button', el).forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; show(input.value); }));
  // it opens on the headline's own search, already answered, so its height never changes on its own
  input.value = 'sunscreen';
  show(input.value);
}
