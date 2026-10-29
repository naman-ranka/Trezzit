/* story.js: the split story. One receipt, four roommates.
 * Three beats: 1 shared items four ways (towels included), 2 personal items, 3 the playground.
 * Desktop: a sticky stage; the step nearest the reading line sets its state (native scroll).
 * Phones: no timed play. The stage arrives finished (step 3) and its dots pop in once it is in view,
 * so the payoff never depends on reading speed.
 * The stage footer carries "Roommates owe you", the "Adds up to" check and Reset, at every width.
 * At step 3 the stage is the playground: tap a dot to add or remove someone from an item, and the
 * kit's engine (integer cents) re-splits. Any tap or keyboard focus on a dot jumps straight to it.
 * Keyboard: the dots are one tab stop (roving tabindex, always present); arrows move between dots. */
import { PEOPLE, CATEGORIES } from '../../_kit/receipts.js';
import { $, $$, esc, money, countTo, reduced, avatar, onceVisible, ICON } from './util.js';
import { loadModel, compute, lineMembers } from './data.js';

const LAST = 3; // the playground step
const compact = () => innerWidth < 900;

export async function initStory() {
  const root = $('#story-root');
  const stage = $('#story-stage');
  if (!root || !stage) return;
  const model = await loadModel('green-basket');
  const original = JSON.parse(JSON.stringify(model.lines));
  let res = compute(model);
  const people = model.people;
  // beat 1 = lines everyone shares (the taxed towels too), beat 2 = lines that are someone's own
  const groups = original.map((l) => (lineMembers(l).length === people.length ? 1 : 2));
  const GROUP = (i) => groups[i];

  const CAPTION = { 0: `${model.lines.length} items · ${money(model.totalCents)}`, [LAST]: 'Tap to change who had what.' };
  stage.innerHTML = `
    <p class="st-cap" aria-hidden="true"><b></b><span></span></p>
    <div class="st-people">${people.map((id) => `
      <div class="st-p" data-p="${id}">${avatar(PEOPLE[id])}<span class="nm">${esc(PEOPLE[id].name)}</span><span class="amt money">$0.00</span></div>`).join('')}
    </div>
    <div class="st-items">${model.lines.map((l, i) => `
      <div class="st-row" data-i="${i}" data-g="${GROUP(i)}" style="--c:${CATEGORIES[l.category].color};--r:${i}">
        <span class="nm">${esc(l.pretty)}${l.taxCents ? ' <small class="tx">tax in</small>' : ''}</span><span class="money">${money(res.items[i].totalCents)}</span>
        <span class="who" role="group" aria-label="Who had ${esc(l.pretty)}">${people.map((p) => `<button type="button" class="dot-b" data-p="${p}" aria-label="${esc(l.pretty)}: ${esc(PEOPLE[p].name)}" aria-pressed="false" tabindex="-1" style="--c:${PEOPLE[p].color}"><i></i></button>`).join('')}</span>
      </div>`).join('')}</div>
    <div class="st-foot"><p class="ss-owe">Roommates owe you <strong class="money"></strong></p><span class="ss-check"></span><button type="button" class="st-reset" tabindex="-1" aria-label="Reset the split" title="Reset">${ICON.replay}</button></div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;

  const rows = $$('.st-row', stage);
  const live = $('[data-live]', stage);
  const amts = Object.fromEntries(people.map((p) => [p, $(`.st-p[data-p="${p}"] .amt`, stage)]));
  const avs = Object.fromEntries(people.map((p) => [p, $(`.st-p[data-p="${p}"]`, stage)]));
  const shown = Object.fromEntries(people.map((p) => [p, 0]));
  const steps = $$('.step', root);
  let current = -1;
  let edited = false;
  let pinned = false; // a dot was tapped or focused: keep the playground while the story is in view
  let fr = 0; // roving focus: row
  let fc = 0; // roving focus: person
  const capN = $('.st-cap b', stage);
  const capT = $('.st-cap span', stage);
  const footCheck = $('.st-foot .ss-check', stage);
  const footReset = $('.st-foot .st-reset', stage);
  const footOwe = $('.st-foot .ss-owe strong', stage);
  footReset.addEventListener('click', () => reset());
  // the month's running tab: this receipt plus the month's other sample bills (live, follows every edit)
  const tabEl = $('#story-tab');
  const TAB_BASE = { maya: 8240, jordan: 4410, sam: 3875 };
  // desktop: one caption beside the stage, cross-faded in place as each (invisible) scroll step activates
  const sideCap = $('.story-cap span', root);
  let capT0 = 0;
  function caption(step) {
    capN.textContent = step && step !== LAST ? String(step) : '';
    capT.textContent = step === LAST || step === 0 ? CAPTION[step] : $('h3', steps[step - 1]).textContent;
    if (!sideCap) return;
    const text = $('h3', steps[Math.max(1, step) - 1]).textContent;
    if (sideCap.textContent === text) return;
    clearTimeout(capT0);
    if (reduced() || !sideCap.textContent) { sideCap.textContent = text; return; }
    sideCap.classList.add('is-out');
    capT0 = setTimeout(() => { sideCap.textContent = text; sideCap.classList.remove('is-out'); }, 200);
  }
  function renderFoot() {
    footCheck.className = `ss-check${res.check.ok ? '' : ' bad'}`;
    footCheck.innerHTML = res.check.ok ? `${ICON.check}Adds up to ${money(res.check.sumCents)}` : `Shares add up to ${money(res.check.sumCents)}, not ${money(res.check.expectedCents)}`;
    // Reset keeps its slot (visibility only), so it never reflows the footer
    footReset.classList.toggle('is-off', !edited);
    footReset.tabIndex = edited ? 0 : -1;
    const others = people.filter((p) => p !== 'you');
    footOwe.textContent = money(others.reduce((a, p) => a + (res.people[p]?.cents || 0), 0));
    if (tabEl) {
      tabEl.innerHTML = `<span class="nw">Owed to you this month:</span> ${others.map((p) => `<span class="nw">${esc(PEOPLE[p].name)} <b class="money">${money((TAB_BASE[p] || 0) + (res.people[p]?.cents || 0))}</b></span>`).join(' · ')}`;
    }
  }

  const totalsAt = (step) => {
    const t = Object.fromEntries(people.map((p) => [p, 0]));
    res.items.forEach((it, i) => {
      if (GROUP(i) <= Math.min(step, 2)) Object.entries(it.shares).forEach(([p, c]) => { t[p] += c; });
    });
    return t;
  };

  /* ---------- dots + totals ---------- */
  function paintDots(step) {
    rows.forEach((row) => {
      const i = +row.dataset.i;
      const assigned = step >= LAST || GROUP(i) <= step;
      const shares = res.items[i].shares;
      row.classList.toggle('mine', (shares.you || 0) > 0);
      $$('.dot-b', row).forEach((b, c) => {
        const has = (shares[b.dataset.p] || 0) > 0;
        b.classList.toggle('on', assigned && has);
        b.setAttribute('aria-pressed', String(has));
        b.tabIndex = i === fr && c === fc ? 0 : -1; // exactly one dot is always reachable by Tab
      });
    });
  }
  // one pending repaint at a time, computed when it runs: a delayed step-2 paint can never land on top of a later edit
  let totT = 0;
  function paintTotals(step, delay = 0) {
    clearTimeout(totT);
    const run = () => {
      const t = totalsAt(step);
      people.forEach((p) => {
        if (shown[p] !== t[p]) { countTo(amts[p], shown[p], t[p], { dur: 600 }); shown[p] = t[p]; }
      });
    };
    if (delay) totT = setTimeout(run, delay); else run();
  }

  // flyers are viewport-fixed: never start one during a fast scroll (a nav jump), and drop any in flight once the stage leaves view
  let lastY = scrollY;
  let fast = false;
  const dropFlyers = () => $$('.flyer').forEach((f) => f.getAnimations().forEach((a) => a.cancel()));
  function fly(rowsToFly) {
    if (reduced() || fast) return;
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
    stage.classList.toggle('is-play', step === LAST);
    root.classList.toggle('is-play', step === LAST);
    tabEl?.classList.toggle('is-on', step === LAST);
    steps.forEach((s) => s.classList.toggle('is-active', +s.dataset.step === step));
    caption(step);
    rows.forEach((row) => {
      const g = +row.dataset.g;
      row.classList.toggle('is-hot', step < LAST && g === step);
      row.classList.toggle('is-dim', step < LAST && g > step && step > 0);
    });
    paintDots(step);
    if (forward && step >= 1 && step < LAST) fly(rows.filter((r) => +r.dataset.g === step));
    paintTotals(step, forward && !reduced() && step < LAST ? 520 : 0);
  }

  /* ---------- playing with it ---------- */
  function resplit() {
    res = compute(model);
    paintDots(LAST);
    paintTotals(LAST);
    renderFoot();
    live.textContent = people.map((p) => `${PEOPLE[p].name} ${money(res.people[p]?.cents || 0)}`).join(', ') + (res.check.ok ? '. Adds up exactly.' : '.');
  }
  function reset() {
    model.lines = JSON.parse(JSON.stringify(original));
    edited = false;
    resplit();
  }
  stage.addEventListener('keydown', (e) => {
    const btn = e.target.closest?.('.dot-b');
    if (!btn) return;
    const mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    let r = fr; let c = fc;
    if (mv) { r = Math.max(0, Math.min(rows.length - 1, fr + mv[0])); c = Math.max(0, Math.min(people.length - 1, fc + mv[1])); }
    else if (e.key === 'Home') c = 0;
    else if (e.key === 'End') c = people.length - 1;
    else return;
    e.preventDefault();
    fr = r; fc = c;
    paintDots(current);
    $$('.dot-b', rows[fr])[fc]?.focus();
  });
  // a keyboard user who tabs into the dots gets the playground right away
  stage.addEventListener('focusin', (e) => {
    const btn = e.target.closest?.('.dot-b');
    if (!btn) return;
    fr = +btn.closest('.st-row').dataset.i; fc = people.indexOf(btn.dataset.p);
    pinned = true;
    if (current !== LAST) apply(LAST);
  });
  stage.addEventListener('click', (e) => {
    const btn = e.target.closest('.dot-b');
    if (!btn) return;
    const i = +btn.closest('.st-row').dataset.i;
    fr = i; fc = people.indexOf(btn.dataset.p);
    // a tap at any step jumps to the playground and still counts as the edit
    pinned = true;
    if (current !== LAST) apply(LAST);
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
    // back to the original split (toggled off, then on again) means nothing is edited
    edited = JSON.stringify(model.lines.map((l) => l.split)) !== JSON.stringify(original.map((l) => l.split));
    resplit();
  });

  /* ---------- phones: arrive finished; the dots pop in once the stage is in view ---------- */
  function enterPhone() {
    if (reduced()) { apply(LAST); return; }
    stage.classList.add('is-enter');
    apply(LAST);
    setTimeout(() => stage.classList.remove('is-enter'), 1400);
  }

  /* ---------- desktop: which step is under the reading line ---------- */
  let ticking = false;
  function measure() {
    ticking = false;
    fast = Math.abs(scrollY - lastY) > 120;
    lastY = scrollY;
    const sr = stage.getBoundingClientRect();
    if (sr.bottom < innerHeight * 0.15 || sr.top > innerHeight * 0.85) dropFlyers();
    if (compact()) return;
    // the steps are invisible scroll triggers: the last one whose top has passed the reading line wins
    const line = innerHeight * 0.55;
    let step = 0;
    steps.forEach((s) => { if (s.getBoundingClientRect().top < line) step = +s.dataset.step; });
    const rr = root.getBoundingClientRect();
    if (rr.bottom < innerHeight * 0.3) step = LAST;
    // once played with, keep the playground state while it is in view
    if ((edited || pinned) && step < LAST && rr.bottom > 0 && rr.top < innerHeight) step = LAST;
    apply(step);
  }
  const pin = $('#story-pin');
  const setH = () => root.style.setProperty('--stage-h', `${pin.offsetHeight}px`);
  setH();
  if ('ResizeObserver' in window) new ResizeObserver(setH).observe(pin);
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  renderFoot();
  if (compact()) {
    // the caption and footer have their final size at step 0 too, so arriving moves nothing
    apply(0);
    onceVisible(stage, enterPhone, { threshold: 0.2 });
  } else measure();
}
