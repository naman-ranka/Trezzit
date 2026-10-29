/* chat.js: a scripted assistant exchange. Neutral chat styling (not a copy of any AI app),
 * Trezzit's own cards for tool results. Two prompts (a read, a write) and a Replay. The log is as tall
 * as the longest finished exchange, so nothing scrolls inside it or gets cut off. The panel opens on the
 * first exchange already finished (never an empty box, nothing moves on its own); a chip or Replay plays one,
 * and while it plays Replay becomes Skip. The last answer is announced politely when a run ends. */
import { $, $$, esc, money, ICON, reduced, avatar } from './util.js';
import { loadModel, compute, PEOPLE } from './data.js';

const TZ = '<svg viewBox="0 0 120 120" aria-hidden="true" fill="currentColor"><polygon points="10.56,85.55 109.44,24.22 109.44,35.03 10.56,96.58" fill-opacity=".64"/><path d="M10 8.8h100v10.26H10zM45.42 8.8h9.07v81.23h-9.07zM64.69 30.01h9.08v81.17h-9.08zM10 100.92h100v10.26H10z"/></svg>';

async function scripts() {
  const gb = compute(await loadModel('green-basket'));
  const row = (p) => `<div class="r">${avatar(PEOPLE[p])}<span>${esc(PEOPLE[p].name)}</span><span class="money">${money(gb.people[p].cents)}</span></div>`;
  return {
    // the write first: the page's own receipt, handed to the AI; a preview, a yes, then saved
    split: {
      chip: 'Split this receipt',
      steps: [
        { t: 'user', att: true, text: 'Split this with my roommates. Avocados and cold brew are mine, oat milk and kale chips are Maya’s.' },
        { t: 'tool', label: 'Reading the receipt', done: 'Preview ready' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Green Basket Market · Oct 24</strong><span class="money">${money(gb.totalCents)}</span></div>
          <span class="tag">Preview · not saved yet</span>
          <div class="rows rows-p">${['you', 'maya', 'jordan', 'sam'].map(row).join('')}</div></div>` },
        { t: 'ai', text: 'Save it to Roommates?' },
        { t: 'user', text: 'Yes' },
        { t: 'tool', label: 'Saving', done: 'Saved to Roommates' },
        { t: 'ai', text: 'Saved. It shows in everyone’s activity.' },
      ],
    },
    // the read
    ask: {
      chip: 'What did I spend?',
      steps: [
        { t: 'user', text: 'What did I actually spend on groceries this month?' },
        { t: 'tool', label: 'Adding up your shares', done: 'Your shares, October' },
        { t: 'ai', text: 'Your share: $49.00.' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Groceries · October</strong><span>your share</span></div>
          <p class="big money">$49.00</p>
          <div class="rows">
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Basket Market</span><span class="money">$22.00 <small>of $100.00</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Grocer</span><span class="money">$17.80 <small>yours</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Farmers market</span><span class="money">$9.20 <small>of $32.25</small></span></div>
          </div></div>` },
      ],
    },
  };
}

export async function initChat() {
  const root = $('#chat-root');
  if (!root) return;
  const S = await scripts();
  const keys = Object.keys(S);
  root.innerHTML = `
    <div class="chat-chips" role="group" aria-label="Try a request">${keys.map((k) => `<button type="button" data-k="${k}" aria-pressed="false">${esc(S[k].chip)}</button>`).join('')}</div>
    <div class="chat" role="region" aria-label="Example conversation with an AI assistant connected to Trezzit">
      <div class="chat-top"><span class="ttl">Your AI</span><span class="conn">Trezzit connected</span>
        <span class="ctl"><button type="button" class="rp" aria-label="Replay">${ICON.replay}</button></span></div>
      <div class="chat-log" aria-live="off"></div>
    </div>
    <p class="visually-hidden" aria-live="polite" data-live></p>`;
  const log = $('.chat-log', root);
  const chat = $('.chat', root);
  const rp = $('.rp', root);
  const live = $('[data-live]', root);
  // Replay while idle; Skip (show the full answer) while an exchange is playing
  const setBtn = (playing) => {
    rp.classList.toggle('is-skip', playing);
    rp.innerHTML = playing ? 'Skip' : ICON.replay;
    rp.setAttribute('aria-label', playing ? 'Show full answer' : 'Replay');
  };
  let token = 0;
  let paused = false;
  let running = false;
  let active = null;
  const setPaused = (v) => { paused = v; root.classList.toggle('is-paused', v); };
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

  const userNode = (st) => el(`<div class="msg msg-u">${st.att ? `<div class="att"><img src="./assets/receipt-thumb.webp" alt="" width="40" height="52">green-basket.jpg</div>` : ''}${esc(st.text)}</div>`);

  // keep: the first message is already on screen (the primed panel), so the run continues from it without a flash
  async function play(key, { instant = false, keep = false } = {}) {
    token += 1;
    const tk = token;
    active = key;
    $$('.chat-chips button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === key)));
    const kept = keep && log.childElementCount === 1;
    if (!kept) log.innerHTML = '';
    running = true;
    const fast = instant || reduced();
    if (!instant) setBtn(!fast);
    try {
      for (const st of S[key].steps.slice(kept ? 1 : 0)) {
        if (st.t === 'user') {
          if (!fast && log.childElementCount) await wait(kept ? 500 : 250, tk);
          log.appendChild(userNode(st));
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
    setPaused(false);
    setBtn(false);
    if (!instant) {
      const last = [...S[key].steps].reverse().find((x) => x.t === 'ai');
      live.textContent = last ? last.text : '';
    }
  }

  // bring the panel into view first, so a tap near the fold never plays off screen
  const start = (k) => {
    setPaused(false);
    const r = chat.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) chat.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    play(k);
  };
  $$('.chat-chips button', root).forEach((b) => b.addEventListener('click', () => start(b.dataset.k)));
  rp.addEventListener('click', () => {
    if (running) {
      const k = active || keys[0];
      play(k, { instant: true }).then(() => { live.textContent = [...S[k].steps].reverse().find((x) => x.t === 'ai')?.text || ''; });
      return;
    }
    start(active || keys[0]);
  });

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
  // Never an empty panel. With motion allowed, it holds the first question (the receipt photo) and plays the
  // answer once, the first time the panel is 40% in view; Skip shows the full answer. Otherwise it opens finished.
  const auto = !reduced() && 'IntersectionObserver' in window;
  if (auto) {
    log.innerHTML = '';
    log.appendChild(userNode(S[keys[0]].steps[0]));
    active = keys[0];
    $$('.chat-chips button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === keys[0])));
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (!running && log.childElementCount === 1) play(keys[0], { keep: true });
    }, { threshold: 0.4 });
    io.observe(chat);
  } else await play(keys[0], { instant: true });
  let w = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== w && !running) { w = innerWidth; fit(); } }, { passive: true });
  if ('IntersectionObserver' in window) {
    // a running exchange waits while it is off screen
    new IntersectionObserver((es) => es.forEach((e) => { if (running) setPaused(!e.isIntersecting); }), { threshold: 0.1 }).observe(chat);
  }
}
