/* scenarios.js: dinner (shared, tax + tip proportional), just yours (item search + categories + real app video),
 * every month (itemized rent, schedule modes, a subscription). All amounts come from the kit's engine. */
import { PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { distributeEqually } from '../../_kit/split-engine.js';
import { $, $$, esc, money, ICON, avatar, onceVisible, reduced, sleep } from './util.js';
import { loadModel, compute, SAMPLES, dateLabel, splitLabel } from './data.js';
import { STORE_ICON } from './scan-demo.js';

export async function initScenarios() {
  await Promise.all([dinner(), search(), rent()]);
  video();
}

/* ---------- dinner ---------- */
async function dinner() {
  const el = $('#dinner');
  if (!el) return;
  const m = await loadModel('taqueria-sol');
  const r = compute(m);
  const tip = r.items.find((x) => x.itemType === 'Tip');
  const ppl = m.people;
  // one quiet palette here: ink for you, slate for friends
  const tone = (p, i) => (p === 'you' ? '#0f1f3d' : ['#3d4e6c', '#6b7891'][(i - 1) % 2]);
  const cols = ppl.map((p, i) => `<div class="dn-col">
      <div class="dn-who">${avatar({ ...PEOPLE[p], color: tone(p, i) })}${esc(PEOPLE[p].name)}</div>
      <div class="dn-lines"><div class="x"><span>Tip share</span><span class="money">${money(tip.shares[p])}</span></div></div>
      <div class="dn-tot"><span>Total</span><span class="money">${money(r.people[p].cents)}</span></div>
    </div>`).join('');
  el.innerHTML = `<div class="panel dinner">
    <div class="dn-head"><strong>Taqueria Sol</strong><span>${money(r.totalCents)} · tax and ${money(tip.totalCents)} tip</span></div>
    <div class="dn-tip">
      <p><strong>Tip ${money(tip.totalCents)}</strong>, split by what each person ordered</p>
      <div class="dn-bar" role="img" aria-label="${ppl.map((p) => `${PEOPLE[p].name} ${money(tip.shares[p])}`).join(', ')}">
        ${ppl.map((p, i) => `<span style="--c:${tone(p, i)};--w:${(100 * tip.shares[p]) / tip.totalCents}%">${esc(PEOPLE[p].name)} ${money(tip.shares[p])}</span>`).join('')}
      </div>
    </div>
    <div class="dn-cols">${cols}</div>
  </div>`;
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
      if (!mine) return;
      index.push({ name: l.pretty, merchant: m.merchant, date: m.date, cat: l.category, mine, total: it.totalCents, shared: Object.keys(it.shares).length > 1 });
    });
  }
  const ph = await loadModel('corner-pharmacy');
  const phr = compute(ph);
  const cats = Object.entries(phr.people.you.byCategory).sort((a, b) => b[1] - a[1]);

  el.classList.add('panel');
  el.innerHTML = `
    <label class="sd-input">${ICON.search}<span class="visually-hidden">Search your items</span>
      <input type="search" placeholder="Search items, stores, categories" autocomplete="off" spellcheck="false"></label>
    <div class="sd-chips" aria-label="Try">${['sunscreen', 'milk', 'household', 'rent'].map((q) => `<button type="button">${q}</button>`).join('')}</div>
    <div class="sd-results" aria-live="polite"></div>
    <div class="sd-cats">
      <div class="sd-cats-h"><span>Corner Pharmacy · ${dateLabel(ph.date)} · just you</span><strong class="money">${money(phr.totalCents)}</strong></div>
      <div class="cat-bar" role="img" aria-label="${cats.map(([c, v]) => `${CATEGORIES[c].label} ${money(v)}`).join(', ')}">${cats.map(([c, v]) => `<i style="--c:${CATEGORIES[c].color};--w:${(100 * v) / phr.totalCents}%"></i>`).join('')}</div>
      <div class="cat-legend">${cats.map(([c, v]) => `<span><i class="dot" style="--c:${CATEGORIES[c].color}"></i>${CATEGORIES[c].label} <b class="money">${money(v)}</b></span>`).join('')}</div>
    </div>`;
  const input = $('input', el);
  const out = $('.sd-results', el);
  const show = (q) => {
    const t = q.trim().toLowerCase();
    if (!t) { out.innerHTML = '<p class="sd-empty">Every item you have a share in.</p>'; return; }
    const hits = index.filter((x) => `${x.name} ${x.merchant} ${CATEGORIES[x.cat]?.label}`.toLowerCase().includes(t)).slice(0, 4);
    out.innerHTML = hits.length ? hits.map((x) => `<div class="sd-r"><span class="dot" style="--c:${CATEGORIES[x.cat]?.color}"></span>
      <span class="nm">${esc(x.name)}</span><span class="meta">${esc(x.merchant)} · ${dateLabel(x.date).replace(/, \d{4}$/, '')} · ${esc(CATEGORIES[x.cat]?.label)}</span>
      <span class="amt"><strong class="money">${money(x.mine)}</strong>${x.shared ? `<small class="money">of ${money(x.total)}</small>` : '<small>yours</small>'}</span></div>`).join('')
      : `<p class="sd-empty">Nothing called "${esc(q)}" yet.</p>`;
  };
  input.addEventListener('input', () => show(input.value));
  $$('.sd-chips button', el).forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; show(input.value); }));
  show('');
  // type the first query once, when it comes into view
  onceVisible(el, async () => {
    if (input.value) return;
    const q = 'sunscreen';
    if (reduced()) { input.value = q; show(q); return; }
    for (let i = 1; i <= q.length; i += 1) {
      if (document.activeElement === input) return;
      input.value = q.slice(0, i); show(input.value);
      await sleep(70);
    }
  }, { threshold: 0.6 });
}

