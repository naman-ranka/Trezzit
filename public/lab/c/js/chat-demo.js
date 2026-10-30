/* chat-demo.js: scripted, realistic exchanges with an AI assistant that has
 * Trezzit connected. Neutral chat styling (not a copy of any AI app's UI).
 *
 * Round 5 rebuild: the panel is sized to fit its tallest conversation, so it
 * never scrolls. The question is always at the top, nothing is clipped or
 * folded, and the end state shows the whole exchange. The panel opens on the
 * finished first exchange (never an empty box); a prompt tap plays one, and
 * after 6s in view the next one plays once by itself. Every figure comes from
 * the same data as the demos. */
import { PEOPLE, CATEGORIES, LAST_MONTH, getSample, sampleBill, octoberLedger } from './data.js';
import { splitSample } from '../../_kit/receipts.js';
import { esc, money, icon, sleep, reduced, h, YOU_GLYPH } from './util.js';

const av = (p, sz = 'sm') => `<span class="av av-${sz}" style="--av:${PEOPLE[p].color}" aria-hidden="true">${p === 'you' ? YOU_GLYPH : PEOPLE[p].name[0]}</span>`;
const thumb = (id) => new URL(`../assets/thumb-${id}.webp`, import.meta.url).href;

async function buildScripts() {
  const gb = getSample('green-basket');
  const { bill } = await sampleBill('green-basket');
  const r = splitSample(gb, bill);
  const L = await octoberLedger();
  const groc = L.byCat.groceries;
  const grocLines = L.entries.map((e) => { const ls = e.lines.filter((l) => l.cat === 'groceries'); return { e, n: ls.length, c: ls.reduce((a, l) => a + l.cents, 0) }; }).filter((x) => x.c > 0);
  const grocDelta = LAST_MONTH.groceries - groc;
  const owed = gb.people.filter((p) => p !== 'you').reduce((a, p) => a + r.people[p].cents, 0);

  const splitCard = (saved) => `<div class="tc">
    <div class="tc-h"><span class="tc-k">${saved ? `${icon.check} Saved` : 'Draft, not saved yet'}</span><span>Apartment 3B</span></div>
    <p class="tc-t">Green Basket Market <b class="money">${money(r.totalCents)}</b></p>
    <ul class="tc-people tc-grid" role="list">${gb.people.map((p) => `<li>${av(p)}<span class="tc-pn">${PEOPLE[p].name}</span><b class="money">${money(r.people[p].cents)}</b></li>`).join('')}</ul>
  </div>`;

  // 6 charges: 4 matched, 2 missing. Phones show 2 matched + the 2 missing and a "+2 more" line.
  // (narrow phones: 1 matched + the 2 missing and "+3 more")
  const charges = [['GREEN BASKET MARKET', '100.00', 1], ['CORNER PHARMACY', '48.22', 1, 0, 1], ['TAQUERIA SOL', '84.87', 1, 1], ['NETFLIX.COM', '24.99', 1, 1], ['HARBOR HARDWARE', '37.15', 0], ['CITY PARKING', '12.00', 0]];

  return {
    statement: {
      chip: 'Check my statement', short: 'Statement',
      steps: [
        { t: 'user', attach: { label: 'october-statement.pdf', doc: true }, text: 'Here’s my October card statement. What’s missing from Trezzit?', narrow: { text: 'What’s missing from Trezzit?' } },
        { t: 'tool', name: 'Read your payments', narrow: { name: 'Match your payments' } },
        { t: 'tool', name: 'Match charges to bills', wide: true },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k">Statement vs Trezzit</span><span>6 charges</span></div>
          <ul class="tc-rows tight mono" role="list">
            ${charges.map(([n, a, ok, extra, xs]) => `<li class="${ok ? '' : 'miss'}${extra ? ' extra' : ''}${xs ? ' extra-xs' : ''}"><span>${n}${ok ? '' : '<em class="no">Not in Trezzit</em>'}</span><span class="r">−$${a} <em class="${ok ? 'ok' : 'nx'}">${ok ? icon.check : ''}</em></span></li>`).join('')}
            <li class="more-ok"><span>+2 more matched</span></li>
            <li class="more-ok-xs"><span>+3 more matched</span></li>
          </ul></div>` },
        { t: 'ai', text: 'Two charges aren’t in Trezzit yet. Got the hardware receipt?' },
      ],
    },
    split: {
      chip: 'Split a receipt', short: 'Split receipt',
      steps: [
        // one prompt at every width: the draft's figures need all four of these assignments
        { t: 'user', attach: { id: 'green-basket', label: 'receipt.jpg' }, text: 'Split with my roommates. Oat milk and kale chips are Maya’s; avocados and cold brew are mine.' },
        { t: 'tool', name: 'Read and draft the bill' },
        { t: 'card', html: splitCard(false) },
        { t: 'ai', text: 'Save it to Apartment 3B?', wide: true },
        { t: 'user', text: 'Save it.', wait: 900 },
        { t: 'tool', name: 'Save the bill', wide: true },
        // the draft stays a draft in the log and the save is its own turn, at every width:
        // phones keep your "Save it." (nothing is saved without your yes) and drop only the tool row
        { t: 'ai', html: `Saved. Maya, Jordan and Sam owe you <b class="money">${money(owed)}</b>.` },
        // the proof behind "you see everything it adds": the row the app's activity feed shows
        { t: 'act', html: '<b>Activity</b> <span aria-hidden="true">·</span> Added by your AI <span aria-hidden="true">·</span> just now' },
      ],
    },
    groceries: {
      chip: 'Grocery spending', short: 'Groceries',
      steps: [
        { t: 'user', text: 'What did I actually spend on groceries in October?' },
        { t: 'tool', name: 'Read your expenses', wide: true },
        { t: 'tool', name: 'Add up your share' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k"><i class="dot" style="--c:${CATEGORIES.groceries.color}"></i>Groceries · October</span><span>Your share only</span></div>
          <p class="tc-t big money">${money(groc)}</p>
          <ul class="tc-rows" role="list">${grocLines.map(({ e, c, n }) => `<li><span><b>${esc(e.title)}</b><small>${e.date} · ${e.kind === 'personal' ? 'just you' : esc(e.group)}</small></span><span class="r"><b class="money">${money(c)}</b>${e.kind === 'personal' ? `<small>${n} grocery item${n === 1 ? '' : 's'}</small>` : e.totalCents !== c ? `<small class="money">of ${money(e.totalCents)}</small>` : ''}</span></li>`).join('')}</ul>
        </div>` },
        { t: 'ai', html: `<b class="money">${money(groc)}</b>, your share only. That’s ${money(grocDelta)} less than September.` },
      ],
    },
    owe: {
      chip: 'Who owes me?',
      steps: [
        { t: 'user', text: 'Who owes me money right now?' },
        { t: 'tool', name: 'Check balances' },
        { t: 'card', html: `<div class="tc">
          <div class="tc-h"><span class="tc-k">Balances</span><span>All groups</span></div>
          <ul class="tc-people" role="list">
            <li>${av('alex')}<span>Alex owes you</span><b class="money pos">$29.88</b></li>
            <li>${av('priya')}<span>Priya owes you</span><b class="money pos">$27.96</b></li>
            <li>${av('sam')}<span>Sam owes you</span><b class="money pos">$26.24</b></li>
            <li>${av('jordan')}<span>Jordan owes you</span><b class="money pos">$16.75</b></li>
            <li>${av('maya')}<span>You owe Maya</span><b class="money neg">$603.10</b></li>
          </ul></div>` },
        { t: 'ai', html: 'Four people owe you <b class="money">$100.83</b>; you owe Maya <b class="money">$603.10</b>.' },
      ],
    },
  };
}

