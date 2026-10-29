/* story.js: the split story. One receipt, four roommates.
 * Desktop: a sticky stage; the step nearest the reading line sets its state (native scroll).
 * Phones: the stage sits still and plays steps 1-4 once it is in view; tap a step to jump to it.
 * At step 4 the stage becomes the playground: tap a dot to add or remove someone from an item,
 * and the kit's engine (integer cents) re-splits; the summary card in step 4 follows live. */
import { PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { $, $$, esc, money, countTo, reduced, avatar, onceVisible, ICON } from './util.js';
import { loadModel, compute, lineMembers } from './data.js';

const GROUP = (i) => (i <= 8 ? 1 : i <= 12 ? 2 : 3);
const compact = () => innerWidth < 900;

export async function initStory() {
  const root = $('#story-root');
  const stage = $('#story-stage');
  const sumEl = $('#story-sum');
  if (!root || !stage) return;
  const model = await loadModel('green-basket');
  const original = JSON.parse(JSON.stringify(model.lines));
  let res = compute(model);
  const people = model.people;

  stage.innerHTML = `
    <div class="st-people">${people.map((id) => `
      <div class="st-p" data-p="${id}">${avatar(PEOPLE[id])}<span class="nm">${esc(PEOPLE[id].name)}</span><span class="amt money">$0.00</span></div>`).join('')}
    </div>
    <div class="st-items">${model.lines.map((l, i) => `
      <div class="st-row" data-i="${i}" data-g="${GROUP(i)}" style="--c:${CATEGORIES[l.category].color}">
        <span class="nm">${esc(l.pretty)}</span><span class="money">${money(res.items[i].totalCents)}</span>
        <span class="who" role="group" aria-label="Who had ${esc(l.pretty)}">${people.map((p) => `<button type="button" class="dot-b" data-p="${p}" aria-label="${esc(PEOPLE[p].name)}" aria-pressed="false" tabindex="-1" style="--c:${PEOPLE[p].color}"><i></i></button>`).join('')}</span>
      </div>`).join('')}</div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;

  const rows = $$('.st-row', stage);
  const live = $('[data-live]', stage);
  const amts = Object.fromEntries(people.map((p) => [p, $(`.st-p[data-p="${p}"] .amt`, stage)]));
  const avs = Object.fromEntries(people.map((p) => [p, $(`.st-p[data-p="${p}"]`, stage)]));
  const shown = Object.fromEntries(people.map((p) => [p, 0]));
  const steps = $$('.step', root);
  let current = -1;
  let edited = false;

  const totalsAt = (step) => {
    const t = Object.fromEntries(people.map((p) => [p, 0]));
    res.items.forEach((it, i) => {
      if (GROUP(i) <= Math.min(step, 3)) Object.entries(it.shares).forEach(([p, c]) => { t[p] += c; });
    });
    return t;
  };

  /* ---------- the summary card (step 4) ---------- */
  function renderSum() {
    if (!sumEl) return;
    const you = res.people.you || { cents: 0, byCategory: {} };
    const cats = Object.entries(you.byCategory).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
    const others = people.filter((p) => p !== 'you');
    const owed = others.reduce((a, p) => a + (res.people[p]?.cents || 0), 0);
    sumEl.innerHTML = `
      <div class="ss-row"><span>Your bank</span><span class="money ss-bank">&minus;${money(res.totalCents)}</span></div>
      <div class="ss-row ss-you"><span>You spent</span><strong class="money">${money(you.cents)}</strong></div>
      <div class="hv-bar" role="img" aria-label="${esc(cats.map(([c, v]) => `${CATEGORIES[c].label} ${money(v)}`).join(', '))}">${cats.map(([c, v]) => `<span class="seg" style="--w:${(100 * v) / Math.max(1, you.cents)}%;background:${CATEGORIES[c].color}"></span>`).join('')}</div>
      <ul class="hv-legend" role="list">${cats.map(([c, v]) => `<li><span class="dot" style="--c:${CATEGORIES[c].color}"></span>${esc(CATEGORIES[c].label)}<span class="money">${money(v)}</span></li>`).join('')}</ul>
      <div class="ss-owe">
        <p>Roommates owe you <strong class="money">${money(owed)}</strong></p>
        <ul role="list">${others.map((p) => `<li>${avatar(PEOPLE[p])}<span class="money">${money(res.people[p]?.cents || 0)}</span></li>`).join('')}</ul>
      </div>
      <div class="ss-foot"><span class="ss-check${res.check.ok ? '' : ' bad'}">${res.check.ok ? `${ICON.check}Adds up to ${money(res.check.sumCents)}.` : `Shares add up to ${money(res.check.sumCents)}, not ${money(res.check.expectedCents)}.`}</span>
        <button type="button" class="ss-reset"${edited ? '' : ' hidden'}>${ICON.replay}Reset</button></div>`;
    $('.ss-reset', sumEl)?.addEventListener('click', reset);
  }

  /* ---------- dots + totals ---------- */
  function paintDots(step) {
    rows.forEach((row) => {
      const i = +row.dataset.i;
      const assigned = step >= 4 || GROUP(i) <= step;
      const shares = res.items[i].shares;
      row.classList.toggle('mine', (shares.you || 0) > 0);
      $$('.dot-b', row).forEach((b) => {
        const has = (shares[b.dataset.p] || 0) > 0;
        b.classList.toggle('on', assigned && has);
        b.setAttribute('aria-pressed', String(has));
        b.tabIndex = step === 4 ? 0 : -1;
      });
    });
  }
  function paintTotals(step, delay = 0) {
    const t = totalsAt(step);
    setTimeout(() => {
      people.forEach((p) => {
        if (shown[p] !== t[p]) { countTo(amts[p], shown[p], t[p], { dur: 600 }); shown[p] = t[p]; }
      });
    }, delay);
  }

  function fly(rowsToFly) {
    if (reduced()) return;
    const sr = stage.getBoundingClientRect();
    if (sr.top < -40 || sr.bottom > innerHeight + 80) return;
    let k = 0;
    rowsToFly.forEach((row) => {
      const i = +row.dataset.i;
      const from = row.querySelector('.money').getBoundingClientRect();
      Object.keys(res.items[i].shares).forEach((p) => {
        const to = avs[p].querySelector('.av').getBoundingClientRect();
        const dot = document.createElement('span');
        dot.className = 'flyer';
        dot.style.setProperty('--c', PEOPLE[p].color);
        document.body.appendChild(dot);
        const x0 = from.left + from.width / 2 - 5; const y0 = from.top + from.height / 2 - 5;
        const x1 = to.left + to.width / 2 - 5; const y1 = to.top + to.height / 2 - 5;
        const mx = (x0 + x1) / 2 + (x1 > x0 ? -30 : 30); const my = Math.min(y0, y1) - 40;
        const a = dot.animate([
          { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
          { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1, offset: 0.12 },
          { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${x1}px, ${y1}px) scale(0.5)`, opacity: 0.2 },
        ], { duration: 720, delay: k * 22, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' });
        const kill = setTimeout(() => dot.remove(), 2400);
        a.oncancel = () => { clearTimeout(kill); dot.remove(); };
        a.onfinish = () => {
          clearTimeout(kill);
          dot.remove();
          avs[p].classList.add('bump');
          setTimeout(() => avs[p].classList.remove('bump'), 220);
        };
        k += 1;
      });
    });
  }

  function apply(step) {
    if (step === current) return;
    const forward = step > current;
    current = step;
    stage.dataset.step = String(step);
    stage.classList.toggle('is-play', step === 4);
    steps.forEach((s) => s.classList.toggle('is-active', +s.dataset.step === step));
    rows.forEach((row) => {
      const g = +row.dataset.g;
      row.classList.toggle('is-hot', step < 4 && g === step);
      row.classList.toggle('is-dim', step < 4 && g > step && step > 0);
    });
    paintDots(step);
    if (forward && step >= 1 && step <= 3) fly(rows.filter((r) => +r.dataset.g === step));
    paintTotals(step, forward && !reduced() && step <= 3 ? 520 : 0);
  }

  /* ---------- playing with it ---------- */
  function resplit() {
    res = compute(model);
    paintDots(4);
    paintTotals(4);
    renderSum();
    live.textContent = people.map((p) => `${PEOPLE[p].name} ${money(res.people[p]?.cents || 0)}`).join(', ') + (res.check.ok ? '. Adds up exactly.' : '.');
  }
  function reset() {
    model.lines = JSON.parse(JSON.stringify(original));
    edited = false;
    resplit();
  }
  stage.addEventListener('click', (e) => {
    const btn = e.target.closest('.dot-b');
    if (!btn) return;
    if (current !== 4) { stopAuto(); apply(4); return; }
    const i = +btn.closest('.st-row').dataset.i;
    const line = model.lines[i];
    const p = btn.dataset.p;
    let members = lineMembers(line);
    if (members.includes(p)) {
      if (members.length === 1) {
        btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope');
        live.textContent = 'Someone has to have it. Add another person first.';
        return;
      }
      members = members.filter((x) => x !== p);
    } else members = [...members, p];
    line.split = { type: 'equal', people: people.filter((x) => members.includes(x)) };
    edited = true;
    resplit();
  });

  /* ---------- phones: play once in view, tap a step to jump ---------- */
  let autoT = 0;
  let autoOn = false;
  function stopAuto() { autoOn = false; clearTimeout(autoT); }
  function autoplay() {
    if (!compact() || current === 4) return;
    autoOn = true;
    const next = () => {
      if (!autoOn) return;
      apply(Math.min(4, current + 1));
      if (current < 4) autoT = setTimeout(next, 1700);
    };
    if (reduced()) { apply(4); return; }
    autoT = setTimeout(next, 400);
  }
  steps.forEach((s) => {
    const card = $('.step-card', s);
    card.addEventListener('click', (e) => {
      if (!compact() || e.target.closest('.story-sum')) return;
      stopAuto(); apply(+s.dataset.step);
    });
  });
  const tabSteps = () => steps.forEach((s) => {
    const card = $('.step-card', s);
    if (compact()) { card.setAttribute('role', 'button'); card.tabIndex = 0; } else { card.removeAttribute('role'); card.removeAttribute('tabindex'); }
  });
  steps.forEach((s) => $('.step-card', s).addEventListener('keydown', (e) => {
    if (compact() && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); stopAuto(); apply(+s.dataset.step); }
  }));
  tabSteps();
  onceVisible(stage, autoplay, { threshold: 0.45 });

  /* ---------- desktop: which step is under the reading line ---------- */
  let ticking = false;
  function measure() {
    ticking = false;
    if (compact()) return;
    const line = innerHeight * 0.62;
    let step = 0;
    let best = Infinity;
    const mid = innerHeight * 0.5;
    const first = $('.step-card', steps[0]).getBoundingClientRect();
    if (first.top + first.height / 2 < line) {
      steps.forEach((s) => {
        const c = $('.step-card h3', s).getBoundingClientRect();
        const d = Math.abs(c.top + c.height / 2 - mid);
        if (d < best) { best = d; step = +s.dataset.step; }
      });
    }
    const rr = root.getBoundingClientRect();
    if (rr.bottom < innerHeight * 0.3) step = 4;
    // once played with, keep the playground state while it is in view
    if (edited && step < 4 && rr.bottom > 0 && rr.top < innerHeight) step = 4;
    apply(step);
  }
  const setH = () => root.style.setProperty('--stage-h', `${stage.offsetHeight}px`);
  setH();
  if ('ResizeObserver' in window) new ResizeObserver(setH).observe(stage);
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } };
  addEventListener('scroll', onScroll, { passive: true });
  let wasCompact = compact();
  addEventListener('resize', () => {
    if (compact() !== wasCompact) { wasCompact = compact(); tabSteps(); }
    onScroll();
  }, { passive: true });

  renderSum();
  if (compact()) apply(0); else measure();
}
