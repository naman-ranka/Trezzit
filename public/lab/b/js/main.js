/* main.js: prototype B page wiring. */

import { loadScenarios } from './data.js';
import { initSnapSplit } from './snap-split.js';
import { initChatDemo } from './chat-demo.js';
import { initReveal, initNav, bankAmt, itemIndex, bankIndex, wireSearch } from './shared.js';
import { tweenMoney, reduced, whenVisible, watchVisible } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

initNav();
initReveal();

/* ---------- hero: tap a bank line, see what you actually spent ----------
   Each bank line is a tab; its Trezzit view counts down (380 ms, no delay) from the bank amount
   to your share. First paint shows the final $30.00: nothing big is ever wrong for long.
   All three views share one grid cell, so the card never changes size when you switch.
   Until the visitor touches the hero, it walks once through the three lines (shared, personal,
   recurring) every 5 s, then rests on the first. A thin bar on the selected line shows the wait;
   it pauses on hover, focus or when the card is off screen, and never runs with reduced motion. */
const hero = $('[data-hero]');
const proof = $('[data-proof]');
const tabs = $$('.pb-line', hero);
const views = $$('.pt-view', hero);
let current = tabs[0];
hero.classList.add('is-ready');
function playHero(tab = current) {
  const view = $(`#${tab.getAttribute('aria-controls')}`);
  const amt = $('[data-amt]', view);
  const to = Number(amt.dataset.to);
  if (reduced()) { tweenMoney(amt, to, { dur: 0 }); return; }
  hero.classList.remove('play');
  void hero.offsetWidth;
  hero.classList.add('play');
  tweenMoney(amt, to, { from: Number(tab.dataset.from), dur: 380 });
}
function select(tab, { focus = false } = {}) {
  if (tab === current) { if (focus) tab.focus(); return; }
  current = tab;
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  views.forEach((v) => {
    const on = v.id === tab.getAttribute('aria-controls');
    v.classList.toggle('is-on', on);
    v.inert = !on;
  });
  if (focus) tab.focus();
  $('[data-paid-amt]', hero).textContent = tab.lastElementChild.textContent;
  placeSeam();
  playHero(tab);
}
views.forEach((v) => { v.inert = !v.classList.contains('is-on'); });

/* the tour: pharmacy, rent, back to groceries, then it stops for good */
const tour = [tabs[1], tabs[2], tabs[0]];
let step = -1;
let hovered = false;
let focused = false;
let onScreen = false;
function stopTour() {
  if (step === Infinity) return;
  step = Infinity;
  hero.classList.remove('is-auto', 'is-paused');
}
function pauseTour() { hero.classList.toggle('is-paused', hovered || focused || !onScreen); }
function nextStop() {
  step += 1;
  if (step >= tour.length) { stopTour(); return; }
  hero.classList.remove('is-auto'); void hero.offsetWidth; hero.classList.add('is-auto');
}
hero.addEventListener('animationend', (e) => {
  if (e.animationName !== 'tour' || step === Infinity) return;
  select(tour[step]);
  nextStop();
});
tabs.forEach((t) => t.addEventListener('click', () => { stopTour(); select(t); }));
$('.pb-lines', hero).addEventListener('keydown', (e) => {
  const i = tabs.indexOf(current);
  const by = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  let next = null;
  if (by) next = tabs[(i + by + tabs.length) % tabs.length];
  else if (e.key === 'Home') next = tabs[0];
  else if (e.key === 'End') next = tabs[tabs.length - 1];
  if (!next) return;
  e.preventDefault();
  stopTour();
  select(next, { focus: true });
});
proof.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovered = true; pauseTour(); } });
proof.addEventListener('pointerleave', () => { hovered = false; pauseTour(); });
proof.addEventListener('focusin', () => { focused = true; pauseTour(); });
proof.addEventListener('focusout', () => { focused = false; pauseTour(); });
if (!reduced()) {
  watchVisible(proof, (v) => { onScreen = v; pauseTour(); }, { threshold: 0.6 });
  whenVisible(proof, () => { if (step === -1) nextStop(); }, { threshold: 0.6 });
}
/* the arrow sits on the selected bank line (layout decides where that is) */
const seam = $('.seam', hero);
function placeSeam() {
  if (innerWidth < 640) { seam.style.top = ''; return; }
  const f = current.getBoundingClientRect();
  const p = seam.offsetParent.getBoundingClientRect();
  seam.style.top = `${Math.round(f.top + f.height / 2 - p.top - 17)}px`;
}
placeSeam();
addEventListener('resize', placeSeam, { passive: true });
document.fonts?.ready.then(placeSeam);

/* ---------- everything that needs the scenarios ---------- */
loadScenarios().then((list) => {
  const byId = Object.fromEntries(list.map((s) => [s.id, s]));
  const scenarioForSample = { 'taqueria-sol': byId.dinner };

  /* split it by the item */
  initSnapSplit($('[data-snap]'), (sampleId) => Promise.resolve(scenarioForSample[sampleId]));

  /* search: one query, two searches (the bank's store names vs every item), and the month in one line */
  const find = $('[data-find]');
  wireSearch(find, itemIndex(list), bankIndex(list));
  const paid = list.filter((sc) => sc.bank).reduce((a, sc) => a + sc.sum.total, 0);
  const spent = list.reduce((a, sc) => a + sc.sum.mine, 0);
  $('[data-paid]', find).textContent = bankAmt(paid);
  tweenMoney($('[data-spent]', find), spent, { dur: 0 });

  /* AI */
  initChatDemo($('#ai'), list);
}).catch((err) => {
  console.error(err);
});
