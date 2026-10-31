/* hero.js: three bank lines, three truths. Each bank line is a tab; its Trezzit card shows
 * "You paid $X" turning into "You spent $Y" while the bar splits into everyone's share.
 *  - Green Basket: you paid $100.00, you spent $30.00 (shared with three roommates).
 *  - Corner Pharmacy: you paid $48.22, you spent $48.22 (just yours, still sorted by item).
 *  - Taqueria Sol: your bank shows nothing, you spent $27.03 (Alex paid).
 * Until the visitor touches it, the hero walks once through the three and back (B's tour), with a
 * visible Pause button (WCAG 2.2.2), a thin timer on the selected line, and a pause on hover, focus
 * or when off screen. Any tap on a line stops the tour for good. Reduced motion: no tour, no motion.
 * All three cards share one grid cell, so the card never changes size when you switch. */
import { money, reduced, sleep } from './util.js';

const DWELL = [5200, 4400, 4400]; // the first wait is the longest: the headline is read first

export function initHero(root) {
  if (!root) return;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const views = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const pauseBtn = root.querySelector('[data-pause]');
  const bank = root.querySelector('.bank');
  const join = root.querySelector('.hero-join');
  const tzc = root.querySelector('.tzc');
  const animated = () => !reduced() && document.documentElement.classList.contains('anim');
  let cur = 0;
  let run = 0;

  /* desktop: the bank card is centred against the Trezzit card (CSS); the arrow meets the selected line */
  const wide = matchMedia('(min-width: 900px)');
  function pin() {
    if (!wide.matches) { join.style.marginTop = ''; return; }
    // layout offsets, not screen boxes: the card may still be sliding in (a transform) when this runs
    const t = tabs[cur];
    const y = bank.offsetTop - tzc.offsetTop + t.offsetTop + t.offsetHeight / 2 - join.offsetHeight / 2;
    join.style.marginTop = `${Math.round(Math.max(0, y))}px`;
  }
  root.classList.add('pinned');
  addEventListener('resize', pin);
  // the arrow shows once it has its final place (after the web font settles), so it never jumps
  const joined = () => { pin(); root.classList.add('joined'); };
  if (document.fonts?.ready) { document.fonts.ready.then(joined); setTimeout(joined, 1200); } else joined();

  /* one card's "paid" -> "spent" beat: no in-between figure is ever on screen */
  async function beat(i, { first = false } = {}) {
    const my = ++run;
    const v = views[i];
    const amt = v.querySelector('[data-amt]');
    const label = v.querySelector('[data-label]');
    const paid = Number(v.dataset.paid);
    const spent = Number(v.dataset.spent);
    const done = () => { v.classList.add('is-split'); v.classList.remove('swap'); amt.textContent = money(spent); label.textContent = 'You spent'; };
    if (!animated()) { done(); return; }
    v.classList.remove('is-split', 'swap');
    amt.textContent = money(paid);
    label.textContent = 'You paid';
    void v.offsetWidth;
    const step = async (ms) => { await sleep(ms); if (my !== run) throw new Error('stale'); };
    try {
      await step(first ? 450 : 520);
      v.classList.add('is-split', 'swap');
      await step(180);
      amt.textContent = money(spent);
      label.textContent = 'You spent';
      v.classList.remove('swap');
    } catch { /* a newer beat took over */ }
  }

  function select(i, { focus = false, play = true } = {}) {
    if (i === cur) { if (focus) tabs[i].focus(); return; }
    cur = i;
    tabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    views.forEach((v, k) => { const on = k === i; v.classList.toggle('is-on', on); v.inert = !on; });
    if (focus) tabs[i].focus();
    pin();
    if (play) beat(i);
  }
  views.forEach((v, k) => { v.inert = k !== cur; });

  /* ---------- the tour: pharmacy, dinner, back to groceries, then it stops for good ---------- */
  const tour = [1, 2, 0];
  let stop = 0; // index into tour of the next stop; Infinity once stopped
  let left = 0;
  let held = false;
  let hovered = false;
  let focused = false;
  let onScreen = false;
  let last = 0;
  let raf = 0;
  const paused = () => held || hovered || focused || !onScreen || document.hidden;
  const bar = (i, p) => tabs.forEach((t, k) => t.querySelector('.btime')?.style.setProperty('--p', k === i ? String(p) : '0'));
  function endTour() {
    if (stop === Infinity) return;
    stop = Infinity;
    cancelAnimationFrame(raf);
    root.classList.remove('touring');
    bar(-1, 0);
    pauseBtn.hidden = true;
  }
  function tick(now) {
    const dt = Math.min(100, now - (last || now));
    last = now;
    if (!paused()) left -= dt;
    const total = DWELL[Math.min(stop, DWELL.length - 1)];
    bar(cur, 1 - Math.max(0, left) / total);
    if (left <= 0) {
      select(tour[stop]);
      stop += 1;
      if (stop >= tour.length) { endTour(); return; }
      left = DWELL[stop];
    }
    raf = requestAnimationFrame(tick);
  }
  function startTour() {
    if (stop !== 0 || reduced()) return;
    left = DWELL[0];
    root.classList.add('touring');
    pauseBtn.hidden = false;
    raf = requestAnimationFrame(tick);
  }
  pauseBtn.addEventListener('click', () => {
    held = !held;
    pauseBtn.setAttribute('aria-label', held ? 'Play' : 'Pause');
    pauseBtn.classList.toggle('is-held', held);
  });

  tabs.forEach((t, i) => t.addEventListener('click', () => { endTour(); select(i); }));
  root.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    const by = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (by) next = (cur + by + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    endTour();
    select(next, { focus: true });
  });
  const hoverZone = root;
  hoverZone.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = true; });
  hoverZone.addEventListener('pointerleave', () => { hovered = false; });
  hoverZone.addEventListener('focusin', (e) => { if (e.target !== pauseBtn) focused = true; });
  hoverZone.addEventListener('focusout', () => { focused = false; });

  // the first beat plays at once (the card arrives with it); the tour starts once the bank lines are on screen
  root.classList.add('s1');
  pin();
  beat(0, { first: true });
  if (!reduced() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) startTour(); }, { threshold: 0.6 });
    io.observe(root.querySelector('.bank-rows'));
  }
}
