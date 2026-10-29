/* main.js: prototype B page wiring. */

import { loadScenarios } from './data.js';
import { initSnapSplit } from './snap-split.js';
import { initChatDemo } from './chat-demo.js';
import { initViewToggle, initReveal, initNav, initCopy, initVideo, summaryHTML, bankAmt, SAMPLE_OF } from './shared.js';
import { tweenMoney, reduced } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

initNav();
initReveal();
initCopy();
initVideo($('[data-video]'), $('[data-video-btn]'));

/* ---------- hero: the bank line becomes what you spent ---------- */
const proof = $('[data-proof]');
const hero = $('[data-hero]');
const heroAmt = $('[data-hero-amt]');
let heroTimer = 0;
function playHero() {
  clearTimeout(heroTimer);
  hero.classList.add('is-ready');
  if (reduced()) { heroAmt.dataset.cents = '3000'; heroAmt.textContent = '$30.00'; return; }
  hero.classList.remove('play');
  void hero.offsetWidth;
  tweenMoney(heroAmt, 10000, { dur: 0 });
  hero.classList.add('play');
  heroTimer = setTimeout(() => tweenMoney(heroAmt, 3000, { from: 10000, dur: 1100 }), 420);
}
playHero();
const setView = initViewToggle(proof, { onChange: (v) => { if (v === 'trezzit') playHero(); } });
$('[data-replay-hero]').addEventListener('click', () => {
  if (proof.dataset.view === 'bank') setView('trezzit'); else playHero();
});

/* ---------- everything that needs the scenarios ---------- */
loadScenarios().then((list) => {
  const byId = Object.fromEntries(list.map((s) => [s.id, s]));
  const bySample = Object.fromEntries(Object.entries(SAMPLE_OF).map(([id, sample]) => [sample, byId[id]]));

  /* snap it, split it */
  const snap = initSnapSplit($('[data-snap]'), (sampleId) => Promise.resolve(bySample[sampleId]));

  /* statement: one row open at a time, opened rows are a short summary */
  const stmt = $('[data-stmt]');
  const paidEl = $('[data-paid]', stmt);
  const spentEl = $('[data-spent]', stmt);
  $$('.srows > .srow', stmt).forEach((li) => {
    const inner = document.createElement('div');
    inner.className = 'srow-in';
    while (li.firstChild) inner.appendChild(li.firstChild);
    li.appendChild(inner);
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

  let filter = 'all';
  function recompute() {
    let paid = 0; let spent = 0;
    list.forEach((sc) => {
      if (filter !== 'all' && sc.kind !== filter) return;
      if (sc.bank) paid += sc.sum.total;
      spent += sc.sum.mine;
    });
    paidEl.textContent = bankAmt(paid);
    tweenMoney(spentEl, spent);
  }
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $$('.srows > .srow', stmt).forEach((li) => {
      const out = filter !== 'all' && li.dataset.kind !== filter;
      li.classList.toggle('is-out', out);
      li.inert = out;
      if (out && $('.srow-btn', li).getAttribute('aria-expanded') === 'true') toggleRow(li, false);
    });
    recompute();
  }));

  /* AI */
  initChatDemo($('#ai'), list);
}).catch((err) => {
  console.error(err);
});
