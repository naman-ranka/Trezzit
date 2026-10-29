/* shared.js: pieces used by both pages (index and scenarios). */

import { PEOPLE, CATEGORIES } from './data.js';
import { money, bankAmt, esc, ICON, reduced, watchVisible, avatar } from './util.js';

export { money, bankAmt };

/* Which kit receipt each statement row comes from (rows without one have no receipt). */
export const SAMPLE_OF = { groceries: 'green-basket', dinner: 'taqueria-sol', pharmacy: 'corner-pharmacy', rent: 'monthly-rent' };

/* ---------- Bank | Trezzit (scoped to one element, e.g. the hero figure) ---------- */
export function initViewToggle(scope, { onChange } = {}) {
  const group = scope.querySelector('[data-vt]');
  const buttons = [...group.querySelectorAll('[data-set-view]')];
  const set = (view) => {
    if (scope.dataset.view === view) return;
    scope.dataset.view = view;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setView === view)));
    onChange?.(view);
  };
  buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.setView)));
  group.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const v = e.key === 'ArrowLeft' ? 'bank' : 'trezzit';
    set(v);
    group.querySelector(`[data-set-view="${v}"]`).focus();
    e.preventDefault();
  });
  return set;
}

/* ---------- nav: hairline when stuck ---------- */
export function initNav() {
  const nav = document.querySelector('[data-nav]');
  const onScroll = () => nav.classList.toggle('is-stuck', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- reveal on scroll ---------- */
export function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.in)');
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}

/* ---------- copy ---------- */
export function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1800);
  }));
}

/* ---------- video: plays only on screen, never under reduced motion, with a pause button ---------- */
export function initVideo(video, btn) {
  if (!video || !btn) return;
  let userPaused = reduced();
  const draw = () => {
    const playing = !video.paused;
    btn.innerHTML = playing ? ICON.pause : ICON.play;
    btn.setAttribute('aria-label', playing ? 'Pause the video' : 'Play the video');
  };
  draw();
  btn.addEventListener('click', () => {
    if (video.paused) { userPaused = false; video.play().catch(() => {}); } else { userPaused = true; video.pause(); }
  });
  video.addEventListener('play', draw);
  video.addEventListener('pause', draw);
  watchVisible(video, (v) => {
    if (v && !userPaused) { video.preload = 'auto'; video.play().catch(() => {}); }
    if (!v && !video.paused) video.pause();
  }, { threshold: 0.25 });
}

/* ---------- statement row, opened: a short read-only summary ---------- */
export function summaryHTML(sc, { base = 'scenarios/' } = {}) {
  const s = sc.sum;
  const res = s.result;
  const b = sc.bank;
  const payerName = PEOPLE[sc.payer]?.name || '';
  const bank = `<div class="sd-bank"><p>${b
    ? `${esc(b.merchant)} ${bankAmt(s.total)} · ${esc(b.cat)}.<br>That&rsquo;s everything your bank knows.`
    : `Not on your statement.<br>${esc(payerName)}&rsquo;s bank has the whole ${money(s.total)}.`}</p></div>`;

  let chips;
  if (sc.people.length > 1) {
    chips = sc.people.map((id) => {
      const p = PEOPLE[id];
      const paid = sc.payer === id ? '<small>paid</small>' : '';
      return `<li class="${id === 'you' ? 'is-you' : ''}">${avatar(p, { size: 'sm' })}<span>${id === 'you' ? 'You' : esc(p.name)}${paid}</span><b class="money">${money(res.people[id]?.cents || 0)}</b></li>`;
    }).join('');
  } else {
    chips = Object.entries(s.byCategory).sort((x, y) => y[1] - x[1]).map(([k, v]) => {
      const c = CATEGORIES[k] || CATEGORIES.other;
      return `<li><span class="dot" style="--c:${c.color}"></span><span>${esc(c.label)}</span><b class="money">${money(v)}</b></li>`;
    }).join('');
  }
  const next = sc.next ? `<p class="sd-next">${ICON.repeat}<span>Adds itself ${esc(sc.next.join(' · '))}</span></p>` : '';
  const split = SAMPLE_OF[sc.id] ? `<a class="sd-link" href="#snap" data-split-it="${SAMPLE_OF[sc.id]}">Split it yourself<span aria-hidden="true">&darr;</span></a>` : '';
  const tz = `<div class="sd-tz">
      <p class="sd-lesson">${esc(sc.lesson || '')}</p>
      <ul class="sd-chips" role="list">${chips}</ul>
      <p class="sd-check">${ICON.check}<span>Adds up to <b class="money">${money(res.totalCents)}</b>, to the cent.</span></p>
      ${next}
      <p class="sd-links">${split}<a class="sd-link" href="${base}#${sc.id}">See it full size<span aria-hidden="true">&rarr;</span></a></p>
    </div>`;
  return bank + tz;
}
