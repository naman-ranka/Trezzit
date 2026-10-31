/* basic-page.js: pages with no demo (404, the legal pages): the nav, the theme toggle, copy buttons, and on the
 * legal pages the "On this page" list: open beside the text from 900px, marking the section you are in. */
import { initPage } from './page.js';

initPage();

const toc = document.querySelector('.pg-legal .doc-toc');
if (toc) {
  const det = toc.querySelector('details');
  const sum = det?.querySelector('summary');
  const wide = matchMedia('(min-width: 900px)');
  if (det) {
    // wide: the list is forced open beside the text, so its summary is no tab stop
    const sync = () => {
      if (wide.matches) { det.open = true; sum?.setAttribute('tabindex', '-1'); } else sum?.removeAttribute('tabindex');
    };
    wide.addEventListener?.('change', (e) => { det.open = e.matches; sync(); });
    det.addEventListener('toggle', () => { if (wide.matches && !det.open) det.open = true; });
    sync();
  }
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))));
  let cur = null; let raf = 0;
  let pinned = null; let pinnedAt = 0;
  // the current link stays visible inside the TOC's own scroll box (the TOC scrolls, never the page)
  const reveal = (a) => {
    if (toc.scrollHeight <= toc.clientHeight + 1) return;
    const t = a.getBoundingClientRect(); const b = toc.getBoundingClientRect();
    if (t.top < b.top + 8) toc.scrollTop -= b.top + 8 - t.top;
    else if (t.bottom > b.bottom - 8) toc.scrollTop += t.bottom - (b.bottom - 8);
  };
  const mark = (a) => {
    if (a === cur) return;
    cur?.removeAttribute('aria-current');
    if (a) { a.setAttribute('aria-current', 'location'); reveal(a); }
    cur = a;
  };
  // scroll-spy: the last heading above the top third of the screen; at the very end of the page, the last
  // heading on screen (a short last section never reaches the top third); a clicked link holds until you scroll
  const spy = () => {
    raf = 0;
    if (pinned && performance.now() - pinnedAt < 400) { mark(pinned); return; }
    pinned = null;
    const line = innerHeight * 0.3;
    let k = -1;
    heads.forEach((h, i) => { if (h && h.getBoundingClientRect().top <= line) k = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
      heads.forEach((h, i) => { if (h && h.getBoundingClientRect().top < innerHeight) k = i; });
    }
    mark(k >= 0 ? links[k] : null);
  };
  links.forEach((a) => a.addEventListener('click', () => { pinned = a; pinnedAt = performance.now(); mark(a); }));
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
  addEventListener('hashchange', () => { if (pinned) mark(pinned); });
  spy();
}
