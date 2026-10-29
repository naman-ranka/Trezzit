/* chat.js: a scripted assistant exchange. Neutral chat styling (not a copy of any AI app),
 * Trezzit's own cards for tool results. Two prompts (a read, a write) and a Replay. The log is as tall
 * as the longest finished exchange, so nothing scrolls inside it or gets cut off. The first exchange
 * plays once, animated, the first time the panel is in view (finished state is the fallback). */
import { $, $$, esc, money, ICON, reduced, onceVisible } from './util.js';
import { loadModel, compute } from './data.js';

const TZ = '<svg viewBox="0 0 120 120" aria-hidden="true" fill="currentColor"><polygon points="10.56,85.55 109.44,24.22 109.44,35.03 10.56,96.58" fill-opacity=".64"/><path d="M10 8.8h100v10.26H10zM45.42 8.8h9.07v81.23h-9.07zM64.69 30.01h9.08v81.17h-9.08zM10 100.92h100v10.26H10z"/></svg>';

async function scripts() {
  const gb = compute(await loadModel('green-basket'));
  const rm = await loadModel('monthly-rent');
  const rr = compute(rm);
  // the month's running balance: this receipt plus the month's other sample bills (same numbers as the split story)
  const owe = { maya: 8240 + gb.people.maya.cents, jordan: 4410 + gb.people.jordan.cents, sam: 3875 + gb.people.sam.cents };
  const S = {
    ask: {
      chip: 'What did I spend?',
      steps: [
        { t: 'user', text: 'What did I actually spend on groceries this month?' },
        { t: 'tool', label: 'Adding up your shares', done: 'Your shares, October' },
        { t: 'ai', text: '$49.00 on groceries in October, counting only your share of shared bills.' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Groceries · October</strong><span>your share</span></div>
          <p class="big money">$49.00</p>
          <div class="rows">
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Basket Market</span><span class="money">$22.00 <small>of $100.00</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Grocer</span><span class="money">$17.80 <small>yours</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Farmers market</span><span class="money">$9.20 <small>of $32.25</small></span></div>
          </div></div>` },
        { t: 'user', text: 'And who owes me?' },
        { t: 'tool', label: 'Checking balances', done: 'Balances · Flatmates' },
        { t: 'ai', text: `Maya owes you ${money(owe.maya)}, Jordan ${money(owe.jordan)}, Sam ${money(owe.sam)}.` },
      ],
    },
    rent: {
      chip: 'Add rent monthly',
      steps: [
        { t: 'user', text: 'Add our rent on the 1st of every month. Rent by our usual split, bills equally, parking is Jordan’s.' },
        { t: 'tool', label: 'Setting up a repeating expense', done: 'Preview ready' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Monthly rent · on the 1st</strong><span class="money">${money(rr.totalCents)}</span></div>
          <span class="tag">Preview · not saved yet</span>
          <div class="rows">${['rent', 'utilities', 'parking'].map((cat) => {
            const ix = rm.lines.map((l, i) => (l.category === cat || (cat === 'utilities' && l.category === 'internet') ? i : -1)).filter((i) => i >= 0);
            const sum = ix.reduce((a, i) => a + rr.items[i].totalCents, 0);
            const how = cat === 'rent' ? 'your usual split' : cat === 'parking' ? 'Just Jordan' : '4 ways';
            const name = cat === 'rent' ? 'Rent' : cat === 'parking' ? 'Parking' : 'Bills';
            return `<div class="r"><span class="dot" style="--c:var(--cat-${cat})"></span><span>${name} <small>${esc(how)}</small></span><span class="money">${money(sum)}</span></div>`;
          }).join('')}</div>
          <div class="hd" style="margin-top:12px"><strong>Your share</strong><strong class="money">${money(rr.people.you.cents)}</strong></div></div>` },
        { t: 'ai', text: 'Start it on November 1?' },
        { t: 'user', text: 'Yes' },
        { t: 'tool', label: 'Saving the schedule', done: 'Repeats monthly from Nov 1' },
        { t: 'ai', text: 'Done. It adds itself on the 1st, and it shows in everyone’s activity.' },
      ],
    },
  };
  // "What did I spend?" first: the ledger read, and the panel opens on it.
  return { ask: S.ask, rent: S.rent };
}

