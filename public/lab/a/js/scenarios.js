/* scenarios.js: the search inside the month card. Typing (or a chip) filters the same card down to items: only what is
 * yours (your share of shared lines), from every sample receipt plus a short made-up history. Clearing the box brings
 * the month back. Green Basket follows the split above (story.js sends your share of each line). */
import { $, $$, esc, money, onceVisible } from './util.js';
import { loadModel, compute, SAMPLES, dateLabel } from './data.js';

/* Earlier receipts in the same made-up account (amounts in cents, your share first), so a search finds a habit, not one line. */
const HISTORY = [
  { name: 'Oat milk latte', merchant: 'Corner Café', date: '2026-10-27', cat: 'dining', mine: 525, total: 525 },
  { name: 'Whole milk ½ gal', merchant: 'Value Mart', date: '2026-10-22', cat: 'groceries', mine: 71, total: 284 },
  { name: 'Paper towels 6pk', merchant: 'Home supplies', date: '2026-10-25', cat: 'household', mine: 325, total: 1299 },
  { name: 'Dish soap', merchant: 'Home supplies', date: '2026-10-25', cat: 'household', mine: 112, total: 449 },
  { name: 'Sunscreen stick SPF30', merchant: 'Corner Pharmacy', date: '2026-07-12', cat: 'personal-care', mine: 749, total: 749 },
  { name: 'Sunscreen SPF50 2pk', merchant: 'Green Basket Market', date: '2026-06-03', cat: 'personal-care', mine: 450, total: 1800 },
];
const CAT_LABEL = { groceries: 'groceries', household: 'household', 'personal-care': 'personal care', health: 'health', dining: 'dining', rent: 'rent', utilities: 'utilities', internet: 'internet', parking: 'parking' };
const ICO = {
  basket: '<path d="M4 9h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8zM8.5 9l3-5m4 5l-3-5"/>',
  cup: '<path d="M5 10h12v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 4.5v2.5M11.5 4.5v2.5"/>',
  home: '<path d="M4 11l8-6.5 8 6.5M6.5 9.5V20h11V9.5"/>',
  bottle: '<path d="M10 3h4v3.2l1.6 2.3a2 2 0 0 1 .4 1.2V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9.7a2 2 0 0 1 .4-1.2L10 6.2zM8 13h8"/>',
};
const icoFor = (cat) => ({ dining: 'cup', household: 'home', rent: 'home', utilities: 'home', internet: 'home', parking: 'home', 'personal-care': 'bottle', health: 'bottle' }[cat] || 'basket');
const CHIPS = ['sunscreen', 'milk', 'household'];
const CAP = 4;

export function initScenarios() {
  const box = $('#search-demo');
  if (!box) return;
  const input = $('input', box);
  const rows = $('#m-rows');
  const hits = $('#m-hits');
  const live = $('#m-live');
  const card = $('#month');
  const head = $('.m-k', card);
  const total = $('#m-total', card);
  // results sit in a box as tall as the month's four rows, so a short (or empty) result never makes the page below jump
  let rowsH = 0;
  box.insertAdjacentHTML('beforeend', `<div class="sd-chips" role="group" aria-label="Try a search">${CHIPS.map((q) => `<button type="button" aria-pressed="false">${q}</button>`).join('')}</div>`);
  let index = null;
  let loading = null;
  // your share of each Green Basket line, live from the story (null until the story speaks: the defaults stand)
  let gb = window.__tzSplit?.mine || null;
  document.addEventListener('tz:share', (e) => { gb = e.detail.mine || gb; if (input.value.trim()) show(input.value, { announce: false }); });

  // the index needs every sample receipt: fetch them only as the card comes near, or on the first keystroke
  const load = () => (loading ||= (async () => {
    const out = [];
    for (const s of SAMPLES) {
      const m = await loadModel(s.id);
      const r = compute(m);
      m.lines.forEach((l, i) => {
        const it = r.items.find((x) => x.index === i);
        // a monthly bill is dated this month's 1st, so every answer is spending that already happened (the page is Oct 29)
        out.push({ id: s.id, name: l.pretty, merchant: m.merchant, date: s.recurring ? '2026-10-01' : m.date, cat: l.category, mine: it?.shares?.you || 0, total: it?.totalCents || 0, i, monthly: !!s.recurring });
      });
    }
    HISTORY.forEach((h, k) => out.push({ ...h, i: 100 + k }));
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.i - b.i);
    index = out;
  })());
  onceVisible(box, load, { threshold: 0, rootMargin: '0px 0px 900px 0px' });

  let liveT = 0;
  async function show(q, { announce = true } = {}) {
    const t = q.trim().toLowerCase();
    $$('.sd-chips button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === t)));
    if (!t) {
      hits.hidden = true; rows.hidden = false; hits.innerHTML = ''; clearTimeout(liveT);
      if (card.classList.contains('is-search')) { card.classList.remove('is-search'); card.__month?.(); }
      return;
    }
    if (!rows.hidden) rowsH = rows.offsetHeight;
    await load();
    if (input.value.trim().toLowerCase() !== t) return; // a newer keystroke won
    const mineOf = (x) => (x.id === 'green-basket' && gb ? gb[x.i] || 0 : x.mine);
    const all = index.filter((x) => mineOf(x) > 0 && `${x.name} ${x.merchant} ${CAT_LABEL[x.cat] || ''}`.toLowerCase().includes(t));
    const found = all.slice(0, CAP);
    hits.innerHTML = found.length ? found.map((x) => {
      const mine = mineOf(x);
      const shared = x.total !== mine;
      return `<li class="m-row"><span class="m-ico"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[icoFor(x.cat)]}</svg></span>
        <span class="m-t">${esc(x.name)}<small>${x.monthly ? 'Repeats monthly' : esc(x.merchant)} · ${dateLabel(x.date).replace(/, \d{4}$/, '')}</small></span>
        <span class="m-a"><strong class="money">${money(mine)}</strong>${shared ? `<small class="money">of ${money(x.total)}</small>` : ''}</span></li>`;
    }).join('') : `<li class="m-empty">None of your items match "${esc(q.trim())}".</li>`;
    rows.hidden = true; hits.hidden = false;
    if (rowsH) hits.style.minHeight = `${rowsH}px`;
    // a search is an all-time question: the header and the big number answer it (your share of exactly the rows shown)
    card.classList.add('is-search');
    const n = found.length;
    head.textContent = all.length > CAP ? `Latest ${CAP} of ${all.length} items` : `${n || 'No'} item${n === 1 ? '' : 's'} · all time`;
    total.textContent = money(found.reduce((a, x) => a + mineOf(x), 0));
    // one short summary for screen readers, once typing pauses (not every row on every keystroke)
    clearTimeout(liveT);
    if (announce) liveT = setTimeout(() => { live.textContent = `${found.length || 'No'} item${found.length === 1 ? '' : 's'} for ${t}`; }, 400);
  }
  input.addEventListener('input', () => show(input.value));
  // a pressed chip clears the search (the month comes back)
  $$('.sd-chips button', box).forEach((b) => b.addEventListener('click', () => {
    input.value = b.getAttribute('aria-pressed') === 'true' ? '' : b.textContent;
    show(input.value);
  }));
}
