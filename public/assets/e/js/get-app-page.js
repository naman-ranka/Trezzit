/* get-app-page.js: trezzit.com/app, the one link to share or print for the app.
 *
 *   a phone, its store live    → straight to that store (location.replace, so Back returns where they came from)
 *   a computer, a store live   → both badges and a QR code of this page: scanned, the phone takes the first path
 *   no store live yet          → the page as written: "Coming soon", and the web app
 */
import { initPage } from './page.js';
import { platform, storeUrl, anyLive } from './stores.js';
import { qrSvgPath } from './qr.js';

initPage();

const body = document.querySelector('[data-get-app-page]');
const web = document.querySelector('.get-app-web');
const os = platform();
const from = new URLSearchParams(location.search).get('from') || 'app-page';

if (body && anyLive()) {
  const own = os === 'desktop' ? null : storeUrl(os, from);
  if (own) {
    const store = os === 'ios' ? 'the App Store' : 'Google Play';
    body.innerHTML = `<p class="get-app-soon">Opening ${store}…</p><div class="cta-row"><a class="c-btn c-btn-primary c-btn-lg" href="${own}" rel="noopener">Open ${store}</a></div>`;
    location.replace(own);
  } else {
    // Computer (or a phone whose store is not live yet): the badges, and on a computer a code for the phone.
    const badges = [['ios', '/assets/stores/app-store-badge.svg', 'Download on the App Store', 120],
      ['android', '/assets/stores/google-play-badge.png', 'Get it on Google Play', 135]]
      .map(([o, src, alt, w]) => {
        const href = storeUrl(o, from);
        return href ? `<a class="ga-badge ga-${o}" href="${href}" rel="noopener"><img src="${src}" alt="${alt}" width="${w}" height="40"></a>` : '';
      }).join('');
    let qr = '';
    if (os === 'desktop') {
      const { d, extent } = qrSvgPath('https://trezzit.com/app?from=qr', { quietZone: 2 });
      qr = `<figure class="get-app-qr"><svg viewBox="0 0 ${extent} ${extent}" role="img" aria-label="QR code that opens trezzit.com/app on your phone" shape-rendering="crispEdges"><path d="${d}" fill="currentColor"/></svg><figcaption>Point your phone’s camera here.</figcaption></figure>`;
    }
    body.innerHTML = `<div class="ga"><div class="ga-row">${badges}</div></div>${qr}`;
  }
  web?.removeAttribute('hidden');
}
