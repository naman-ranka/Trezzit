/* basic-page.js: pages with no demo (404, the legal pages): the nav, the theme toggle, copy buttons, and on the
 * legal pages the "On this page" list: open beside the text from 1080px, marking the section you are in. */
import { initPage } from './page.js';

initPage();

const toc = document.querySelector('.pg-legal .doc-toc');
if (toc) {
  const det = toc.querySelector('details');
  const wide = matchMedia('(min-width: 1080px)');
  if (det) {
    const sync = () => { if (wide.matches) det.open = true; };
    wide.addEventListener?.('change', (e) => { det.open = e.matches; });
    det.addEventListener('toggle', sync);
    sync();
  }
  // scroll-spy: the last section heading above the top third of the screen is the current one
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))).filter(Boolean);
  let cur = null; let raf = 0;
  const spy = () => {
    raf = 0;
    const line = innerHeight * 0.3;
    let k = -1;
    heads.forEach((h, i) => { if (h.getBoundingClientRect().top <= line) k = i; });
    const a = k >= 0 ? links[k] : null;
    if (a === cur) return;
    cur?.removeAttribute('aria-current');
    if (a) a.setAttribute('aria-current', 'location');
    cur = a;
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
  spy();
}
