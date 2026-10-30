/* util.js: small DOM + money helpers shared by every demo on lab C. */
import { formatMoney, toCents } from '../../_kit/split-engine.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Template literal -> first element. */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** cents -> "$1,234.56" */
export const money = (cents, cur = 'USD') => formatMoney(cents, cur);
export const cents = toCents;

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (ms <= 0) return resolve();
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/** Loads css/demo-<name>.css once (a page that links it already resolves at once). Resolves when the
 *  styles apply, so a demo never paints unstyled; a failed load resolves too (the demo still works). */
const sheets = new Map();
export function css(name) {
  if (sheets.has(name)) return sheets.get(name);
  const href = new URL(`../css/demo-${name}.css`, import.meta.url).href;
  const have = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === href);
  const p = have ? Promise.resolve() : new Promise((resolve) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    l.onload = l.onerror = () => resolve();
    document.head.appendChild(l);
  });
  sheets.set(name, p);
  return p;
}

/** Calls cb once when el is at least `threshold` visible. */
export function onVisible(el, cb, { threshold = 0.35, rootMargin = '0px' } = {}) {
  if (!('IntersectionObserver' in window)) { cb(); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); cb(); }
  }, { threshold, rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/** Tween a money figure from `from` to `to` cents. */
const tweens = new WeakMap();
export function countMoney(el, from, to, dur = 700, cur = 'USD') {
  // a newer tween on the same element always wins (no two counts fighting over one figure)
  const my = (tweens.get(el) || 0) + 1;
  tweens.set(el, my);
  if (reduced() || dur <= 0 || from === to) { el.textContent = money(to, cur); return Promise.resolve(); }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const step = (now) => {
      if (tweens.get(el) !== my) { resolve(); return; }
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = money(Math.round(from + (to - from) * ease(p)), cur);
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** "WHOLE MILK 1 GAL" -> "Whole milk 1 gal" (sentence case, keeps units readable). */
export function itemName(raw) {
  const s = String(raw || '').trim();
  if (/[a-z]/.test(s)) return s;
  // "RENT NOVEMBER" reads as "November rent", not "Rent november"
  const month = /^RENT (JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)$/i.exec(s);
  if (month) return `${month[1].charAt(0)}${month[1].slice(1).toLowerCase()} rent`;
  const UNIT = { oz: 'oz', lb: 'lb', ct: 'ct', pk: 'pk', l: 'L', gal: 'gal', iu: 'IU' };
  const words = s.split(/\s+/).map((w) => {
    const u = /^(\d+)(oz|lb|ct|pk|l|gal|iu)$/i.exec(w);
    if (u) return `${u[1]} ${UNIT[u[2].toLowerCase()]}`;
    if (/[a-z]/i.test(w) && /\d/.test(w)) return w.toUpperCase(); // D3, SPF50
    return w.toLowerCase();
  });
  const out = words.join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Title case for store names. */
export const storeName = (raw) => String(raw || '').toLowerCase().replace(/(^|[\s\-&])([a-z])/g, (m, b, l) => b + l.toUpperCase());

export const prettyDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

/** Simple pub/sub so one demo can hand a receipt to the next. */
const listeners = new Map();
export const bus = {
  on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type).delete(fn); },
  emit(type, detail) { (listeners.get(type) || []).forEach((fn) => fn(detail)); },
};

/** Inline SVG icons (stroke = currentColor). */
export const icon = {
  check: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M6 4.5v11l9-5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M6 4.5h2.6v11H6zM11.4 4.5H14v11h-2.6z" fill="currentColor"/></svg>',
  replay: '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4M4.5 3.5V7h3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  upload: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13.2 13.2L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  repeat: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M15.5 8A6 6 0 0 0 4.7 6.2M4.5 12a6 6 0 0 0 10.8 1.8M4.5 3v3.5H8M15.5 17v-3.5H12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sparkle: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M13 7V5a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 4 5v6a1.5 1.5 0 0 0 1.5 1.5H7" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  plus: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  tool: '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M3.5 6.5h13M3.5 10h13M3.5 13.5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/** "You" is a person glyph, never the word squeezed into a circle (the name sits beside it). */
export const YOU_GLYPH = '<svg class="av-you" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7.2" r="3.3" fill="currentColor"/><path d="M3.8 17.2c.7-3.3 3.2-5.2 6.2-5.2s5.5 1.9 6.2 5.2z" fill="currentColor"/></svg>';

/** Person avatar markup. */
export function avatar(p, { size = 'md', pressed = null, label = '' } = {}) {
  const init = p.id === 'you' ? YOU_GLYPH : esc(p.name.charAt(0));
  return `<span class="av av-${size}" style="--av:${p.color}" aria-hidden="true">${init}</span>`;
}
