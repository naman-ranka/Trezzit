/* main.js: prototype B page wiring. */

import { loadScenarios, KINDS, PEOPLE } from './data.js';
import { initSnapSplit } from './snap-split.js';
import { initChatDemo } from './chat-demo.js';
import { initViewToggle, initReveal, initNav, initCopy, summaryHTML, bankAmt } from './shared.js';
import { tweenMoney, reduced, money, whenVisible } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

initNav();
initReveal();
initCopy();

/* ---------- hero: the bank line becomes what you spent ----------
   The count runs from the bank's $100.00 down to $30.00, once, when the card is
   actually on screen (on a phone it can start below the fold). Switching back
   from Bank view plays it again. */
const proof = $('[data-proof]');
const hero = $('[data-hero]');
const heroAmt = $('[data-hero-amt]');
let heroTimer = 0;
function playHero() {
  clearTimeout(heroTimer);
  hero.classList.add('is-ready');
  if (reduced()) { tweenMoney(heroAmt, 3000, { dur: 0 }); return; }
  hero.classList.remove('play');
  void hero.offsetWidth;
  tweenMoney(heroAmt, 10000, { dur: 0 });
  hero.classList.add('play');
  heroTimer = setTimeout(() => tweenMoney(heroAmt, 3000, { from: 10000, dur: 1100 }), 420);
}
if (reduced()) playHero();
else {
  const r = heroAmt.getBoundingClientRect();
  if (r.bottom > innerHeight) tweenMoney(heroAmt, 10000, { dur: 0 }); // off screen: hold at the bank amount
  whenVisible(heroAmt, playHero, { threshold: 1 });
}
initViewToggle(proof, { onChange: (v) => { if (v === 'trezzit') playHero(); } });
/* the arrow sits on the bank line it comes from (layout decides where that is) */
const seam = $('.seam', hero);
const focal = $('.pb-lines .focal', hero);
function placeSeam() {
  if (innerWidth < 640) { seam.style.top = ''; return; }
  const f = focal.getBoundingClientRect();
  const p = seam.offsetParent.getBoundingClientRect();
  seam.style.top = `${Math.round(f.top + f.height / 2 - p.top - 17)}px`;
}
placeSeam();
addEventListener('resize', placeSeam, { passive: true });
document.fonts?.ready.then(placeSeam);

/* ---------- everything that needs the scenarios ---------- */
loadScenarios().then((list) => {
  const byId = Object.fromEntries(list.map((s) => [s.id, s]));
  const scenarioForSample = { 'green-basket': byId.groceries, 'taqueria-sol': byId.dinner };

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
  stmt.addEventListener('click', (e) => {
    const a = e.target.closest('[data-split-it]');
    if (!a) return;
    e.preventDefault();
    snap.load(a.dataset.splitIt);
    $(innerWidth < 900 ? '#snap .snap-grid' : '#snap [data-snap]').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    $(`[data-sample="${a.dataset.splitIt}"]`)?.focus({ preventScroll: true });
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
