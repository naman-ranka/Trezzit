/* get-app.js: the store links behind every "Get the app" button.
 *
 * The pages are written so they work with no JavaScript: a "Get the app" button links to /app, which sends a
 * phone to its own store, and the badges link to the stores themselves. Here a phone's buttons are pointed
 * straight at its store, saving the hop through /app. Which device this is comes from <html data-os>, set by
 * the inline script in each page's <head> (ios | android | desktop | app). site.css does the showing and hiding.
 */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/trezzit-spending-splits/id6828622388';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.trezzit.app';

/** This phone's store page, or null on a computer and inside the Trezzit app. `from` names the button (Google Play's install referrer). */
export function ownStoreUrl(from = 'site') {
  const os = document.documentElement.dataset.os;
  if (os === 'ios') return APP_STORE_URL;
  if (os === 'android') return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`utm_source=trezzit.com&utm_medium=${from}`)}`;
  return null;
}

export function initGetApp() {
  document.querySelectorAll('a[data-get-app]').forEach((a) => {
    const href = ownStoreUrl(a.dataset.getApp || 'site');
    if (!href) return;
    a.href = href;
    a.rel = 'noopener';
  });
}
