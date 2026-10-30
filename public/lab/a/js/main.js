/* main.js: wires prototype A together. */
import { $, $$, reveals } from './util.js';
import { initHero } from './hero.js';
import { mountScan } from './scan-demo.js';
import { initStory } from './story.js';
import { initScenarios } from './scenarios.js';
import { initChat } from './chat.js';
import { initLedger } from './ledger.js';

document.documentElement.classList.add('reveals-on');

const safe = (fn) => Promise.resolve().then(fn).catch((e) => console.error('[lab/a]', e));

safe(initHero);
reveals();
nav();

// "Split it": the story right below already splits this receipt, so the button goes there; any other
// sample, or your own photo, opens the full playground with that receipt.
safe(() => mountScan($('#scan-demo'), {
  splitLabel: 'Split it',
  // rent is not a receipt anyone snaps: the landing scan offers groceries, pharmacy and dinner (/scan/ keeps all four)
  exclude: ['monthly-rent'],
  foldAll: true,
  onSplit(model) {
    if (model.id === 'green-basket') {
      // the same receipt, as it was just read: the story returns to the default split and flashes its header
      document.dispatchEvent(new CustomEvent('tz:story-arrive'));
      // land on the playground ("Tap to change who had what."): on desktop, the last scroll step under the reading line
      const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      const last = $('#story .step[data-step="3"]');
      if (innerWidth >= 900 && last) scrollTo({ top: last.getBoundingClientRect().top + scrollY - innerHeight * 0.4, behavior });
      else $('#story').scrollIntoView({ behavior });
      return;
    }
    let id = model.id;
    if (model.source === 'live') {
      try { sessionStorage.setItem('tz-a-live', JSON.stringify({ raw: model.raw, bill: model.bill })); } catch { id = 'green-basket'; }
    }
    location.href = `./scan/?r=${encodeURIComponent(id)}#split`;
  },
}));
const inits = [safe(initStory), safe(initScenarios), safe(initChat), safe(initLedger)];

// A shared link like /#ai: the scan, story and chat take their final height after the browser's own hash jump, so
// the target drifts (one screen short on a phone). Once they are built, land on it again, unless the visitor has
// already scrolled on their own.
if (location.hash.length > 1) {
  let moved = false;
  const mine = () => { moved = true; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => addEventListener(t, mine, { once: true, passive: true }));
  Promise.all(inits).then(() => requestAnimationFrame(() => {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && !moved) el.scrollIntoView({ block: 'start' });
  }));
}

function nav() {
  const navEl = $('#nav');
  const darks = $$('[data-nav="dark"]');
  let t = false;
  const update = () => {
    t = false;
    navEl.classList.toggle('is-scrolled', scrollY > 8);
    // dark as soon as any dark section is under the bar, so the bar always reads as part of the navy edge it meets
    // (a light bar over the top of a navy band looked like a seam)
    const h = navEl.offsetHeight;
    // a section whose top sits exactly at the bar's bottom (an anchor jump) counts as under it
    const onDark = darks.some((d) => { const r = d.getBoundingClientRect(); return r.top <= h + 1 && r.bottom > 1; });
    navEl.classList.toggle('on-dark', onDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', onDark ? '#0a1020' : '#ffffff');
  };
  const soon = () => { if (!t) { t = true; requestAnimationFrame(update); } };
  addEventListener('scroll', soon, { passive: true });
  // anchor jumps and programmatic scrolls (nav links, "Split it", a chip) settle the colour too, not only wheel scrolls
  addEventListener('scrollend', soon);
  addEventListener('hashchange', () => requestAnimationFrame(soon));
  addEventListener('load', soon);
  update();
}


