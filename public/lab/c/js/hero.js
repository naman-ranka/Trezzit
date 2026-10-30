/* hero.js: the bank line becomes what you spent. Runs once (about 0.7 s),
 * replayable; with reduced motion (or no JS) the final state is simply shown.
 * Only the amount and the share bar move: every row is readable from the first frame.
 * Pre-states live in CSS under html.anim .hero-viz:not(.sN). */
import { countMoney, reduced, sleep } from './util.js';

export function initHero(root) {
  if (!root) return;
  const amt = root.querySelector('[data-amt]');
  const label = root.querySelector('[data-label]');
  const replay = root.querySelector('[data-replay]');
  const owe = root.querySelector('.tzc-owe');
  const who = root.querySelector('.tzc-who');
  const tzc = root.querySelector('.tzc');
  const side = [root.querySelector('.bank'), root.querySelector('.hero-join')];
  let run = 0;

  const setOpen = (open) => { owe?.setAttribute('aria-expanded', String(open)); if (who) who.hidden = !open; };

  // desktop: the bank card and the arrow centre on the closed Trezzit card and stay put when "Owed to you" opens
  const wide = matchMedia('(min-width: 900px)');
  const pin = () => {
    if (!wide.matches) { side.forEach((el) => el && (el.style.marginTop = '')); return; }
    if (owe?.getAttribute('aria-expanded') === 'true') return;
    const hT = tzc.offsetHeight;
    side.forEach((el) => { if (el) el.style.marginTop = `${Math.max(0, Math.round((hT - el.offsetHeight) / 2))}px`; });
  };
  root.classList.add('pinned');
  pin();
  addEventListener('resize', pin);
  document.fonts?.ready.then(pin);

  const finish = () => {
    root.classList.add('s1', 's2', 's3', 's4');
    countMoney(amt, 3000, 3000, 0);
    label.textContent = 'You spent';
  };

  async function play() {
    const my = ++run;
    root.classList.remove('swap');
    setOpen(false);
    pin();
    if (reduced() || !document.documentElement.classList.contains('anim')) { finish(); return; }
    root.classList.remove('s1', 's2', 's3', 's4');
    countMoney(amt, 10000, 10000, 0); // also cancels a count still running from the last play
    label.textContent = 'You paid';
    void root.offsetWidth;
    const step = async (ms, cls) => { await sleep(ms); if (my !== run) throw new Error('stale'); if (cls) root.classList.add(cls); };
    try {
      await step(150, 's1');          // the bank line lights up, the Trezzit card arrives
      await step(300, 's2');          // the $100.00 splits into four shares
      // "You paid $100.00" fades into "You spent $30.00": no in-between figure is ever on screen
      root.classList.add('swap');
      await step(180);
      countMoney(amt, 3000, 3000, 0);
      label.textContent = 'You spent';
      root.classList.remove('swap');
      root.classList.add('s3', 's4');
    } catch { /* a newer run took over */ }
  }

  // "Owed to you" opens to who owes what (and how it gets settled)
  owe?.addEventListener('click', () => setOpen(owe.getAttribute('aria-expanded') !== 'true'));
  replay?.addEventListener('click', play);
  play();
}
