/**
 * chat-demo.js: a scripted exchange with an AI app that has Trezzit
 * connected. It opens on a finished conversation; a prompt (or Replay) plays
 * one, which can be paused. Reduced motion shows the finished conversation.
 */

import { PEOPLE, CATEGORIES } from './data.js';
import { money, esc, ICON, avatar, reduced, watchVisible, bankAmt } from './util.js';

const C = (k) => CATEGORIES[k] || CATEGORIES.other;

function card(title, sub, rows, foot = '', note = '') {
  return `<div class="tzcard">
    <div class="tzcard-h"><span class="tzcard-mark" aria-hidden="true"></span><span><b>${title}</b><small>${sub}</small></span></div>${note ? `<p class="tzcard-note">${note}</p>` : ''}
    <ul role="list">${rows}</ul>${foot}
  </div>`;
}
const row = (left, right, extra = '') => `<li><span>${left}</span><span class="money">${right}</span>${extra}</li>`;

export function scripts(sc) {
  const byId = Object.fromEntries(sc.map((s) => [s.id, s]));
  const paid = sc.filter((s) => s.bank).reduce((a, s) => a + s.sum.total, 0);
  const spent = sc.reduce((a, s) => a + s.sum.mine, 0);
  const cats = {};
  sc.forEach((s) => Object.entries(s.sum.byCategory).forEach(([k, v]) => { cats[k] = (cats[k] || 0) + v; }));
  // Every card's rows add up to its header: "everything else" is the exact remainder.
  const g = byId.groceries.sum;
  const r = byId.rent.sum;
  // Two charges from the same statement that are not in Trezzit yet (the table above shows only what is).
  const parking = { total: 600, mine: 600 };
  const cafe = { total: 970, mine: 485 };
  // The month by the same names the statement uses: "Rent and bills" is one line there, so it is one here.
  const bills = ['rent', 'utilities', 'internet', 'parking'];
  const rentBills = bills.reduce((a, k) => a + (cats[k] || 0), 0);
  const groceries = cats.groceries || 0;
  const listed = [['Rent and bills', '#0f1f3d', rentBills, ''], ['Travel', C('travel').color, cats.travel || 0, ''],
    ['Dining out', C('dining').color, cats.dining || 0, ''], ['Groceries', C('groceries').color, groceries, 'Green Basket and the pharmacy']];
  const restKeys = Object.keys(cats).filter((k) => cats[k] > 0 && !bills.includes(k) && !['travel', 'dining', 'groceries'].includes(k)).sort((x, y) => cats[y] - cats[x]);
  const restCents = spent - listed.reduce((a, l) => a + l[2], 0);
  const line = (d, m, c) => `<span class="bk">${d} ${m} ${bankAmt(c)}</span>`;

  return {
    match: {
      chip: "What's on my statement but not in Trezzit?",
      steps: [
        { user: "Here's my October statement. Add what's not in Trezzit yet. The café was with Maya.", attach: { icon: 'doc', name: 'october-statement.pdf' } },
        { tools: ['Added 2 expenses'] },
        { html: card('Added from your statement', '2 charges that weren’t in Trezzit',
          row(`${line('OCT 23', 'CITY PARKING', parking.total)}<small>Just you</small>`, money(parking.mine))
          + row(`${line('OCT 17', 'CORNER CAFE', cafe.total)}<small>You and Maya</small>`, money(cafe.mine)),
          `<p class="tzcard-f">You spent <b class="money">${money(parking.mine + cafe.mine)}</b> of the <span class="money">${money(parking.total + cafe.total)}</span> you paid.</p>`) },
        { ai: `Saved. Maya owes you ${money(cafe.total - cafe.mine)}. Both show in your activity log.` },
      ],
    },
    spent: {
      chip: 'What did I actually spend in October?',
      steps: [
        { user: 'What did I actually spend in October?' },
        { tools: ['Added up your shares'] },
        { html: card('October, your share', `${money(spent)} of the <span class="money">${bankAmt(paid).replace('−', '$')}</span> you paid`,
          listed.map(([label, color, v, note]) => row(`<span class="dot" style="--c:${color}"></span>${esc(label)}${note ? ` <small>${esc(note)}</small>` : ''}`, money(v))).join('')
          + (restKeys.length ? row(`<span class="dot" style="--c:#94a3b8"></span>Everything else <small>${esc(restKeys.map((k) => C(k).label).join(', '))}</small>`, money(restCents)) : ''),
          `<p class="tzcard-f">Total <b class="money">${money(spent)}</b></p>`) },
        { ai: 'Rent was most of it. Dinner counts too, even though Alex paid.' },
      ],
    },
    split: {
      chip: 'Split this receipt with my roommates',
      steps: [
        { user: 'Split this with Maya, Jordan and Sam. Avocados and cold brew are mine, oat milk and kale chips are Maya\'s.', attach: { icon: 'image', name: 'green-basket.jpg' } },
        { tools: ['Read the receipt', 'Saved to Roommates'] },
        { html: card('Green Basket Market', `${byId.groceries.itemCount} items · ${money(g.total)} · Roommates`,
          ['you', 'maya', 'jordan', 'sam'].map((id) => row(`${avatar(PEOPLE[id], { size: 'sm' })}${PEOPLE[id].name}`, money(g.result.people[id].cents))).join(''),
          '', 'Avocados, cold brew &rarr; you · Oat milk, kale chips &rarr; Maya · the rest split 4 ways') },
        { ai: `Saved. You spent ${money(g.mine)}: ${money(g.byCategory.groceries)} on groceries, ${money(g.byCategory.household)} on household.` },
      ],
    },
    rent: {
      chip: 'Add our rent every month',
      steps: [
        { user: 'Add our rent every month on the 1st. $2,400: Maya and I pay 25%, Jordan 28%, Sam 22%. Utilities and internet split four ways, parking is Jordan\'s.' },
        { tools: ['Found Maya, Jordan and Sam', 'Saved a monthly expense'] },
        { html: card('Rent and bills', `Every month on the 1st · ${money(r.total)}`,
          row('Rent <small>Your 25%</small>', money(r.byCategory.rent || 0))
          + row('Utilities and internet <small>Split 4 ways · parking is Jordan\'s</small>', money((r.byCategory.utilities || 0) + (r.byCategory.internet || 0))),
          `<p class="tzcard-f"><span class="rec">${ICON.repeat}Next: Nov 1</span> · Your share <b class="money">${money(r.mine)}</b></p>`) },
        { ai: `Done. It adds itself on the 1st. Your share is ${money(r.mine)} a month.` },
      ],
    },
  };
}

