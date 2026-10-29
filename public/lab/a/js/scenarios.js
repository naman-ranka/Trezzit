/* scenarios.js: "One place for everything you spend": every month (rent by room, bills four ways, parking just
 * Jordan's; a toggle re-splits the rent) and just yours (item search across every sample receipt, plus the pharmacy's
 * categories). All amounts come from the kit's engine. */
import { PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { $, $$, esc, money, ICON, avatar } from './util.js';
import { loadModel, compute, SAMPLES, dateLabel, RAMP, lineMembers } from './data.js';

export async function initScenarios() {
  await Promise.all([rent(), search()]);
}

/* ---------- rent: by room or equally, re-split by the engine ---------- */
async function rent() {
  const el = $('#rent');
  if (!el) return;
  const m = await loadModel('monthly-rent');
  const byRoom = JSON.parse(JSON.stringify(m.lines[0].split));
  const ppl = m.people;
  // rent, the bills (water, trash, internet) and parking, as three rows
  const GROUPS = [
    { name: 'Rent', ix: [0] },
    { name: 'Bills', ix: m.lines.map((l, i) => (['utilities', 'internet'].includes(l.category) ? i : -1)).filter((i) => i >= 0) },
    { name: 'Parking', ix: m.lines.map((l, i) => (l.category === 'parking' ? i : -1)).filter((i) => i >= 0) },
  ];
  el.innerHTML = `<div class="panel rent">
    <div class="rn-head"><strong>Rent and bills</strong><span class="rn-rep">${ICON.repeat}Repeats on the 1st</span></div>
    <div class="rn-rows"></div>
    <div class="rn-people">${ppl.map((p) => `<div class="rn-p${p === 'you' ? ' is-you' : ''}" data-p="${p}">${avatar(p === 'you' ? { ...PEOPLE[p], color: '#fff' } : PEOPLE[p])}<span class="nm">${esc(PEOPLE[p].name)}</span><span class="amt money"></span></div>`).join('')}</div>
    <p class="visually-hidden" aria-live="polite" data-live></p>
  </div>`;
  const rowsEl = $('.rn-rows', el);
  const live = $('[data-live]', el);
  let mode = 'room';
  const render = () => {
    m.lines[0].split = mode === 'room' ? JSON.parse(JSON.stringify(byRoom)) : { type: 'equal', people: [...ppl] };
    const r = compute(m);
    const how = (g) => {
      if (g.name === 'Rent') return '';
      const who = lineMembers(m.lines[g.ix[0]]);
      return who.length === 1 ? `Just ${PEOPLE[who[0]].name}` : `${who.length} ways`;
    };
    rowsEl.innerHTML = GROUPS.map((g) => {
      const sum = g.ix.reduce((a, i) => a + r.items[i].totalCents, 0);
      const ctl = g.name === 'Rent' ? `<span class="mini-seg" role="group" aria-label="Split the rent">
          <button type="button" data-m="room" aria-pressed="${mode === 'room'}">By room</button><button type="button" data-m="equal" aria-pressed="${mode === 'equal'}">Equally</button></span>` : `<small>${esc(how(g))}</small>`;
      return `<div class="rn-r"><span class="nm">${g.name}</span>${ctl}<span class="money">${money(sum)}</span></div>`;
    }).join('');
    ppl.forEach((p) => { $(`.rn-p[data-p="${p}"] .amt`, el).textContent = money(r.people[p].cents); });
    const sum = ppl.reduce((a, p) => a + r.people[p].cents, 0);
    if (sum !== r.totalCents) console.error('[lab/a] rent split does not add up', sum, r.totalCents);
    return r;
  };
  rowsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === mode) return;
    mode = b.dataset.m;
    const r = render();
    $(`[data-m="${mode}"]`, rowsEl)?.focus();
    live.textContent = `Rent ${mode === 'room' ? 'by room' : 'equally'}: ${ppl.map((p) => `${PEOPLE[p].name} ${money(r.people[p].cents)}`).join(', ')}.`;
  });
  render();
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
      if (!it) return;
      const mine = it.shares?.you || 0;
      const who = Object.keys(it.shares || {}).filter((p) => (it.shares[p] || 0) > 0);
      // lines that are someone else's stay findable too, marked as theirs
      const owner = !mine ? (who.length === 1 ? `${PEOPLE[who[0]]?.name || 'Someone'}’s` : 'Not yours') : '';
      index.push({ id: s.id, name: l.pretty, merchant: m.merchant, date: m.date, cat: l.category, mine, total: it.totalCents, shared: who.length > 1, owner, i });
    });
  }
  const ph = await loadModel('corner-pharmacy');
  const phr = compute(ph);
  const cats = Object.entries(phr.people.you.byCategory).sort((a, b) => b[1] - a[1]);

  el.classList.add('panel');
  el.innerHTML = `
    <label class="sd-input">${ICON.search}<span class="visually-hidden">Search your items</span>
      <input type="search" placeholder="Search items, stores, categories" autocomplete="off" spellcheck="false"></label>
    <div class="sd-chips" role="group" aria-label="Try a search">${['sunscreen', 'milk', 'household', 'rent'].map((q) => `<button type="button">${q}</button>`).join('')}</div>
    <div class="sd-results" aria-live="polite" aria-atomic="true"></div>
    <div class="sd-cats">
      <div class="sd-cats-h"><span>Corner Pharmacy · ${dateLabel(ph.date).replace(/, \d{4}$/, '')} · just you</span><strong class="money">${money(phr.totalCents)}</strong></div>
      <div class="cat-bar" role="img" aria-label="${cats.map(([c, v]) => `${CATEGORIES[c].label} ${money(v)}`).join(', ')}">${cats.map(([c, v], k) => `<i style="--c:${RAMP[k % RAMP.length]};--w:${(100 * v) / phr.totalCents}%"></i>`).join('')}</div>
      <div class="cat-legend">${cats.map(([c, v], k) => `<span><i class="dot" style="--c:${RAMP[k % RAMP.length]}"></i>${CATEGORIES[c].label} <b class="money">${money(v)}</b></span>`).join('')}</div>
    </div>`;
  const input = $('input', el);
  const out = $('.sd-results', el);
  const catsEl = $('.sd-cats', el);
  // an empty box shows your three newest items; the card is as tall as its results (no reserved empty band)
  const newest = index.filter((x) => x.mine).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.i - b.i).slice(0, 3);
  const show = (q) => {
    const t = q.trim().toLowerCase();
    // your own items first, then everyone else's
    const hits = t ? index.filter((x) => `${x.name} ${x.merchant} ${CATEGORIES[x.cat]?.label}`.toLowerCase().includes(t)).sort((a, b) => (b.mine > 0) - (a.mine > 0)).slice(0, 3) : newest;
    out.innerHTML = hits.length ? hits.map((x) => `<div class="sd-r"><span class="dot" style="--c:${CATEGORIES[x.cat]?.color}"></span>
      <span class="nm">${esc(x.name)}</span><span class="meta">${esc(x.merchant)} · ${dateLabel(x.date).replace(/, \d{4}$/, '')}</span>
      <span class="amt${x.mine ? '' : ' is-theirs'}"><strong class="money">${money(x.mine)}</strong>${x.owner ? `<small>${esc(x.owner)}</small>` : x.shared ? `<small class="money">of ${money(x.total)}</small>` : '<small>yours</small>'}</span></div>`).join('')
      : `<p class="sd-empty">No item matches "${esc(q)}".</p>`;
    $$('.sd-chips button', el).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === t)));
    // the pharmacy's breakdown belongs to pharmacy results only, so it never reads as the answer to another search
    catsEl.hidden = !(hits.length && hits.every((x) => x.id === 'corner-pharmacy'));
  };
  input.addEventListener('input', () => show(input.value));
  $$('.sd-chips button', el).forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; show(input.value); }));
  // it opens on the headline's own search, already answered, so its height never changes on its own
  input.value = 'sunscreen';
  show(input.value);
}
