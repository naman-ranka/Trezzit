/* chat.js: a scripted assistant exchange. Neutral chat styling (not a copy of any AI app),
 * Trezzit's own cards for tool results. Two prompts: the write (this page's receipt, split from a sentence, shown as a
 * preview and saved only after "Save it") and the read (what you spent, your share only), plus a Replay.
 * The log has one fixed height (the taller finished exchange, measured at this width), and messages start at its top,
 * so switching prompts never moves the page and nothing sits above the request. The panel opens on the write, finished;
 * a chip or Replay plays one (Replay rests while it plays). A one-line result is announced when a run ends. */
import { $, $$, esc, money, ICON, reduced, avatar } from './util.js';
import { loadModel, compute, PEOPLE } from './data.js';

const TZ = '<svg viewBox="0 0 120 120" aria-hidden="true" fill="currentColor"><polygon points="10.56,85.55 109.44,24.22 109.44,35.03 10.56,96.58" fill-opacity=".64"/><path d="M10 8.8h100v10.26H10zM45.42 8.8h9.07v81.23h-9.07zM64.69 30.01h9.08v81.17h-9.08zM10 100.92h100v10.26H10z"/></svg>';

async function scripts() {
  const gb = compute(await loadModel('green-basket'));
  // a person's total, and (for the two named in the request) the items that made it, so the preview can be checked
  const row = (p, items) => `<div class="r">${avatar(PEOPLE[p])}<span>${esc(PEOPLE[p].name)}${items ? `<small class="why">${esc(items)} + ¼ shared</small>` : ''}</span><span class="money">${money(gb.people[p].cents)}</span></div>`;
  const owes = (p, cents) => `<div class="r">${avatar(PEOPLE[p])}<span>${esc(PEOPLE[p].name)} <small>owes you</small></span><span class="money pos">${money(cents)}</span></div>`;
  return {
    // the write first: the page's own receipt, handed to the AI; a preview, then saved only after a yes
    split: {
      chip: 'Split this receipt',
      say: 'Saved to Roommates.',
      steps: [
        { t: 'user', att: true, text: 'Split this with my roommates. Avocados and cold brew are mine, oat milk and kale chips are Maya’s.' },
        { t: 'tool', label: 'Reading the receipt', done: '14 items read' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Green Basket Market · Oct 24</strong><span class="money">${money(gb.totalCents)}</span></div>
          <span class="tag">Preview · not saved yet</span>
          <div class="rows rows-p">${row('you', 'Avocados, cold brew')}${row('maya', 'Oat milk, kale chips')}${row('jordan')}${row('sam')}</div></div>` },
        { t: 'user', text: 'Save it' },
        { t: 'tool', label: 'Saving', done: 'Saved to Roommates', ok: true },
      ],
    },
    // the read: the shared-aware ledger, across every bill, that only an AI connected to it can answer
    ask: {
      chip: 'What did I spend?',
      say: 'Groceries, October: $49.00. Maya owes you $112.40, Jordan $64.10, Sam $58.75.',
      steps: [
        { t: 'user', text: 'What did I actually spend on groceries?' },
        { t: 'tool', label: 'Adding up your shares', done: 'Groceries, October' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Groceries · October</strong></div>
          <p class="big money">$49.00</p>
          <div class="rows">
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Basket Market</span><span class="money">$22.00 <small>of $100.00</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Green Grocer</span><span class="money">$17.80 <small>yours</small></span></div>
            <div class="r"><span class="dot" style="--c:var(--cat-groceries)"></span><span>Farmers market</span><span class="money">$9.20 <small>of $32.25</small></span></div>
          </div></div>` },
        // balances carry across every bill, so "who owes me" is one more question, not a spreadsheet
        { t: 'user', text: 'And who owes me?' },
        { t: 'card', html: `<div class="tz-card"><div class="hd"><strong>Roommates · all bills</strong></div>
          <div class="rows rows-p">${owes('maya', 11240)}${owes('jordan', 6410)}${owes('sam', 5875)}</div></div>` },
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
  // one control, one size: Replay, resting while an exchange plays (every run is under six seconds)
  const setBtn = (playing) => { rp.setAttribute('aria-disabled', String(playing)); };
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
  // a longer exchange scrolls inside the log, kept at its newest message, like a real chat
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  // the photo rides inside the request, as a thumbnail, so the question and its receipt are one bubble
  const userNode = (st) => el(st.att
    ? `<div class="msg msg-u has-att"><img src="./assets/receipt-thumb.webp" alt="Photo of the Green Basket receipt" width="40" height="52"><span>${esc(st.text)}</span></div>`
    : `<div class="msg msg-u">${esc(st.text)}</div>`);

  // keep: the first message is already on screen (the primed panel), so the run continues from it without a flash
  // each finished exchange's height, measured by fit(): the log takes it before a run starts, so the final frame shows
  // the whole exchange (the request included) with no empty band above a short answer
  const H = {};
  const size = () => { const h = Math.max(0, ...Object.values(H)); if (h) log.style.height = `${h}px`; };
  async function play(key, { instant = false, keep = false } = {}) {
    token += 1;
    const tk = token;
    active = key;
    size(key);
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
          const node = el(`<div class="tool${st.ok ? ' tool-ok' : ''}"><span class="tz">${TZ}</span><span class="tl">Trezzit · ${esc(st.label)}</span><span class="s"></span></div>`);
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
    if (!instant) live.textContent = S[key].say;
  }

  // bring the panel into view first, so a tap near the fold never plays off screen
  const start = (k) => {
    setPaused(false);
    const r = chat.getBoundingClientRect();
    const bottom = r.bottom;
    if (r.top < 0 || bottom > innerHeight) {
      const dy = r.top < 0 ? r.top - 16 : Math.min(r.top - 72, bottom - innerHeight + 16);
      scrollBy({ top: dy, behavior: reduced() ? 'auto' : 'smooth' });
    }
    play(k);
  };
  $$('.chat-chips button', root).forEach((b) => b.addEventListener('click', () => start(b.dataset.k)));
  rp.addEventListener('click', () => { if (!running) start(active || keys[0]); });

  // The log takes each exchange's finished height (measured here at this width), so every final frame shows the whole
  // exchange, request included, and a short answer never sits under an empty band. Switching eases the height.
  async function fit() {
    const keep = active || keys[0];
    log.classList.add('is-measuring');
    for (const k of keys) { delete H[k]; }
    log.style.height = '';
    for (const k of keys) { await play(k, { instant: true }); H[k] = log.scrollHeight; }
    log.classList.remove('is-measuring');
    await play(keep, { instant: true });
    scrollDown();
  }
  // Never an empty or half-played panel: it opens on the first exchange, finished, at every width (nothing plays on
  // its own, so a fast scroll never passes a spinner in a tall empty box). A chip or Replay plays one, animated.
  await fit();
  let w = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== w && !running) { w = innerWidth; fit(); } }, { passive: true });
  if ('IntersectionObserver' in window) {
    // a running exchange waits while it is off screen
    new IntersectionObserver((es) => es.forEach((e) => { if (running) setPaused(!e.isIntersecting); }), { threshold: 0.1 }).observe(chat);
  }
}
