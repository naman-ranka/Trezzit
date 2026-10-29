/* main.js: prototype B page wiring. */

import { loadScenarios, KINDS, PEOPLE } from './data.js';
import { initSnapSplit } from './snap-split.js';
import { initChatDemo } from './chat-demo.js';
import { initReveal, initNav, summaryHTML, bankAmt, itemIndex, wireSearch } from './shared.js';
import { tweenMoney, reduced, money, whenVisible } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

initNav();
initReveal();

/* ---------- hero: tap a bank line, see what you actually spent ----------
   Each bank line is a tab; its Trezzit view counts down from the bank amount to your share.
   All three views share one grid cell, so the card is as tall as the tallest and never
   changes size when you switch. The first count runs once the card is fully on screen. */
const hero = $('[data-hero]');
const tabs = $$('.pb-line', hero);
const views = $$('.pt-view', hero);
let heroTimer = 0;
let current = tabs[0];
function playHero(tab = current) {
  clearTimeout(heroTimer);
  const view = $(`#${tab.getAttribute('aria-controls')}`);
  const amt = $('[data-amt]', view);
  const to = Number(amt.dataset.to);
  hero.classList.add('is-ready');
  if (reduced()) { tweenMoney(amt, to, { dur: 0 }); return; }
  hero.classList.remove('play');
  void hero.offsetWidth;
  const from = Number(tab.dataset.from);
  tweenMoney(amt, from, { dur: 0 });
  hero.classList.add('play');
  if (from !== to) heroTimer = setTimeout(() => tweenMoney(amt, to, { from, dur: 1100 }), 420);
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
tabs.forEach((t) => t.addEventListener('click', () => select(t)));
$('.pb-lines', hero).addEventListener('keydown', (e) => {
  const i = tabs.indexOf(current);
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  let next = null;
  if (step) next = tabs[(i + step + tabs.length) % tabs.length];
  else if (e.key === 'Home') next = tabs[0];
  else if (e.key === 'End') next = tabs[tabs.length - 1];
  if (!next) return;
  e.preventDefault();
  select(next, { focus: true });
});
const firstAmt = $('[data-amt]', views[0]);
if (reduced()) playHero();
else {
  if (firstAmt.getBoundingClientRect().bottom > innerHeight) tweenMoney(firstAmt, 10000, { dur: 0 }); // off screen: hold at the bank amount
  whenVisible(firstAmt, () => playHero(), { threshold: 1 });
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

  /* snap it, split it */
  const snap = initSnapSplit($('[data-snap]'), (sampleId) => Promise.resolve(scenarioForSample[sampleId]));

  /* statement: one row open at a time, opened rows are a short summary */
  const stmt = $('[data-stmt]');
  $$('.srows > .srow', stmt).forEach((li) => {
    const inner = document.createElement('div');
    inner.className = 'srow-in';
    while (li.firstChild) inner.appendChild(li.firstChild);
    li.appendChild(inner);
    // One clear name per row instead of the run-together text of every cell.
    const sc = byId[li.dataset.id];
    const s = sc.sum;
    const bank = sc.bank ? `Bank shows ${bankAmt(s.total).replace('−', 'minus $')}` : `No charge on your statement, ${PEOPLE[sc.payer].name} paid`;
    const share = s.mine === s.total ? `all ${money(s.mine)} is yours` : `you spent ${money(s.mine)} of ${money(s.total)}`;
    $('.srow-btn', li).setAttribute('aria-label', `${sc.title}. ${KINDS[sc.kind].label}. ${bank}; ${share}.`);
  });

  /* item search: one box under the month, over every line of every receipt */
  wireSearch($('.ssearch', stmt), itemIndex(list));

  function toggleRow(li, open) {
    const btn = $('.srow-btn', li);
    const det = $('.sdetail', li);
    if (open && !det.dataset.built) {
      det.innerHTML = summaryHTML(byId[li.dataset.id]);
      det.dataset.built = '1';
    }
    btn.setAttribute('aria-expanded', String(open));
    det.hidden = !open;
  }
  $$('.srow-btn', stmt).forEach((btn) => btn.addEventListener('click', () => {
    const li = btn.closest('.srow');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    if (open) $$('.srows > .srow', stmt).forEach((o) => { if (o !== li && $('.srow-btn', o).getAttribute('aria-expanded') === 'true') toggleRow(o, false); });
    toggleRow(li, open);
  }));
  // Escape closes the open row and puts focus back on it.
  stmt.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const li = e.target.closest('.srows > .srow');
    if (!li || $('.srow-btn', li).getAttribute('aria-expanded') !== 'true') return;
    toggleRow(li, false);
    $('.srow-btn', li).focus();
  });
  // "Change who had what" on the dinner row: land on the section heading and its hint,
  // then hand focus to the open line's faces.
  stmt.addEventListener('click', (e) => {
    const a = e.target.closest('[data-split-it]');
    if (!a) return;
    e.preventDefault();
    $('#snap').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    snap.focusOpen();
  });

  // The footer is the month: what left your account vs your share of everything.
  const paid = list.filter((sc) => sc.bank).reduce((a, sc) => a + sc.sum.total, 0);
  const spent = list.reduce((a, sc) => a + sc.sum.mine, 0);
  $('[data-paid]', stmt).textContent = bankAmt(paid);
  tweenMoney($('[data-spent]', stmt), spent, { dur: 0 });

  /* AI */
  initChatDemo($('#ai'), list);
}).catch((err) => {
  console.error(err);
});