/* ---------- rent ---------- */
async function rent() {
  const el = $('#rent');
  if (!el) return;
  const m = await loadModel('monthly-rent');
  const r = compute(m);
  const you = r.people.you.cents;
  const nf = distributeEqually(1799, 4);
  const lines = m.lines.map((l, i) => {
    const it = r.items.find((x) => x.index === i);
    const yours = it.shares.you || 0;
    return `<div class="rent-line" style="--c:${CATEGORIES[l.category].color}"><span class="cat"></span>
      <span class="nm">${esc(l.pretty.replace(/ november$/i, ''))}</span><span class="how">${esc(splitLabel(l))}</span>
      <span class="amt"><strong class="money">${yours ? money(yours) : '—'}</strong><small class="money">of ${money(it.totalCents)}</small></span></div>`;
  }).join('');
  el.innerHTML = `<div class="panel rent">
    <div class="rent-head"><span class="rent-ico">${STORE_ICON.home}</span>
      <div><strong>Monthly rent</strong><small>${ICON.repeat.replace('width="18" height="18"', 'width="14" height="14" style="display:inline;vertical-align:-2px"')} Every month on the 1st</small></div>
      <span class="money">${money(r.totalCents)}</span></div>
    <div class="rent-lines">${lines}</div>
    <div class="rent-you"><span>Your share, every month</span><strong class="money">${money(you)}</strong></div>
    <div class="sched">
      <div class="sched-top"><p>Next months</p>
        <div class="mini-seg" role="group" aria-label="When it repeats">
          <button type="button" data-mode="auto" aria-pressed="true">Add it for me</button>
          <button type="button" data-mode="review" aria-pressed="false">Ask me first</button>
        </div></div>
      <div class="months" aria-live="polite"></div>
    </div>
    <div class="netflix"><span class="rent-ico">${ICON.repeat}</span>
      <div><strong>Netflix</strong><small class="money">${money(1799)} a month · 4 ways</small></div>
      <div class="amt"><strong class="money">${money(nf[0])}</strong><small>yours</small></div></div>
  </div>`;
  const months = $('.months', el);
  const drawMonths = (mode) => {
    const ms = [['Nov 1', true], ['Dec 1', false], ['Jan 1', false]];
    months.innerHTML = ms.map(([d, past]) => {
      const cls = past ? (mode === 'auto' ? 'added' : 'review') : '';
      const st = past ? (mode === 'auto' ? 'Added' : 'Waiting for you') : (mode === 'auto' ? 'Adds itself' : 'Asks you');
      return `<div class="month ${cls}"><b>${d}</b><span class="money">${money(you)}</span><span class="st">${st}</span></div>`;
    }).join('');
  };
  drawMonths('auto');
  $$('.mini-seg button', el).forEach((b) => b.addEventListener('click', () => {
    $$('.mini-seg button', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawMonths(b.dataset.mode);
  }));
}

/* ---------- real app video ---------- */
function video() {
  const v = $('#ledger-video');
  const btn = $('#video-btn');
  if (!v || !btn) return;
  let userPaused = reduced();
  const sync = () => {
    const playing = !v.paused;
    btn.innerHTML = playing ? ICON.pause : ICON.play;
    btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    btn.setAttribute('aria-pressed', String(playing));
  };
  v.addEventListener('play', sync); v.addEventListener('pause', sync);
  sync();
  btn.addEventListener('click', () => {
    if (v.paused) { userPaused = false; v.play().catch(() => {}); } else { userPaused = true; v.pause(); }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && !userPaused) { v.preload = 'auto'; v.play().catch(() => {}); } else if (!e.isIntersecting) v.pause();
      });
    }, { threshold: 0.4 }).observe(v);
  }
}