export function initChatDemo(section, scenarios) {
  const S = scripts(scenarios);
  const root = section.querySelector('[data-chat]');
  const log = root.querySelector('[data-log]');
  const chips = section.querySelectorAll('[data-script]');
  const ctl = root.querySelector('[data-ctl]');
  const live = root.querySelector('[data-chat-live]');
  // Follow the newest message unless the visitor has scrolled up to read.
  let stick = true;
  log.addEventListener('scroll', () => { stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40; }, { passive: true });
  const toEnd = () => { if (stick) log.scrollTop = log.scrollHeight; };
  let run = 0;
  let paused = false;
  let wake = null;
  let playing = false;
  let current = 'match';
  let inView = true;

  const gate = async (id) => {
    while (paused || !inView) {
      await new Promise((r) => { wake = r; });
      if (id !== run) throw new Error('stale');
    }
    if (id !== run) throw new Error('stale');
  };
  const wait = async (ms, id) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      await new Promise((r) => setTimeout(r, Math.min(60, end - performance.now())));
      await gate(id);
    }
  };

  function setCtl(state) {
    ctl.dataset.state = state;
    const label = { pause: 'Pause', play: 'Play', replay: 'Replay' }[state];
    ctl.innerHTML = `${ICON[state === 'replay' ? 'replay' : state]}<span>${label}</span>`;
    ctl.setAttribute('aria-label', `${label} the conversation`);
  }

  const bubble = (step) => {
    if (step.user !== undefined) {
      const att = step.attach ? `<span class="att">${ICON[step.attach.icon]}${esc(step.attach.name)}</span>` : '';
      return `<div class="msg msg-user">${att}<p></p></div>`;
    }
    if (step.tools) return `<div class="msg msg-tool">${step.tools.map((t) => `<span class="tool"><span class="spin" aria-hidden="true"></span>${ICON.check}<span>${esc(t)}</span></span>`).join('')}</div>`;
    if (step.ai !== undefined) return '<div class="msg msg-ai"><p></p></div>';
    return `<div class="msg msg-card">${step.html}</div>`;
  };

  function renderAll(key) {
    log.innerHTML = S[key].steps.map((s) => {
      const h = bubble(s);
      return h.replace('<p></p>', `<p>${esc(s.user ?? s.ai ?? '')}</p>`).replaceAll('class="tool"', 'class="tool is-done"');
    }).join('');
  }
  /* The log is as tall as the finished conversation, so nothing hides in an inner
     scroller and nothing below moves while it plays (messages fill it from the top).
     Only on a short desktop window is it capped, and then it opens on the ending. */
  const cap = () => (innerWidth < 640 ? Infinity : Math.max(360, Math.min(600, innerHeight - 220)));
  function fit(key) {
    renderAll(key);
    log.style.height = 'auto';
    const full = log.scrollHeight;
    log.style.height = `${Math.min(full, cap())}px`;
    log.classList.toggle('is-capped', full > cap());
    if (full > cap()) log.tabIndex = 0; else log.removeAttribute('tabindex');
    log.scrollTop = log.scrollHeight;
  }

  async function play(key) {
    const id = ++run;
    current = key;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.script === key)));
    fit(key);
    if (reduced()) { setCtl('replay'); ctl.hidden = true; return; }
    paused = false; wake?.();
    playing = true; setCtl('pause');
    log.classList.add('is-playing');
    log.innerHTML = '';
    log.scrollTop = 0;
    stick = true;
    try {
      for (const step of S[key].steps) {
        await gate(id);
        const node = document.createElement('div');
        node.innerHTML = bubble(step);
        const m = node.firstElementChild;
        log.appendChild(m);
        toEnd();
        requestAnimationFrame(() => m.classList.add('in'));
        if (step.user !== undefined || step.ai !== undefined) {
          const p = m.querySelector('p');
          const text = step.user ?? step.ai;
          const words = text.split(' ');
          const per = step.user !== undefined ? 34 : 46;
          for (let w = 0; w < words.length; w += 1) {
            p.textContent = words.slice(0, w + 1).join(' ');
            toEnd();
            await wait(per, id);
          }
          await wait(step.user !== undefined ? 380 : 520, id);
        } else if (step.tools) {
          const chips = [...m.querySelectorAll('.tool')];
          chips.forEach((c) => { c.hidden = true; });
          for (const c of chips) {
            c.hidden = false;
            toEnd();
            await wait(520, id);
            c.classList.add('is-done');
            await wait(120, id);
          }
        } else {
          toEnd();
          await wait(900, id);
        }
      }
      playing = false; setCtl('replay');
      log.classList.remove('is-playing');
      const last = S[key].steps[S[key].steps.length - 1];
      if (live) live.textContent = last.ai || '';
    } catch (e) { if (e.message !== 'stale') throw e; }
  }

  chips.forEach((c) => c.addEventListener('click', () => {
    // On a phone the conversation sits below the prompts: bring it into view so the answer is seen.
    const r = root.getBoundingClientRect();
    if (r.top > innerHeight * 0.55 || r.bottom < 80) root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    play(c.dataset.script);
  }));
  ctl.addEventListener('click', () => {
    const st = ctl.dataset.state;
    if (st === 'replay') { play(current); return; }
    paused = st === 'pause';
    setCtl(paused ? 'play' : 'pause');
    if (!paused) wake?.();
  });

  // Opens finished: the first question and its answer. A prompt (or Replay) plays a conversation.
  fit('match');
  setCtl('replay');
  if (reduced()) ctl.hidden = true;
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW && !playing) { lastW = innerWidth; fit(current); } }, { passive: true });
  watchVisible(root, (v) => { inView = v; if (v) wake?.(); }, { threshold: 0 });
}
