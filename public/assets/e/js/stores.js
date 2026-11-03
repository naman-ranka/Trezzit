/* stores.js: the ONE switch for every "get the app" prompt on trezzit.com.
 *
 * Until a store is live its prompts stay hidden (the badges, the /app redirect, the footer links).
 * At launch: set `live: true` (and the App Store `appId`), then run `node scripts/app-banner.mjs`,
 * which writes iOS Safari's Smart App Banner meta into every page from these same values.
 *
 * Review before launch: add ?get-app=preview to any page. Prompts show with a placeholder App Store
 * link, for that tab only (sessionStorage); ?get-app=off clears it.
 */
export const STORES = {
  ios: { live: false, appId: '' }, // App Store Connect › App Information › Apple ID, digits only
  android: { live: false, package: 'com.trezzit.app' },
};

const PREVIEW_KEY = 'trezzit-get-app-preview';

function previewOn() {
  try {
    const q = new URLSearchParams(location.search).get('get-app');
    if (q === 'preview') sessionStorage.setItem(PREVIEW_KEY, '1');
    if (q === 'off') sessionStorage.removeItem(PREVIEW_KEY);
    return sessionStorage.getItem(PREVIEW_KEY) === '1';
  } catch { return false; }
}
const PREVIEW = previewOn();

/** 'ios' | 'android' | 'desktop'. iPadOS reports a Mac; a touch screen gives it away. */
export function platform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** The store page for `os`, or null while that store is not live. `from` names the prompt (Play install referrer). */
export function storeUrl(os, from = 'site') {
  if (os === 'ios') {
    if (STORES.ios.live && STORES.ios.appId) return `https://apps.apple.com/app/id${STORES.ios.appId}`;
    return PREVIEW ? 'https://apps.apple.com/us/search?term=trezzit' : null;
  }
  if (os === 'android') {
    if (!STORES.android.live && !PREVIEW) return null;
    const ref = encodeURIComponent(`utm_source=trezzit.com&utm_medium=${from}`);
    return `https://play.google.com/store/apps/details?id=${STORES.android.package}&referrer=${ref}`;
  }
  return null;
}

/** True when at least one store is live (or the preview is on). */
export const anyLive = () => Boolean(storeUrl('ios') || storeUrl('android'));
