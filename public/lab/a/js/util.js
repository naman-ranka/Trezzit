/* util.js: small shared helpers for prototype A. */
import { formatMoney } from '/assets/_kit/split-engine.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const rmq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reduced = () => !!rmq?.matches;

/** "$30.00"; negatives use a true minus sign. */
export const money = (cents, cur = 'USD') => {
  const s = formatMoney(Math.abs(cents), cur);
  return cents < 0 ? `−${s}` : s;
};

/** Escape for innerHTML. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Receipt line -> readable name: "EGGS LARGE 18CT" -> "Eggs large 18ct", "SUNSCREEN SPF50" -> "Sunscreen SPF50". */
export function prettyName(raw) {
  const words = String(raw || '').trim().split(/\s+/);
  const out = words.map((w, i) => {
    if (/^(SPF\d+|\d+IU|IU|1L|2L)$/i.test(w)) return w.toUpperCase();
    if (/\d/.test(w)) return w.toLowerCase();
    if (w === '&') return '&';
    const l = w.toLowerCase();
    return i === 0 ? l.charAt(0).toUpperCase() + l.slice(1) : l;
  });
  // a statement line like "RENT NOVEMBER" reads as just "Rent" (the month is the bill's date)
  return out.join(' ').replace(/\b(\d+)l\b/, '$1 L').replace(/ (january|february|march|april|may|june|july|august|september|october|november|december)$/i, '');
}

/** Animate a money figure. Returns a promise. */
export function countTo(el, from, to, { dur = 700, cur = 'USD' } = {}) {
  if (!el) return Promise.resolve();
  const tok = (el.__count = (el.__count || 0) + 1); // a newer count on the same element wins
  if (reduced() || dur <= 0 || from === to) { el.textContent = money(to, cur); return Promise.resolve(); }
  const t0 = performance.now();
  return new Promise((resolve) => {
    const tick = (t) => {
      if (el.__count !== tok) { resolve(); return; }
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = money(Math.round(from + (to - from) * e), cur);
      if (k < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/** Move focus to el() once a programmatic (smooth) scroll has settled, without scrolling again. */
export function focusAfterScroll(el) {
  let done = false;
  const go = () => { if (done) return; done = true; el()?.focus({ preventScroll: true }); };
  addEventListener('scrollend', go, { once: true });
  setTimeout(go, 1000);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run cb once when el first comes into view. */
export function onceVisible(el, cb, { threshold = 0.35, rootMargin = '0px' } = {}) {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); cb(); }
  }, { threshold, rootMargin });
  io.observe(el);
}

/** Toggle `.is-in` on reveal elements as they enter (once). */
export function reveals(root = document) {
  const els = $$('[data-reveal]', root);
  if (!('IntersectionObserver' in window) || reduced()) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}

export const ICON = {
  check: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7 4.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="5.5" y="4.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="11.5" y="4.5" width="3" height="11" rx="1" fill="currentColor"/></svg>',
  replay: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 2.8v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  spark: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 2.5l1.6 4.6 4.6 1.6-4.6 1.6L10 15l-1.6-4.7-4.6-1.6 4.6-1.6z" fill="currentColor"/></svg>',
  upload: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 13V3.5m-4 4l4-4 4 4M4 13.5v1.8c0 .7.5 1.2 1.2 1.2h9.6c.7 0 1.2-.5 1.2-1.2v-1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13.2 13.2L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  repeat: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 9V8a3 3 0 0 1 3-3h8m-2.5-2.5L15 5l-2.5 2.5M16 11v1a3 3 0 0 1-3 3H5m2.5 2.5L5 15l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 9V6.8a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  eye: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.2" fill="currentColor"/></svg>',
  list: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7.5 5.5h9m-9 4.5h9m-9 4.5h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="4" cy="5.5" r="1.1" fill="currentColor"/><circle cx="4" cy="10" r="1.1" fill="currentColor"/><circle cx="4" cy="14.5" r="1.1" fill="currentColor"/></svg>',
  unplug: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7 3v3.5M13 3v3.5M5.5 6.5h9V9a4.5 4.5 0 0 1-9 0zM10 13.5V17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  card: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 8h15" stroke="currentColor" stroke-width="1.6"/></svg>',
};

/** Avatar HTML for a PEOPLE entry. */
const YOU = '<svg viewBox="0 0 20 20" width="55%" height="55%" aria-hidden="true"><circle cx="10" cy="6.6" r="3.6" fill="currentColor"/><path d="M3.2 17.4c.6-3.6 3.4-5.6 6.8-5.6s6.2 2 6.8 5.6z" fill="currentColor"/></svg>';
export const avatar = (p, cls = '') => `<span class="av ${cls}" style="--c:${p.color}" aria-hidden="true">${p.id === 'you' ? YOU : esc(p.initials)}</span>`;

/** The kit's paper receipt, minus its "ITEMS n" footer (it counts units, which reads like a scan error next to 14 lines). */
export const paper = (html) => html.replace(/\s*<p>ITEMS \d+<\/p>/, '');
