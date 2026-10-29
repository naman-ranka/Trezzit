/* story.js: the split story. One receipt, four roommates.
 * Three beats: 1 shared items four ways (towels included), 2 personal items, 3 the playground.
 * Desktop: a sticky stage; the step nearest the reading line sets its state (native scroll).
 * Phones: no timed play. The stage arrives finished (step 3) and its dots pop in once it is in view,
 * so the payoff never depends on reading speed.
 * The stage footer ends on the hero's word: "You spent $X · roommates owe you $Y", then the "Adds up to" check and Reset.
 * The nine plain shared groceries fold into one row (open on tap), so the grid is six rows, not fourteen.
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
  // The nine plain groceries everyone shares fold into one row ("Shared groceries · 9 items"), so the grid shows only
  // what differs: your two, Maya's two, the taxed towels. The fold opens on tap; a dot on it changes all nine at once.
  const fold = original.map((l, i) => i).filter((i) => groups[i] === 1 && !original[i].taxCents);
  const folded = fold.length >= 3 ? fold : [];
  const sumOf = (ix) => ix.reduce((a, i) => a + res.items[i].totalCents, 0);
  const dots = (label) => `<span class="who" role="group" aria-label="Who had ${esc(label)}">${people.map((p) => `<button type="button" class="dot-b" data-p="${p}" aria-label="${esc(label)}: ${esc(PEOPLE[p].name)}" aria-pressed="false" tabindex="-1" style="--c:${PEOPLE[p].color}"><i></i></button>`).join('')}</span>`;
  const lineRow = (l, i, sub = false) => `
      <div class="st-row${sub ? ' st-subrow' : ''}" data-i="${i}" data-g="${GROUP(i)}" style="--r:${i}">
        <span class="nm">${esc(l.pretty)}${l.taxCents ? ' <small class="tx">tax in</small>' : ''}</span><span class="money">${money(res.items[i].totalCents)}</span>
        ${dots(l.pretty)}
      </div>`;
  const grpLabel = `${fold.length} shared groceries`;
  stage.innerHTML = `
    <p class="st-cap" aria-hidden="true"><b></b><span></span></p>
    <div class="st-people"><span class="st-sp" aria-hidden="true"><strong>${esc(model.merchant)}</strong><small>${model.lines.length} items · ${money(model.totalCents)}</small></span><div class="st-pp">${people.map((id) => `
      <div class="st-p" data-p="${id}">${avatar(PEOPLE[id])}<span class="nm">${esc(PEOPLE[id].name)}</span><span class="amt money">$0.00</span></div>`).join('')}
    </div></div>
    <div class="st-items">${folded.length ? `
      <div class="st-row st-grp" data-lines="${folded.join(',')}" data-g="1" style="--r:0">
        <span class="nm"><button type="button" class="st-exp" aria-expanded="false" aria-controls="st-sub"><span class="gl">Groceries</span> <small>${folded.length} shared</small><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></span><span class="money">${money(sumOf(folded))}</span>
        ${dots(grpLabel)}
      </div>
      <div class="st-sub" id="st-sub" hidden>${folded.map((i) => lineRow(model.lines[i], i, true)).join('')}</div>` : ''}
      ${model.lines.map((l, i) => (folded.includes(i) ? '' : lineRow(l, i))).join('')}</div>
    <div class="st-foot"><p class="ss-owe">You spent <strong class="money ss-you"></strong> <span class="ss-them">roommates owe you <b class="money"></b></span></p><span class="ss-check"></span><button type="button" class="st-reset" tabindex="-1" aria-label="Reset the split" title="Reset">${ICON.replay}</button></div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;

  const allRows = $$('.st-row', stage);
  const grpRow = $('.st-grp', stage);
  const sub = $('.st-sub', stage);
  const expBtn = $('.st-exp', stage);
  const linesOf = (row) => (row.dataset.lines ? row.dataset.lines.split(',').map(Number) : [+row.dataset.i]);
  // the rows a keyboard can reach: the folded ones only while the fold is open
  const visRows = () => allRows.filter((r) => !(sub?.hidden && sub.contains(r)));
  const live = $('[data-live]', stage);
  const amts = Object.fromEntries(people.map((p) => [p, $(`.st-p[data-p="${p}"] .amt`, stage)]));
  const avs = Object.fromEntries(people.map((p) => [p, $(`.st-p[data-p="${p}"]`, stage)]));
  const shown = Object.fromEntries(people.map((p) => [p, 0]));
  const steps = $$('.step', root);
  let current = -1;
  let edited = false;
  let pinned = false; // a dot was tapped or focused: keep the playground while the story is in view
  let focusRow = visRows()[0]; // roving focus: row element
  let fc = 0; // roving focus: person
  const capN = $('.st-cap b', stage);
  const capT = $('.st-cap span', stage);
  const footCheck = $('.st-foot .ss-check', stage);
  const footReset = $('.st-foot .st-reset', stage);
  const footYou = $('.st-foot .ss-you', stage);
  const footThem = $('.st-foot .ss-them b', stage);
  footReset.addEventListener('click', () => reset());
  // desktop: one caption under the heading, cross-faded in place as each (invisible) scroll step activates
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
  // the footer ends the split on the hero's word: what you spent (live), then what the others owe you
  function renderFoot(t = totalsAt(current < 0 ? LAST : current)) {
    footCheck.className = `ss-check${res.check.ok ? '' : ' bad'}`;
    footCheck.innerHTML = res.check.ok ? `${ICON.check}Adds up to ${money(res.check.sumCents)}` : `Shares add up to ${money(res.check.sumCents)}, not ${money(res.check.expectedCents)}`;
    // Reset keeps its slot (visibility only), so it never reflows the footer
    footReset.classList.toggle('is-off', !edited);
    footReset.tabIndex = edited ? 0 : -1;
    footYou.textContent = money(t.you || 0);
    footThem.textContent = money(people.filter((p) => p !== 'you').reduce((a, p) => a + (t[p] || 0), 0));
    if (grpRow) $('.money', grpRow).textContent = money(sumOf(folded));
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
    const vis = visRows();
    if (!vis.includes(focusRow)) focusRow = grpRow || vis[0];
    allRows.forEach((row) => {
      const ix = linesOf(row);
      const assigned = step >= LAST || +row.dataset.g <= step;
      row.classList.toggle('mine', ix.some((i) => (res.items[i].shares.you || 0) > 0));
      $$('.dot-b', row).forEach((b, c) => {
        const n = ix.filter((i) => (res.items[i].shares[b.dataset.p] || 0) > 0).length;
        const all = n === ix.length;
        b.classList.toggle('on', assigned && all);
        b.classList.toggle('part', assigned && n > 0 && !all);
        b.setAttribute('aria-pressed', all ? 'true' : n ? 'mixed' : 'false');
        b.tabIndex = row === focusRow && c === fc ? 0 : -1; // exactly one dot is always reachable by Tab
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
      renderFoot(t);
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
      const from = row.querySelector(':scope > .money').getBoundingClientRect();
      const who = people.filter((p) => linesOf(row).some((i) => (res.items[i].shares[p] || 0) > 0));
      who.forEach((p) => {
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
    steps.forEach((s) => s.classList.toggle('is-active', +s.dataset.step === step));
    caption(step);
    allRows.forEach((row) => {
      const g = +row.dataset.g;
      row.classList.toggle('is-hot', step < LAST && g === step);
      row.classList.toggle('is-dim', step < LAST && g > step && step > 0);
    });
    paintDots(step);
    if (forward && step >= 1 && step < LAST) fly(visRows().filter((r) => +r.dataset.g === step));
    paintTotals(step, forward && !reduced() && step < LAST ? 520 : 0);
  }

  /* ---------- playing with it ---------- */
  function resplit() {
    res = compute(model);
    paintDots(LAST);
    paintTotals(LAST);
    live.textContent = `You spent ${money(res.people.you?.cents || 0)}. ` + people.filter((p) => p !== 'you').map((p) => `${PEOPLE[p].name} ${money(res.people[p]?.cents || 0)}`).join(', ') + (res.check.ok ? '. Adds up exactly.' : '.');
  }
  function reset() {
    model.lines = JSON.parse(JSON.stringify(original));
    edited = false;
    resplit();
  }
  function toggleFold(open = sub.hidden) {
    sub.hidden = !open;
    expBtn.setAttribute('aria-expanded', String(open));
    grpRow.classList.toggle('is-open', open);
    paintDots(current < 0 ? 0 : current);
  }
  stage.addEventListener('keydown', (e) => {
    const btn = e.target.closest?.('.dot-b');
    if (!btn) return;
    const vis = visRows();
    let r = Math.max(0, vis.indexOf(focusRow)); let c = fc;
    const mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (mv) { r = Math.max(0, Math.min(vis.length - 1, r + mv[0])); c = Math.max(0, Math.min(people.length - 1, c + mv[1])); }
    else if (e.key === 'Home') c = 0;
    else if (e.key === 'End') c = people.length - 1;
    else return;
    e.preventDefault();
    focusRow = vis[r]; fc = c;
    paintDots(current);
    $$('.dot-b', focusRow)[fc]?.focus();
  });
  // a keyboard user who tabs into the dots gets the playground right away
  stage.addEventListener('focusin', (e) => {
    const btn = e.target.closest?.('.dot-b');
    if (!btn) return;
    focusRow = btn.closest('.st-row'); fc = people.indexOf(btn.dataset.p);
    pinned = true;
    if (current !== LAST) apply(LAST);
  });
  stage.addEventListener('click', (e) => {
    if (e.target.closest('.st-exp')) { toggleFold(); return; }
    const btn = e.target.closest('.dot-b');
    if (!btn) return;
    const row = btn.closest('.st-row');
    focusRow = row; fc = people.indexOf(btn.dataset.p);
    // a tap at any step jumps to the playground and still counts as the edit
    pinned = true;
    if (current !== LAST) apply(LAST);
    const p = btn.dataset.p;
    const ix = linesOf(row);
    const onAll = ix.every((i) => lineMembers(model.lines[i]).includes(p));
    if (onAll) {
      // someone has to have every item: refuse (with a nudge) rather than leave a line with nobody on it
      if (ix.some((i) => lineMembers(model.lines[i]).length === 1)) {
        const who = $('.who', row);
        who.classList.remove('nope'); void who.offsetWidth; who.classList.add('nope');
        live.textContent = 'Someone has to have it. Add another person first.';
        return;
      }
      ix.forEach((i) => { const m = lineMembers(model.lines[i]).filter((x) => x !== p); model.lines[i].split = { type: 'equal', people: people.filter((x) => m.includes(x)) }; });
    } else {
      ix.forEach((i) => { const m = [...lineMembers(model.lines[i]), p]; model.lines[i].split = { type: 'equal', people: people.filter((x) => m.includes(x)) }; });
    }
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

  if (compact()) {
    // the caption and footer have their final size at step 0 too, so arriving moves nothing
    apply(0);
    onceVisible(stage, enterPhone, { threshold: 0.2 });
  } else measure();
}
