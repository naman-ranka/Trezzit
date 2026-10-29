/**
 * chat-demo.js: a scripted exchange with an AI app that has Trezzit
 * connected. Tool names are the real Trezzit MCP tools. Plays once when it
 * scrolls into view, can be paused, replays on demand; reduced motion shows
 * the finished conversation.
 */

import { PEOPLE, CATEGORIES } from './data.js';
import { money, esc, ICON, avatar, reduced, whenVisible, watchVisible, bankAmt } from './util.js';

const C = (k) => CATEGORIES[k] || CATEGORIES.other;

function card(title, sub, rows, foot = '') {
  return `<div class="tzcard">
    <div class="tzcard-h"><span class="tzcard-mark" aria-hidden="true"></span><span><b>${title}</b><small>${sub}</small></span></div>
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
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const g = byId.groceries.sum;
  const r = byId.rent.sum;
  const ph = byId.pharmacy.sum;
  const tr = byId.trip.sum;

  return {
    match: {
      chip: 'Check my statement',
      steps: [
        { user: "Here's my October bank statement. What isn't in Trezzit yet?", attach: { icon: 'doc', name: 'october-statement.pdf' } },
        { tools: ['Checked your payments', 'Searched your expenses'] },
        { ai: `Your statement has 5 charges. 3 are already in Trezzit. These 2 aren't:` },
        { html: `<div class="stmt-mini">
            <div><span>OCT 20</span><span>CORNER PHARMACY</span><span>${bankAmt(ph.total)}</span></div>
            <div><span>OCT 11</span><span>PINES CABIN RENTALS</span><span>${bankAmt(tr.total)}</span></div></div>` },
        { ai: 'Send me the pharmacy receipt and tell me who shared the cabin.' },
        { user: 'Pharmacy is all mine. The cabin was the four of us.', attach: { icon: 'image', name: 'pharmacy-receipt.jpg' } },
        { tools: ['Read the receipt', 'Drafted 2 expenses'] },
        { html: card('Ready to save', '2 expenses · nothing saved yet',
          row(`Corner Pharmacy <small>Just you · 6 items</small>`, money(ph.mine))
          + row(`Pines Cabin Rentals <small>4 people · you paid ${money(tr.total)}</small>`, money(tr.mine)),
          `<p class="tzcard-f">You spent <b class="money">${money(ph.mine + tr.mine)}</b> of the <span class="money">${money(ph.total + tr.total)}</span> you paid.</p>`) },
        { user: 'Save both.' },
        { tools: ['Saved 2 expenses'] },
        { ai: 'Saved. Both show in your activity log as added by your AI. Maya, Jordan and Sam each owe you $135.00.' },
      ],
    },
    spent: {
      chip: 'What did I actually spend in October?',
      steps: [
        { user: 'What did I actually spend in October?' },
        { tools: ['Listed your October expenses', 'Added up your shares'] },
        { ai: `Your bank says ${money(paid)} went out. Your share of everything was ${money(spent)}.` },
        { html: card('October, your share', `${money(spent)} across ${sc.length} expenses`,
          top.slice(0, 5).map(([k, v]) => row(`<span class="dot" style="--c:${C(k).color}"></span>${esc(C(k).label)}`, money(v))).join('')) },
        { ai: `Rent was most of it. Dinner at Taqueria Sol counts too, even though Alex paid.` },
      ],
    },
    split: {
      chip: 'Split this receipt with my roommates',
      steps: [
        { user: 'Split this with Maya, Jordan and Sam. The avocados and cold brew are mine, oat milk and kale chips are Maya\'s.', attach: { icon: 'image', name: 'green-basket.jpg' } },
        { tools: ['Read the receipt', 'Found Maya, Jordan and Sam', 'Drafted the split'] },
        { html: card('Green Basket Market', `14 items · ${money(g.total)} · Flatmates`,
          ['you', 'maya', 'jordan', 'sam'].map((id) => row(`${avatar(PEOPLE[id], { size: 'sm' })}${id === 'you' ? 'You' : PEOPLE[id].name}`, money(g.result.people[id].cents))).join('')) },
        { ai: 'Save it to Flatmates?' },
        { user: 'Yes.' },
        { tools: ['Saved to Flatmates'] },
        { ai: `Saved. You spent ${money(g.mine)}: ${money(g.byCategory.groceries)} on groceries and ${money(g.byCategory.household)} on household.` },
      ],
    },
    rent: {
      chip: 'Add our rent every month',
      steps: [
        { user: 'Add our rent every month on the 1st. Rent is $2,400: Maya and I pay 25% each, Jordan 28%, Sam 22%. Utilities and internet split four ways, parking is Jordan\'s.' },
        { tools: ['Found Maya, Jordan and Sam', 'Drafted a monthly expense'] },
        { html: card('Rent and bills', `Every month on the 1st · ${money(r.total)}`,
          row('Rent <small>Your 25%</small>', money(r.byCategory.rent || 0))
          + row('Utilities and internet <small>Split 4 ways · parking is Jordan\'s</small>', money((r.byCategory.utilities || 0) + (r.byCategory.internet || 0))),
          `<p class="tzcard-f"><span class="rec">${ICON.repeat}Next: Nov 1</span> Your share <b class="money">${money(r.mine)}</b></p>`) },
        { ai: 'Save it? It adds itself on the 1st.' },
        { user: 'Yes.' },
        { tools: ['Saved the monthly expense'] },
        { ai: `Done. Your share is ${money(r.mine)} a month.` },
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

  async function play(key) {
    const id = ++run;
    current = key;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.script === key)));
    if (reduced()) { renderAll(key); log.scrollTop = 0; setCtl('replay'); ctl.hidden = true; return; }
    paused = false; wake?.();
    playing = true; setCtl('pause');
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

  renderAll('match');
  setCtl('replay');
  let started = false;
  chips.forEach((c) => c.addEventListener('click', () => { started = true; }));
  whenVisible(root, () => { if (!started) { started = true; play('match'); } }, { threshold: 0.4 });
  watchVisible(root, (v) => { inView = v; if (v) wake?.(); }, { threshold: 0 });
}
