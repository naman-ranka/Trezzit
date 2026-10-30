/* main.js: prototype B page wiring. */

import { loadScenarios } from './data.js';
import { initSnapSplit } from './snap-split.js';
import { initChatDemo } from './chat-demo.js';
import { initReveal, initNav, itemIndex, bankIndex, wireSearch } from './shared.js';
import { tweenMoney, reduced, whenVisible, watchVisible } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

initNav();
initReveal();

/* ---------- hero: tap a bank line, see what you actually spent ----------
   Each bank line is a tab; its Trezzit view counts down (380 ms, no delay) from the bank amount
   to your share. First paint shows the final $30.00: nothing big is ever wrong for long.
   All views share one grid cell, so the card never changes size when you switch.
   Until the visitor touches the hero, it walks once through shared, personal and recurring
   (Green Basket -> Pharmacy -> Oak St -> back to Green Basket), then stops for good. A thin bar on
   the selected line shows the wait. It pauses on hover, focus, off screen and with the visible
   Pause button (WCAG 2.2.2), stops on any tap of a line, and never runs with reduced motion. */
const hero = $('[data-hero]');
const proof = $('[data-proof]');
const tabs = $$('.pb-line', hero);
const views = $$('.pt-view', hero);
const tourBtn = $('[data-tour-btn]', hero);
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
  placeSeam();
  playHero(tab);
}
views.forEach((v) => { v.inert = !v.classList.contains('is-on'); });

/* the tour: pharmacy, rent, back to groceries, then it stops for good */
const byId = (id) => tabs.find((t) => t.id === id);
const tour = [byId('pb-pharmacy'), byId('pb-rent'), byId('pb-groceries')];
const DWELL = [4600, 3800, 3800]; // the first wait is the longest: the headline is read first
let step = -1;
let hovered = false;
let focused = false;
let onScreen = false;
let held = false; // the Pause button
function stopTour() {
  if (step === Infinity) return;
  step = Infinity;
  hero.classList.remove('is-auto', 'is-paused');
  tourBtn.hidden = true;
}
function pauseTour() { hero.classList.toggle('is-paused', held || hovered || focused || !onScreen); }
function nextStop() {
  step += 1;
  if (step >= tour.length) { stopTour(); return; }
  hero.style.setProperty('--dwell', `${DWELL[step]}ms`);
  hero.classList.remove('is-auto'); void hero.offsetWidth; hero.classList.add('is-auto');
  tourBtn.hidden = false;
}
hero.addEventListener('animationend', (e) => {
  if (e.animationName !== 'tour' || step === Infinity) return;
  select(tour[step]);
  nextStop();
});
tourBtn.addEventListener('click', () => {
  held = !held;
  tourBtn.setAttribute('aria-label', held ? 'Play' : 'Pause');
  tourBtn.classList.toggle('is-held', held);
  pauseTour();
});
const shown = () => tabs.filter((t) => t.offsetParent !== null);
tabs.forEach((t) => t.addEventListener('click', () => { stopTour(); select(t); }));
$('.pb-lines', hero).addEventListener('keydown', (e) => {
  const list = shown();
  const i = list.indexOf(current);
  const by = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  let next = null;
  if (by) next = list[(i + by + list.length) % list.length];
  else if (e.key === 'Home') next = list[0];
  else if (e.key === 'End') next = list[list.length - 1];
  if (!next) return;
  e.preventDefault();
  stopTour();
  select(next, { focus: true });
});
proof.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovered = true; pauseTour(); } });
proof.addEventListener('pointerleave', () => { hovered = false; pauseTour(); });
proof.addEventListener('focusin', (e) => { if (e.target !== tourBtn) { focused = true; pauseTour(); } });
proof.addEventListener('focusout', () => { focused = false; pauseTour(); });
/* watch the bank lines, not the whole card: on a phone the card is taller than the space under
   the headline, so half of it is never on screen at first load and the tour would never start */
const lines = $('.pb-lines', hero);
if (!reduced()) {
  watchVisible(lines, (v) => { onScreen = v; pauseTour(); }, { threshold: 0.6 });
  whenVisible(lines, () => { if (step === -1) nextStop(); }, { threshold: 0.6 });
}
/* a phone hides the two extra statement lines: if one was selected, fall back to the first */
addEventListener('resize', () => { if (current.offsetParent === null) select(tabs[0]); }, { passive: true });
/* the arrow sits on the selected bank line (CSS places it on the first line before JS runs) */
const seam = $('.seam', hero);
function placeSeam() {
  if (innerWidth < 640) { seam.style.top = ''; return; }
  const f = current.getBoundingClientRect();
  const p = seam.offsetParent.getBoundingClientRect();
  const top = `${Math.round(f.top + f.height / 2 - p.top - 17)}px`;
  if (seam.style.top !== top) seam.style.top = top;
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

  /* search: one query, two searches (the bank's store names vs every item); the total under
     Trezzit's results is your share of what matched (the month when the field is empty) */
  const find = $('[data-find]');
  const month = list.reduce((a, sc) => a + sc.sum.mine, 0);
  wireSearch(find, itemIndex(list), bankIndex(list), month);

  /* AI */
  initChatDemo($('#ai'), list);
}).catch((err) => {
  console.error(err);
});
