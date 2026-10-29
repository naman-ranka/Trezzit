/* scenarios.js: dinner (Alex paid; your share still counts; tax + tip proportional), just yours (item search +
 * categories), every month (itemized rent + schedule modes), and the real app recording in the close.
 * All amounts come from the kit's engine. */
import { PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { $, $$, esc, money, ICON, avatar, reduced } from './util.js';
import { loadModel, compute, SAMPLES, dateLabel, splitLabel, RAMP } from './data.js';
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
  const tone = (p, i) => (p === 'you' ? '#0f1f3d' : ['#3d4e6c', '#5f6b82'][(i - 1) % 2]);
  const you = $('#dinner-you');
  if (you) you.textContent = money(r.people.you.cents);
  const cols = ppl.map((p, i) => `<div class="dn-col">
      <div class="dn-who">${avatar({ ...PEOPLE[p], color: tone(p, i) })}${esc(PEOPLE[p].name)}</div>
      <div class="dn-tot"><span>Total</span><span class="money">${money(r.people[p].cents)}</span></div>
    </div>`).join('');
  el.innerHTML = `<div class="panel dinner">
    <div class="dn-head"><strong>Taqueria Sol</strong><span class="dn-paid">${avatar({ ...PEOPLE.alex, color: tone('alex', 1) })}Alex paid <b class="money">${money(r.totalCents)}</b></span></div>
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
      index.push({ name: l.pretty, merchant: m.merchant, date: m.date, cat: l.category, mine, total: it.totalCents, shared: Object.keys(it.shares).length > 1, i });
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
      <div class="sd-cats-h"><span>Corner Pharmacy · ${dateLabel(ph.date)} · just you</span><strong class="money">${money(phr.totalCents)}</strong></div>
      <div class="cat-bar" role="img" aria-label="${cats.map(([c, v]) => `${CATEGORIES[c].label} ${money(v)}`).join(', ')}">${cats.map(([c, v], k) => `<i style="--c:${RAMP[k % RAMP.length]};--w:${(100 * v) / phr.totalCents}%"></i>`).join('')}</div>
      <div class="cat-legend">${cats.map(([c, v], k) => `<span><i class="dot" style="--c:${RAMP[k % RAMP.length]}"></i>${CATEGORIES[c].label} <b class="money">${money(v)}</b></span>`).join('')}</div>
    </div>`;
  const input = $('input', el);
  const out = $('.sd-results', el);
  // an empty box shows your three newest items; the card is as tall as its results (no reserved empty band)
  const newest = [...index].sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.i - b.i).slice(0, 3);
  const show = (q) => {
    const t = q.trim().toLowerCase();
    const hits = t ? index.filter((x) => `${x.name} ${x.merchant} ${CATEGORIES[x.cat]?.label}`.toLowerCase().includes(t)).slice(0, 3) : newest;
    out.innerHTML = hits.length ? hits.map((x) => `<div class="sd-r"><span class="dot" style="--c:${CATEGORIES[x.cat]?.color}"></span>
      <span class="nm">${esc(x.name)}</span><span class="meta">${esc(x.merchant)} · ${dateLabel(x.date).replace(/, \d{4}$/, '')}</span>
      <span class="amt"><strong class="money">${money(x.mine)}</strong>${x.shared ? `<small class="money">of ${money(x.total)}</small>` : '<small>yours</small>'}</span></div>`).join('')
      : `<p class="sd-empty">Nothing called "${esc(q)}" yet.</p>`;
    $$('.sd-chips button', el).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === t)));
  };
  input.addEventListener('input', () => show(input.value));
  $$('.sd-chips button', el).forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; show(input.value); }));
  // it opens on the headline's own search, already answered, so its height never changes on its own
  input.value = 'sunscreen';
  show(input.value);
}

/* ---------- rent ---------- */
async function rent() {
  const el = $('#rent');
  if (!el) return;
  const m = await loadModel('monthly-rent');
  const r = compute(m);
  const you = r.people.you.cents;
  // only the lines you have a share in (parking is Jordan's, so it is not in your spending)
  const lines = m.lines.map((l, i) => {
    const it = r.items.find((x) => x.index === i);
    const yours = it.shares.you || 0;
    if (!yours) return '';
    return `<div class="rent-line" style="--c:${CATEGORIES[l.category].color}"><span class="cat"></span>
      <span class="nm">${esc(l.pretty)}</span><span class="how${l.split?.type === 'percentage' ? ' how-pct' : ''}">${esc(splitLabel(l))}</span>
      <span class="amt"><strong class="money">${money(yours)}</strong><small class="money">of ${money(it.totalCents)}</small></span></div>`;
  }).join('');
  el.innerHTML = `<div class="panel rent">
    <div class="rent-head"><span class="rent-ico">${STORE_ICON.home}</span>
      <div><strong>Monthly rent</strong><small>${ICON.repeat.replace('width="18" height="18"', 'width="14" height="14" style="display:inline;vertical-align:-2px"')} Monthly · on the 1st</small></div>
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
  </div>`;
  const months = $('.months', el);
  const drawMonths = (mode) => {
    const ms = [['Nov 1', true], ['Dec 1', false], ['Jan 1', false]];
    months.innerHTML = ms.map(([d, past]) => {
      const cls = past ? (mode === 'auto' ? 'added' : 'review') : '';
      const st = past ? (mode === 'auto' ? 'Added' : 'Waiting for you') : (mode === 'auto' ? 'Auto' : 'Asks you');
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
  // nothing downloads on first load: the poster and sources attach ~600px before the phone scrolls in
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    v.poster = v.dataset.poster;
    v.innerHTML = `<source src="${v.dataset.srcWebm}" type="video/webm"><source src="${v.dataset.srcMp4}" type="video/mp4">`;
    v.load();
  };
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
    load();
    if (v.paused) { userPaused = false; v.play().catch(() => {}); } else { userPaused = true; v.pause(); }
  });
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { near.disconnect(); load(); } }, { rootMargin: '600px 0px' });
    near.observe(v);
    new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && !userPaused) { load(); v.play().catch(() => {}); } else if (!e.isIntersecting) v.pause();
      });
    }, { threshold: 0.4 }).observe(v);
  } else load();
}
