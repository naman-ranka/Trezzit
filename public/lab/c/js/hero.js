/* hero.js: the bank line becomes what you spent. Runs once (about 1.9 s),
 * replayable; with reduced motion (or no JS) the final state is simply shown.
 * Pre-states live in CSS under html.anim .hero-viz:not(.sN). */
import { countMoney, reduced, sleep } from './util.js';

export function initHero(root) {
  if (!root) return;
  const amt = root.querySelector('[data-amt]');
  const label = root.querySelector('[data-label]');
  const replay = root.querySelector('[data-replay]');
  let run = 0;

  const finish = () => {
    root.classList.add('s1', 's2', 's3', 's4');
    countMoney(amt, 3000, 3000, 0);
    label.textContent = 'You spent';
  };

  async function play() {
    const my = ++run;
    if (reduced() || !document.documentElement.classList.contains('anim')) { finish(); return; }
    root.classList.remove('s1', 's2', 's3', 's4');
    countMoney(amt, 10000, 10000, 0); // also cancels a count still running from the last play
    label.textContent = 'You paid';
    void root.offsetWidth;
    const step = async (ms, cls) => { await sleep(ms); if (my !== run) throw new Error('stale'); root.classList.add(cls); };
    try {
      await step(250, 's1');          // the bank line lights up, the Trezzit card arrives
      await step(550, 's2');          // the $100.00 splits into four shares
      label.textContent = 'You spent';
      countMoney(amt, 10000, 3000, 800);
      await step(650, 's3');         // your share sorts into categories
      await step(450, 's4');          // who owes you
    } catch { /* a newer run took over */ }
  }

  // "Owed to you" opens to who owes what (and how it gets settled)
  const owe = root.querySelector('.tzc-owe');
  const who = root.querySelector('.tzc-who');
  owe?.addEventListener('click', () => {
    const open = owe.getAttribute('aria-expanded') !== 'true';
    owe.setAttribute('aria-expanded', String(open));
    who.hidden = !open;
  });
  replay?.addEventListener('click', play);
  play();
}