export async function mountChat(root, opts = {}) {
  const S = await buildScripts();
  // the write half first: the finished split (draft, your yes, Saved, the Activity row) is what the panel opens on
  const keys = opts.scripts || ['split', 'statement', 'groceries'];
  // phones: the panel must fit one screen under the nav, so long exchanges drop their optional turns
  const narrowMQ = matchMedia('(max-width: 479px)');
  const stepsOf = (k) => S[k].steps.filter((st) => !(st.wide && narrowMQ.matches) && !(st.narrowOnly && !narrowMQ.matches)).map((st) => (narrowMQ.matches && st.narrow ? { ...st, ...st.narrow } : st));
  root.classList.add('chat');
  root.innerHTML = `
    <div class="chat-win">
      <div class="chat-bar">
        <span class="chat-id"><span class="chat-glyph" aria-hidden="true">${icon.sparkle}</span><span class="chat-name"><b>Your AI</b> <span>with Trezzit</span></span></span>
        <button type="button" class="chat-ctl" aria-label="Replay">${icon.replay}</button>
      </div>
      <ol class="chat-log" aria-live="off" aria-label="Conversation"></ol>
      <div class="chat-try">
        <div class="chat-prompts" role="group" aria-label="Try a question">
          ${keys.map((k, i) => `<button type="button" class="prompt" data-k="${k}" aria-pressed="${i === 0}"><span class="pl">${esc(S[k].chip)}</span>${S[k].short ? `<span class="ps">${esc(S[k].short)}</span>` : ''}</button>`).join('')}
        </div>
      </div>
    </div>`;
  const win = root.querySelector('.chat-win');
  const log = root.querySelector('.chat-log');
  const ctl = root.querySelector('.chat-ctl');
  let run = 0;
  let paused = false;
  let gate = null;
  let state = 'done'; // playing | paused | done
  let current = keys[0];
  let touched = false;

  const setCtl = () => {
    const mode = state === 'done' ? 'replay' : paused ? 'play' : 'pause';
    ctl.innerHTML = icon[mode];
    ctl.setAttribute('aria-label', mode === 'replay' ? 'Replay' : mode === 'play' ? 'Play' : 'Pause');
    ctl.dataset.mode = mode;
  };

  function add(step, instant, target = log) {
    let el;
    if (step.t === 'user') {
      const att = step.attach ? (step.attach.doc
        ? `<span class="att doc"><span class="doc-i" aria-hidden="true">PDF</span>${esc(step.attach.label)}</span>`
        : `<span class="att"><img src="${thumb(step.attach.id)}" alt="" width="20" height="28">${esc(step.attach.label)}</span>`) : '';
      el = h(`<li class="msg u"><div class="bub">${att}<p>${esc(step.text)}</p></div></li>`);
    } else if (step.t === 'tool') {
      el = h(`<li class="msg tool${instant ? ' done' : ''}"><span class="tl-i">${icon.tool}</span><span>Trezzit <span aria-hidden="true">·</span> ${esc(step.name)}</span><span class="tl-s" aria-hidden="true">${icon.check}</span></li>`);
    } else if (step.t === 'card') {
      if (step.replace) {
        const prev = [...target.querySelectorAll('.msg.card')].pop();
        if (prev) { prev.querySelector('.tc').outerHTML = step.html; if (!instant) prev.classList.add('swap'); return prev; }
      }
      el = h(`<li class="msg card">${step.html}</li>`);
    } else if (step.t === 'act') {
      el = h(`<li class="msg act"><span class="act-i">${icon.check}</span><span>${step.html}</span></li>`);
    } else {
      el = h(`<li class="msg a"><p>${step.html || esc(step.text)}</p></li>`);
    }
    if (!instant) el.classList.add('enter');
    target.appendChild(el);
    return el;
  }

  // The panel fits the tallest conversation at the current width, so it never has to scroll.
  // Measured off-screen with the real markup and styles; re-measured when the width changes.
  const probe = log.cloneNode(false);
  probe.removeAttribute('aria-label');
  probe.setAttribute('aria-hidden', 'true');
  probe.className = 'chat-log chat-probe';
  win.appendChild(probe);
  let lastW = 0;
  function fit() {
    const w = log.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    let max = 0;
    keys.forEach((k) => {
      probe.innerHTML = '';
      stepsOf(k).forEach((s) => add(s, true, probe));
      max = Math.max(max, probe.scrollHeight);
    });
    probe.innerHTML = '';
    log.style.height = `${Math.ceil(max) + 2}px`;
  }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(() => fit()).observe(win);
  narrowMQ.addEventListener?.('change', () => { lastW = 0; fit(); if (state === 'done') play(current, { instant: true }); });
  document.fonts?.ready.then(() => { lastW = 0; fit(); });

  async function wait(ms, my) {
    let left = ms;
    while (left > 0) {
      if (my !== run) throw new Error('stale');
      if (paused) { await new Promise((res) => { gate = res; }); continue; }
      const step = Math.min(left, 100);
      await sleep(step);
      left -= step;
    }
    if (my !== run) throw new Error('stale');
  }

  async function play(k, { instant = reduced() } = {}) {
    run += 1;
    const my = run;
    current = k;
    paused = false;
    gate?.();
    root.querySelectorAll('.prompt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    const steps = stepsOf(k);
    log.setAttribute('aria-busy', 'true');
    if (instant) {
      log.innerHTML = '';
      steps.forEach((s) => add(s, true));
      state = 'done'; setCtl(); log.setAttribute('aria-busy', 'false');
      return;
    }
    state = 'playing'; setCtl();
    try {
      // the old exchange fades out first, then the new question starts at the top
      if (log.children.length) {
        log.classList.add('fading');
        await wait(220, my);
      }
      log.innerHTML = '';
      log.classList.remove('fading');
      for (const s of steps) {
        if (s.t === 'user') await wait(s.wait || 200, my);
        if (s.t === 'tool') await wait(220, my);
        if (s.t === 'card') await wait(160, my);
        if (s.t === 'ai') await wait(320, my);
        if (s.t === 'act') await wait(500, my);
        const el = add(s, false);
        if (s.t === 'tool') { await wait(280, my); el.classList.add('done'); }
      }
      state = 'done'; setCtl();
    } catch { /* superseded */ }
    if (my === run) { log.classList.remove('fading'); log.setAttribute('aria-busy', 'false'); }
  }

  root.querySelectorAll('.prompt').forEach((b) => b.addEventListener('click', () => {
    touched = true;
    // the autoplay stays quiet for screen readers; conversations the visitor starts are announced
    log.setAttribute('aria-live', 'polite');
    // the whole exchange must be on screen: if the panel is cut off, bring its top just under the nav first
    const rect = win.getBoundingClientRect();
    if (rect.top < 64 || rect.bottom > innerHeight) win.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    play(b.dataset.k);
  }));
  ctl.addEventListener('click', () => {
    touched = true;
    if (ctl.dataset.mode === 'replay') { play(current, { instant: false }); return; }
    paused = !paused;
    state = paused ? 'paused' : 'playing';
    if (!paused) gate?.();
    setCtl();
  });

  // First state: the finished first exchange, so the panel is never an empty box.
  play(keys[0], { instant: true });
  // After 6s in view (and no tap), the next conversation plays once by itself.
  if (!reduced() && opts.autoplay !== false && keys.length > 1 && 'IntersectionObserver' in window) {
    let t = 0;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(t);
      if (touched) { io.disconnect(); return; }
      if (e.isIntersecting) t = setTimeout(() => { io.disconnect(); if (!touched) play(keys[1], { instant: false }); }, 6000);
    }, { threshold: 0.6 });
    io.observe(win);
  }
  setCtl();
  return { play, fit };
}