export async function initChat() {
  const root = $('#chat-root');
  if (!root) return;
  const S = await scripts();
  const keys = Object.keys(S);
  root.innerHTML = `
    <div class="chat-chips" role="group" aria-label="Try a request">${keys.map((k) => `<button type="button" data-k="${k}" aria-pressed="false">${esc(S[k].chip)}</button>`).join('')}</div>
    <div class="chat" role="region" aria-label="Example conversation with an AI assistant connected to Trezzit">
      <div class="chat-top"><span class="ttl"><span class="ttl-l">Your AI assistant</span><span class="ttl-s">Your AI</span></span><span class="conn">Trezzit connected</span>
        <span class="ctl"><button type="button" class="rp" aria-label="Replay">${ICON.replay}</button></span></div>
      <div class="chat-log" aria-live="off"></div>
    </div>`;
  const log = $('.chat-log', root);
  let token = 0;
  let paused = false;
  let running = false;
  let active = null;
  const setPaused = (v) => { paused = v; };
  const wait = async (ms, tk) => {
    let left = ms;
    while (left > 0) {
      if (tk !== token) throw new Error('stop');
      await new Promise((r) => setTimeout(r, 50));
      if (!paused) left -= 50;
    }
    if (tk !== token) throw new Error('stop');
  };
  const scrollDown = () => {};

  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  async function play(key, { instant = false } = {}) {
    token += 1;
    const tk = token;
    active = key;
    $$('.chat-chips button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === key)));
    log.innerHTML = '';
    running = true;
    const fast = instant || reduced();
    try {
      for (const st of S[key].steps) {
        if (st.t === 'user') {
          if (!fast && log.childElementCount) await wait(250, tk);
          log.appendChild(el(`<div class="msg msg-u">${st.att ? `<div class="att"><img src="./assets/receipt-thumb.webp" alt="" width="40" height="52">green-basket.jpg</div>` : ''}${esc(st.text)}</div>`));
          scrollDown();
          if (!fast) await wait(500, tk);
        } else if (st.t === 'tool') {
          const node = el(`<div class="tool"><span class="tz">${TZ}</span><span class="tl">Trezzit · ${esc(st.label)}</span><span class="s"></span></div>`);
          log.appendChild(node); scrollDown();
          if (!fast) await wait(900, tk);
          node.classList.add('done');
          $('.tl', node).textContent = `Trezzit · ${st.done}`;
          if (!fast) await wait(300, tk);
        } else if (st.t === 'ai') {
          const node = el('<div class="msg msg-a"><p></p></div>');
          log.appendChild(node);
          const p = $('p', node);
          if (fast) p.textContent = st.text;
          else {
            const words = st.text.split(' ');
            p.classList.add('typing');
            for (let i = 1; i <= words.length; i += 1) { p.textContent = words.slice(0, i).join(' '); scrollDown(); await wait(38, tk); }
            p.classList.remove('typing');
            await wait(350, tk);
          }
          scrollDown();
        } else if (st.t === 'card') {
          log.appendChild(el(st.html)); scrollDown();
          if (!fast) await wait(1100, tk);
        }
      }
    } catch { return; }
    running = false;
    log.setAttribute('aria-live', 'off');
  }

  let touched = false;
  $$('.chat-chips button', root).forEach((b) => b.addEventListener('click', () => { touched = true; setPaused(false); play(b.dataset.k); }));
  $('.rp', root).addEventListener('click', () => { touched = true; setPaused(false); play(active || keys[0]); });

  // Reserve the height of the longest finished exchange, so playing one never moves the page.
  async function fit() {
    const keep = active;
    log.style.minHeight = '';
    let max = 0;
    for (const k of keys) { await play(k, { instant: true }); max = Math.max(max, log.scrollHeight); }
    log.style.minHeight = `${max}px`;
    if (keep) await play(keep, { instant: true });
  }
  await fit();
  // Never an empty panel: the first exchange is there, finished. Tap a question to watch one play.
  await play(keys[0], { instant: true });
  // play it once, animated, when the panel is first 40% in view (the log is already at its final height)
  if (!reduced()) onceVisible($('.chat', root), () => { if (!touched) play(keys[0]); }, { threshold: 0.4 });
  let w = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== w && !running) { w = innerWidth; fit(); } }, { passive: true });
  if ('IntersectionObserver' in window) {
    // a running exchange waits while it is off screen
    new IntersectionObserver((es) => es.forEach((e) => { if (running) setPaused(!e.isIntersecting); }), { threshold: 0.1 }).observe(root);
  }
}
