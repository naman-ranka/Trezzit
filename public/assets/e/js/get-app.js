/* get-app.js: the store badges on every page, drawn from stores.js. Nothing shows until a store is live.
 *
 *   hero    (home page)       a phone sees ONE badge, its own store, under the micro line. Desktop: nothing.
 *   close   (the last CTA)    a phone sees its own badge; a computer sees both, under the button.
 *   footer  (every page)      both badges, and "iPhone app" / "Android app" in the App column.
 *
 * The badges are Apple's and Google's official artwork, unaltered (assets/stores/), at one height.
 * Inside our own app nothing here runs: the app is the web build, not trezzit.com.
 */
import { platform, storeUrl, anyLive } from './stores.js';

const BADGE = {
  ios: { src: '/assets/stores/app-store-badge.svg', alt: 'Download on the App Store', w: 120, h: 40 },
  android: { src: '/assets/stores/google-play-badge.png', alt: 'Get it on Google Play', w: 135, h: 40 },
};

function badge(os, from) {
  const href = storeUrl(os, from);
  if (!href) return null;
  const b = BADGE[os];
  const a = document.createElement('a');
  a.className = `ga-badge ga-${os}`;
  a.href = href;
  a.rel = 'noopener';
  a.dataset.from = from;
  a.innerHTML = `<img src="${b.src}" alt="${b.alt}" width="${b.w}" height="${b.h}" loading="lazy" decoding="async">`;
  return a;
}

/** Both badges on a computer; on a phone only its own store (or nothing if that store is not live yet). */
function row(from, { both = false, label = '' } = {}) {
  const os = platform();
  const list = both || os === 'desktop' ? ['ios', 'android'] : [os];
  const badges = list.map((o) => badge(o, from)).filter(Boolean);
  if (!badges.length) return null;
  const el = document.createElement('div');
  el.className = `ga ga-${from}`;
  if (label) {
    const p = document.createElement('p');
    p.className = 'ga-label';
    p.textContent = label;
    el.append(p);
  }
  const r = document.createElement('div');
  r.className = 'ga-row';
  r.append(...badges);
  el.append(r);
  return el;
}

export function initGetApp() {
  if (!anyLive()) return;
  const os = platform();

  // Hero: phones only, after the "No bank login needed" line.
  const micro = document.querySelector('.hero .micro');
  if (micro && os !== 'desktop') {
    const r = row('hero');
    if (r) micro.after(r);
  }

  // The page's last call to action.
  const closes = document.querySelectorAll('.close .cta-row');
  const close = closes[closes.length - 1];
  if (close) {
    const r = row('close', { label: os === 'desktop' ? 'Also on iPhone and Android' : '' });
    if (r) close.after(r);
  }

  // Footer: both badges, every page.
  const top = document.querySelector('.foot .foot-top');
  if (top) {
    const r = row('footer', { both: true });
    if (r) top.after(r);
  }
  const appCol = [...document.querySelectorAll('.foot nav .foot-h')].find((h) => h.textContent.trim() === 'App');
  const list = appCol?.nextElementSibling;
  if (list) {
    for (const [o, text] of [['android', 'Android app'], ['ios', 'iPhone app']]) { // prepended: iPhone ends up first
      const href = storeUrl(o, 'footer');
      if (!href) continue;
      const li = document.createElement('li');
      li.innerHTML = `<a href="${href}" rel="noopener">${text}</a>`;
      list.prepend(li);
    }
  }
}
