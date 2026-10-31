/* scan-demo.js: tap a sample receipt (recorded scan) or use your own photo
 * (live on trezzit.com only: the kit's scan-client runs the app's scan embed) and watch it read.
 * E: C's card with A's read: the paper moves under the beam line by line, read lines keep a faint tint,
 * the status counts "Reading items 6 of 14" and ends on "Adds up to $100.00" (or says what doesn't).
 * "Your photo" is always offered: on trezzit.com it is scanned for real after the AI disclosure, its lines
 * appear as the scan streams them, and "Split this receipt" opens the app's /split with that scan;
 * anywhere else it stays on the device and the closest recorded sample plays, with a notice. */
import { scan, isLive, closestSample, loadScanner } from '../../_kit/scan-client.js';
import { receiptHTML as kitReceiptHTML, ensureReceiptStyles, splitSample } from '../../_kit/receipts.js';
// the printed "ITEMS 19" counts units; every label on the page counts lines (14), so the footer line goes
const receiptHTML = (raw, o) => kitReceiptHTML(raw, o).replace(/<p>ITEMS \d+<\/p>\s*/, '');
import { toCents } from '../../_kit/split-engine.js';
import { SAMPLE_META, CATEGORIES, getSample, sampleBill } from './data.js';
import { h, esc, money, reduced, onVisible, itemName, storeName, prettyDate, icon, bus, css } from './util.js';

const STAGE_LABEL = { idle: 'Ready', uploading: 'Uploading', reading: 'Reading items', checking: 'Checking the math', done: 'Checking the math' }; // never "Done" beside a total still counting
// one line of compact chips: the list's label says what they mean
const CHECK_LABEL = {
  items_total_check: 'Subtotal',
  grand_total_check: 'Total',
  tax_distribution_check: 'Tax',
};

/** One plain-words chip instead of three cryptic ones: the math was checked against the receipt.
 *  (No tax check on a receipt without tax; a failed check says what failed.) */
const checksFor = (bill) => {
  const v = (bill?.backendValidations || []).filter((c) => c.check !== 'tax_distribution_check' || Number(bill.tax) > 0);
  if (!v.length) return [];
  const bad = v.find((c) => !c.passed);
  return [bad ? { passed: false, message: `${CHECK_LABEL[bad.check] || 'Total'} doesn’t match the receipt` } : { passed: true, message: 'Matches the receipt' }];
};
/* a live scan's status words (the server's stages), shown where the sample read says "Reading items 6 of 14" */
const LIVE_LABEL = { uploading: 'Uploading…', validating: 'Checking the math…', retrying: 'Reading it again…' };
/* what the privacy policy says about a scanned photo (Google Gemini reads it; a small sample is reviewed with Claude) */
const AI_NOTE = 'To read it, your photo is sent to Google Gemini, and a small sample of scans is reviewed with Anthropic’s Claude to improve accuracy.';
/* a store name the reader could not find ("N/A", "Unknown") is no heading: the photo's own name stays */
const NO_NAME = /^(n\/?a|none|null|unknown|-+)$/i;
/* failures that may pass on their own: "Try again" sends the same photo once more */
const TRANSIENT = new Set(['NETWORK', 'SCAN_TIMEOUT', 'SERVICE_BUSY', 'UNAVAILABLE', 'SERVER_ERROR']);
/* sessionStorage key: a live scan was running when the page was left (Back, Forward, reload) */
const LEFT_KEY = 'trezzit-scan-left';
const checkLI = (c, i, pending) => `<li class="${c.passed ? 'ok' : 'warn'}${pending ? ' pending' : ''}" style="--i:${i}">${icon.check}<span>${esc(CHECK_LABEL[c.check] || c.message)}</span></li>`;

/**
 * mountScan(root, { samples, initial, autoplay, splitTarget, compact })
 *  samples: sample ids for the picker; initial: first sample; autoplay: scan when visible;
 *  splitTarget: selector the "Split this receipt" button scrolls to (omit to hide it).
 */
export function mountScan(root, opts = {}) {
  // one mount per frame: a second call would rewrite the markup under a running scan
  if (root._scan) return root._scan;
  css('scan'); // its styles (linked by the page, or loaded by home.js before mounting)
  ensureReceiptStyles();
  const ids = opts.samples || ['green-basket', 'taqueria-sol', 'corner-pharmacy', 'monthly-rent'];
  const base = new URL('../assets/', import.meta.url).href;
  // "Your photo" only where it is real (trezzit.com): elsewhere it could only replay a sample
  // (opts.own 'always': offered everywhere; off trezzit.com it opens the honest notice and plays a sample)
  const own = opts.own === 'always' || (isLive() && opts.own !== false);
  root.classList.add('scan', 'booting'); // hidden until the first receipt is laid out at its final size
  root.classList.toggle('no-own', !own);
  root.classList.toggle('no-total', opts.total === false);
  root.innerHTML = `
    <div class="scan-pick" role="group" aria-label="Pick a receipt to scan"${ids.length < 2 && !own ? ' hidden' : ''}>
      ${ids.map((id) => `<button type="button" class="pick" data-id="${id}" aria-pressed="false">
        <img src="${base}thumb-${id}.webp" alt="" width="36" height="52" loading="lazy" decoding="async">
        <span><b>${esc(opts.names?.[id] || SAMPLE_META[id].short)}</b>${opts.kinds === false ? '' : `<small>${esc(SAMPLE_META[id].kind)}</small>`}${own ? '<small class="pick-tag">Sample</small>' : ''}</span></button>`).join('')}
      ${own ? `<button type="button" class="pick pick-own" data-own aria-expanded="false">
        <span class="pick-ico">${icon.upload}</span><span><b>Your photo</b>${opts.kinds === false ? '' : '<small>Photo or PDF</small>'}</span></button>` : ''}
    </div>
    <div class="scan-body">
      <div class="scan-stage" aria-hidden="true">
        <div class="scan-paper"></div>
        <div class="scan-beam"></div>
        <div class="scan-fade"></div>
      </div>
      <div class="scan-out">
        <div class="so-head">
          <div class="so-prog" aria-hidden="true"><i></i></div>
          <p class="so-store"></p>
          <button type="button" class="chat-ctl so-again" aria-label="Scan again" title="Scan again">${icon.replay}</button>
        </div>
        <div class="so-mid">
          <ol class="so-items" aria-label="Items read from the receipt"></ol>
          <p class="so-rest"><span></span><span class="money"></span><span class="so-live" aria-hidden="true"></span></p>
          <button type="button" class="c-link-btn so-more" hidden></button>
          <p class="so-sum"></p>
          <div class="so-cats" hidden></div>
        </div>
        <div class="so-foot">
          <div class="so-sumup"><p class="so-total"><span>Total</span><b class="money"></b></p>
          <p class="so-status" aria-live="polite"><span class="dot"></span><span class="txt"></span></p></div>
          <ul class="so-checks" aria-label="Checked against the receipt"></ul>
          ${opts.splitTarget ? `<button type="button" class="c-link-btn so-split">Split this receipt ${icon.arrow}</button>` : ''}
          ${opts.soloSummary ? '<p class="so-mine" hidden></p>' : opts.soloHref ? `<a class="c-link-btn so-split so-solo" href="${esc(opts.soloHref)}" hidden><span>${esc(opts.soloLabel || 'See your share')}</span>${icon.arrow}</a>` : ''}
          ${opts.liveNext ? `<a class="c-link-btn so-next" href="${esc(opts.liveNext.href)}" hidden>${esc(opts.liveNext.label)} ${icon.arrow}</a>` : ''}
        </div>
        <p class="so-notice" hidden aria-live="polite"></p>
      </div>
    </div>
    <div class="scan-consent" hidden role="dialog" aria-modal="false" aria-label="Scan your own receipt">
      <p>${isLive() ? esc(opts.consentNote || AI_NOTE) : 'Real scans run on trezzit.com. Here your photo stays on your device, and a sample receipt plays instead.'} <a href="/privacy">Privacy</a></p>
      <div class="sc-actions">
        <label class="c-btn c-btn-sm c-btn-primary">Choose a photo<input type="file" accept="image/*,application/pdf" class="visually-hidden"></label>
        <button type="button" class="c-btn c-btn-sm c-btn-quiet sc-cancel">Cancel</button>
      </div>
    </div>`;
  uid += 1;

  const stage = root.querySelector('.scan-stage');
  const paper = root.querySelector('.scan-paper');
  const statusEl = root.querySelector('.so-status');
  const storeEl = root.querySelector('.so-store');
  const list = root.querySelector('.so-items');
  const checks = root.querySelector('.so-checks');
  const totalEl = root.querySelector('.so-total b');
  const sumEl = root.querySelector('.so-sum');
  // the receipt-level amounts between the items and the total, so "adds up" is visibly true
  const setSum = (bill) => {
    const cur = bill?.currency || 'USD';
    const parts = [['Subtotal', bill?.subtotal], ['Tax', bill?.tax], ['Tip', bill?.tip]]
      .filter(([, v]) => v != null && toCents(v) > 0)
      .map(([k, v]) => `${k} <span class="money">${money(toCents(v), cur)}</span>`);
    sumEl.innerHTML = parts.join(' <span aria-hidden="true">·</span> ');
  };
  const splitBtn = root.querySelector('button.so-split:not(.so-solo)');
  const soloLink = root.querySelector('.so-solo') || root.querySelector('.so-mine');
  // a receipt that is just yours has nothing to split: say where it went instead (home: in place, by category)
  const setSolo = (id) => {
    if (!splitBtn) return;
    const solo = !!id && getSample(id)?.people?.length === 1;
    if (soloLink) soloLink.hidden = !solo || !!opts.soloSummary;
    splitBtn.hidden = solo;
  };
  // the read ends on one small picture instead of the item list (step 2 shows the items): the receipt,
  // sorted by category. A receipt that is just yours says so.
  const catsEl = root.querySelector('.so-cats');
  const setCats = (id, bill) => {
    if (!id || !getSample(id)) { catsEl.hidden = true; catsEl.innerHTML = ''; return; }
    const sm = getSample(id);
    const r = splitSample(sm, bill);
    const by = {};
    Object.values(r.people).forEach((pp) => Object.entries(pp.byCategory || {}).forEach(([k, c]) => { by[k] = (by[k] || 0) + c; }));
    const cats = Object.entries(by).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
    const sum = cats.reduce((a, [, c]) => a + c, 0) || 1;
    const C = (k) => CATEGORIES[k] || CATEGORIES.other;
    catsEl.innerHTML = `<p class="so-ck">${sm.people.length === 1 ? 'All yours, by category' : 'By category'}</p>
      <div class="so-bar" aria-hidden="true">${cats.map(([k, c]) => `<i style="--w:${c / sum};--c:${C(k).color}"></i>`).join('')}</div>
      <ul class="so-leg" role="list">${cats.map(([k, c]) => `<li><i style="--c:${C(k).color}"></i>${esc(C(k).label)} <b class="money">${money(c)}</b></li>`).join('')}</ul>`;
    catsEl.hidden = false;
  };
  const notice = root.querySelector('.so-notice');
  const nextLink = root.querySelector('.so-next'); // after your own photo's read: the page's next step
  const prog = root.querySelector('.so-prog i');
  const txt = statusEl.querySelector('.txt');
  const setProg = (f) => { prog.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`; };
  let nItems = 0;
  const moreBtn = root.querySelector('.so-more');
  const syncMore = () => {
    const n = list.children.length;
    // a short receipt keeps the link's space, so both samples end at one height
    moreBtn.hidden = false;
    moreBtn.style.visibility = n <= (matchMedia('(max-width: 719px)').matches ? 4 : 6) ? 'hidden' : '';
    moreBtn.textContent = root.classList.contains('short') ? `Show all ${n} items` : 'Show fewer items';
  };
  root.classList.add('short');
  moreBtn.addEventListener('click', () => { root.classList.toggle('short'); syncMore(); setRest(); });
  const consent = root.querySelector('.scan-consent');
  const ownBtn = root.querySelector('[data-own]');
  const fileInput = consent.querySelector('input[type=file]');
  let ctrl = null;
  let last = null;
  let objectUrl = null;

  const actions = root.querySelectorAll('.so-split');
  // while it reads, the progress words sit in the "+ N more items" row (the row the read ends on), so there is
  // no empty band above the total, and the total itself stays blank until it lands on the printed total
  const live = root.querySelector('.so-live');
  const setLive = (t) => { live.textContent = t || ''; };
  const setStage = (s) => {
    root.dataset.stage = s;
    actions.forEach((a) => { if (s === 'done') a.removeAttribute('aria-disabled'); else a.setAttribute('aria-disabled', 'true'); });
    txt.textContent = STAGE_LABEL[s] || s;
    setLive(s === 'done' || s === 'idle' ? '' : STAGE_LABEL[s] || s);
    if (s === 'idle') setProg(0);
  };
  // one selected tab at a time; while the photo notice is open, "Your photo" is the selected one and the sample
  // that plays behind it is remembered for when the notice closes
  const press = (id) => {
    const btns = root.querySelectorAll('.pick[data-id]');
    if (!consent.hidden) { heldPick = [...btns].find((b) => b.dataset.id === id) || null; btns.forEach((b) => b.setAttribute('aria-pressed', 'false')); return; }
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  };

  // phones: the window opens at the first item line (the store's address and register lines are noise there)
  const phoneMQ = matchMedia('(max-width: 719px)');
  const top0 = () => {
    if (!phoneMQ.matches || opts.fromTop) return 0;
    const first = paper.querySelector('.tz-r-line');
    return first ? Math.max(0, Math.round(first.getBoundingClientRect().top - paper.getBoundingClientRect().top) - 10) : 0;
  };
  const rest0 = () => { paper.style.transform = `translateY(${-top0()}px)`; };
  function showPaper(html) {
    paper.innerHTML = html;
    rest0();
  }
  function follow(index) {
    const line = paper.querySelector(`.tz-r-line[data-index="${index}"]`);
    paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => { l.classList.remove('is-active'); l.classList.add('is-read'); });
    if (!line) return;
    line.classList.add('is-active');
    const max = Math.max(0, paper.scrollHeight - stage.clientHeight);
    const y = Math.min(max, Math.max(top0(), line.offsetTop - stage.clientHeight * 0.42));
    paper.style.transform = `translateY(${-y}px)`;
  }
  function settlePaper() {
    paper.querySelectorAll('.tz-r-line.is-active, .tz-r-line.is-read').forEach((l) => l.classList.remove('is-active', 'is-read'));
    const max = Math.max(0, paper.scrollHeight - stage.clientHeight);
    const total = paper.querySelector('.tz-r-total');
    const y = total ? Math.min(max, Math.max(0, total.offsetTop - stage.clientHeight * 0.5)) : 0;
    paper.style.transform = `translateY(${-y}px)`;
  }

  function reset(store) {
    list.innerHTML = '';
    checks.innerHTML = '';
    totalEl.textContent = '—';
    sumEl.innerHTML = '';
    storeEl.innerHTML = store || '';
    notice.hidden = true;
    root.classList.remove('is-done', 'is-note', 'is-bad', 'is-err', 'no-photo', 'has-cats', 'rolling');
    if (nextLink) nextLink.hidden = true;
    winK = 0;
    setRest(null);
    setCats(null);
    root.classList.add('short');
    setProg(0);
    moreBtn.style.visibility = 'hidden';
  }

  const itemLI = (it, i, pending) => `<li class="so-item${pending ? ' pending' : ''}" style="--i:${i}"><span>${esc(itemName(it.name))}${Number(it.quantity) > 1 && Number.isInteger(+it.quantity) ? ` <small>×${+it.quantity}</small>` : ''}</span><span class="money">${money(toCents(it.amount))}</span></li>`;
  // the lines the list folds away, as one muted row, so the visible figures add up to the total on screen
  const restEl = root.querySelector('.so-rest');
  let restBill = null;
  function setRest(bill = restBill) {
    restBill = bill;
    if (!bill) { restEl.hidden = true; return; }
    const rows = [...list.children];
    const shown = rows.map((li, i) => [li, i]).filter(([li]) => getComputedStyle(li).display !== 'none');
    const n = rows.length - shown.length;
    const shownC = shown.reduce((a, [, i]) => a + toCents(bill.items[i]?.amount || 0), 0);
    // what the folded lines (plus tax and tip) come to, from the lines themselves: when a scan's lines miss the
    // printed total, the visible figures add up to what was read, never to a total they do not make
    const tipC = bill.items.some((it) => it.itemType === 'Tip') ? 0 : toCents(bill.tip);
    const readC = bill.items.reduce((a, it) => a + toCents(it.amount), 0) + toCents(bill.tax) + tipC - Math.round((bill.discountAmount || 0) * 100);
    const rest = readC - shownC;
    restEl.hidden = rest <= 0;
    const extra = toCents(bill.tax) > 0 ? 'tax' : toCents(bill.tip) > 0 ? 'tip' : '';
    restEl.firstChild.textContent = n ? `+ ${n} more item${n === 1 ? '' : 's'}${extra ? ` and ${extra}` : ''}` : extra.replace(/^./, (c) => c.toUpperCase()) || 'Other';
    restEl.querySelector('.money').textContent = money(rest, bill.currency || 'USD');
  }
  // while the beam reads, the list shows the last lines read (a window that follows the beam), so the list
  // and the paper never disagree; once the total lands it folds back to the first lines plus "+ N more"
  let winK = 0;
  function roll(shown) {
    if (!winK) { root.classList.remove('rolling'); winK = [...list.children].filter((li) => getComputedStyle(li).display !== 'none').length; }
    const n = list.children.length;
    if (!winK || n <= winK) return;
    const lo = Math.max(0, Math.min(shown, n) - winK);
    [...list.children].forEach((li, i) => li.classList.toggle('win', i >= lo && i < lo + winK));
    root.classList.add('rolling');
  }
  const unroll = () => { root.classList.remove('rolling'); list.querySelectorAll('.win').forEach((li) => li.classList.remove('win')); winK = 0; };
  function addItem(it, i) {
    const row = list.children[i];
    if (row?.classList.contains('pending')) { row.classList.remove('pending'); return; }
    list.appendChild(h(itemLI(it, i, false)));
  }
  /* A known receipt is laid out at its final size first (rows as quiet placeholders),
     then revealed in place, so nothing below the demo moves while it scans. */
  function layout(bill) {
    list.innerHTML = bill.items.map((it, i) => itemLI(it, i, true)).join('');
    checks.innerHTML = checksFor(bill).map((c, i) => checkLI(c, i, true)).join('');
    // the total stays blank while the lines are read (a running sum beside "Total" would contradict the receipt)
    totalEl.textContent = '—';
    setSum(bill);
    syncMore();
    setRest(bill);
  }

  let liveFile = null; // the photo being (or last) scanned
  let liveBusy = false; // a photo is being scanned: a tap on it (or on replay) must not throw the scan away
  /* ---- a live scan: the lines appear as the stream reads them (no made-up progress) ---- */
  // how many rows the folded list shows at this width (the CSS decides: 4 or 6), measured on placeholder rows
  const windowSize = () => {
    list.innerHTML = Array.from({ length: 8 }, (_, i) => itemLI({ name: '', amount: 0 }, i, true)).join('');
    const n = [...list.children].filter((li) => getComputedStyle(li).display !== 'none').length;
    list.innerHTML = '';
    return n || 6;
  };
  const draftRow = (it, i) => `<li class="so-item" style="--i:${i}"><span>${esc(itemName(it.name))}</span><span class="money">${it.price != null ? money(toCents(it.price)) : ''}</span></li>`;
  function liveState() {
    let status = 'uploading'; let lines = 0; let offline = false; let cap = 6;
    const show = () => {
      setStage(status === 'uploading' ? 'uploading' : status === 'validating' ? 'checking' : 'reading');
      const words = offline ? 'Waiting for a connection…'
        : LIVE_LABEL[status] || (lines ? `Reading… ${lines} item${lines === 1 ? '' : 's'}` : 'Reading…');
      txt.textContent = words;
      setLive(words);
      restEl.hidden = false; // the row that carries the words while it reads
    };
    return {
      start() { cap = windowSize(); show(); },
      status(s) { status = s; show(); },
      connection(on) { offline = !on; show(); },
      draft(d) {
        if (d.store && !NO_NAME.test(String(d.store).trim())) storeEl.innerHTML = `<b>${esc(storeName(d.store))}</b>${prettyDate(d.date) ? `<span>${esc(prettyDate(d.date))}</span>` : ''}`;
        if (d.items.length < list.children.length) { list.innerHTML = ''; winK = 0; root.classList.remove('rolling'); } // a retry starts over
        d.items.forEach((it, i) => {
          const row = list.children[i];
          if (!row) { list.appendChild(h(draftRow(it, i))); return; }
          const [name, price] = row.children; // a line read again (its price arrived): updated in place, no new animation
          const nm = itemName(it.name); const pr = it.price != null ? money(toCents(it.price)) : '';
          if (name.textContent !== nm) name.textContent = nm;
          if (price.textContent !== pr) price.textContent = pr;
        });
        lines = d.items.length;
        if (lines > cap) { winK = cap; roll(lines); }
        // the photo moves one step under the beam per line read
        const max = Math.max(0, paper.scrollHeight - stage.clientHeight);
        paper.style.transform = `translateY(${-Math.min(max, lines * 18)}px)`;
        show();
      },
    };
  }
  /** The live scan's final lines, replacing the drafts in place (a renamed line updates, new ones rise in). */
  function finalRows(bill) {
    bill.items.forEach((it, i) => {
      const html = itemLI(it, i, false);
      const row = list.children[i];
      if (!row) list.appendChild(h(html));
      else if (row.textContent !== h(html).textContent) row.replaceWith(h(html));
    });
    while (list.children.length > bill.items.length) list.lastElementChild.remove();
  }
  /** A failed live scan, in a compact card at a stable height: what happened, then what can be done.
   *  Not a receipt (or nothing read): choose another photo; a passing problem (network, busy, slow): try the
   *  same photo again; the hourly limit: a sample only. "Use a sample" is always there. */
  function showError(err, file, { stopped = false } = {}) {
    setStage('idle');
    unroll();
    list.innerHTML = '';
    setRest(null);
    rest0();
    root.classList.add('is-err');
    root.classList.toggle('no-photo', !objectUrl || !file);
    storeEl.innerHTML = `<b>${esc((file && file.name) || 'Your photo')}</b>`;
    press(null);
    ownBtn?.setAttribute('aria-pressed', 'true');
    const code = err?.code || '';
    let msg = err?.message || 'That didn’t work.';
    let act = 'pick'; // what the first action is: 'pick' another photo, 'retry' this one, or none
    if (stopped) { msg = 'Your scan stopped when you left the page.'; act = 'again'; }
    else if (code === 'NO_RECEIPT' || code === 'NO_ITEMS') msg = 'That doesn’t look like a receipt.';
    else if (code === 'RATE_LIMITED') { msg = `${msg} Photo scans are limited to 10 an hour.`; act = ''; }
    else if (TRANSIENT.has(code)) act = 'retry';
    if (code === 'NETWORK' && typeof navigator !== 'undefined' && navigator.onLine === false) msg = 'You’re offline. Check your connection and try again.';
    const first = act === 'retry' && file ? '<button type="button" class="c-link-btn so-retry">Try again</button>'
      : act === 'pick' || act === 'again' ? `<button type="button" class="c-link-btn so-pick">${act === 'again' ? 'Scan again' : 'Choose another photo'}</button>` : '';
    notice.innerHTML = `<span class="so-msg">${esc(msg)}</span><span class="so-acts">${first}<button type="button" class="c-link-btn so-sample">Use a sample</button></span>`;
    notice.hidden = false;
    notice.querySelector('.so-retry')?.addEventListener('click', () => { ownBtn?.focus({ preventScroll: true }); run(file); });
    // the photo notice was read before this photo was sent, so another photo goes straight to the picker
    // (after leaving the page, the notice is shown again first)
    notice.querySelector('.so-pick')?.addEventListener('click', () => { if (act === 'again') { openConsent(); } else fileInput.click(); });
    notice.querySelector('.so-sample').addEventListener('click', () => { run(opts.initial || ids[0]); root.querySelector('.pick[aria-pressed="true"]')?.focus(); });
    if (!stopped) keepInView(notice);
  }
  /** Brings el into view if it is not (no smooth scroll with reduced motion). */
  function keepInView(el, block = 'nearest') {
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      if (r.top >= 72 && r.bottom <= innerHeight) return;
      el.scrollIntoView({ block, behavior: reduced() ? 'auto' : 'smooth' });
    });
  }

  async function run(input, { instant = false, note = '' } = {}) {
    // off trezzit.com a photo never leaves the device: the closest recorded sample plays, and says so up front
    if (typeof input !== 'string' && !isLive()) return run(ids.includes(closestSample(input)) ? closestSample(input) : ids[0], { instant, note: 'Real scans run on trezzit.com, so this is a sample receipt.' });
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const isFile = typeof input !== 'string';
    if (!isFile) {
      press(input);
      setSolo(input);
      const { raw, bill } = await sampleBill(input);
      nItems = bill.items.length;
      showPaper(receiptHTML(raw, { sample: getSample(input), shadow: false }));
      reset(storeLine(raw.receipt));
      if (note) { notice.textContent = note; notice.hidden = false; }
      layout(bill);
      opts.onStart?.(input);
    } else {
      press(null);
      setSolo(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = input.type.startsWith('image/') ? URL.createObjectURL(input) : null;
      showPaper(objectUrl ? `<img class="scan-photo" src="${objectUrl}" alt="">` : '<div class="scan-pdf">PDF</div>');
      reset(`<b>${esc(input.name || 'Your photo')}</b>`);
      ownBtn?.setAttribute('aria-pressed', 'true');
      nItems = 0;
    }
    if (!isFile) ownBtn?.removeAttribute('aria-pressed');
    let shown = 0;
    // a live scan reports itself (onStatus, onDraft); onStage then only drives a sample played instead
    const live = isFile ? liveState() : null;
    liveBusy = isFile;
    if (isFile) liveFile = input;
    let streamed = false;
    const ifLive = (fn) => (...a) => { if (signal.aborted) return; if (!streamed) { streamed = true; live.start(); } fn(...a); };
    if (isFile) {
      // the status shows at once ("Uploading…"), and the photo and that line are brought into view
      streamed = true;
      live.start();
      keepInView(stage, 'start');
    }
    try {
      const result = await (isFile ? scan : playLocal)(input, {
        signal,
        instant: instant || reduced(),
        ...(isFile ? {
          onStatus: ifLive((st) => live.status(st)),
          onDraft: ifLive((d) => live.draft(d)),
          onConnection: ifLive((on) => live.connection(on)),
          onProgress: (pct) => { if (!signal.aborted && pct > 0) setProg(0.02 + 0.13 * Math.min(100, pct) / 100); }, // the upload's own progress only
        } : {}),
        onStage(stage, detail) {
          if (signal.aborted || streamed) return;
          setStage(stage);
          if (stage === 'uploading') setProg(0.06);
          if (stage === 'reading' && detail.items) {
            for (; shown < detail.items.length; shown += 1) addItem(detail.items[shown], shown);
            if (shown) { follow(shown - 1); roll(shown); }
            const n = nItems || detail.items.length;
            if (shown) { txt.textContent = `Reading items ${shown} of ${n}`; setLive(txt.textContent); }
            setProg(0.1 + 0.8 * (n ? shown / n : 0));
          }
          if (stage === 'checking') setProg(0.95);
          if (stage === 'checking') {
            settlePaper();
            if (checks.querySelector('.pending')) checks.querySelectorAll('.pending').forEach((li) => li.classList.remove('pending'));
            else {
              const bill = { backendValidations: detail.validations || [], tax: detail.tax ?? 1 };
              checks.innerHTML = checksFor(bill).map((c, i) => checkLI(c, i, false)).join('');
            }
          }
        },
      });
      if (signal.aborted) return;
      if (result.source === 'live' && !result.bill.items.length) throw Object.assign(new Error('That doesn’t look like a receipt.'), { code: 'NO_ITEMS' });
      last = result;
      let fellBack = false;
      if (result.source === 'sample' && isFile) {
        // fell back (the scanner did not load): the sample that played is the one selected tab, and it says so
        fellBack = true;
        ownBtn?.removeAttribute('aria-pressed');
        press(ids.includes(result.sampleId) ? result.sampleId : null);
        setSolo(result.sampleId);
        showPaper(receiptHTML(result.raw, { sample: getSample(result.sampleId), shadow: false }));
        settlePaper();
        storeEl.innerHTML = storeLine(result.raw.receipt);
        finalRows(result.bill);
      }
      if (result.source === 'live') {
        storeEl.innerHTML = storeLine(result.raw.receipt);
        finalRows(result.bill);
      }
      // the status says "Adds up" only once the total has finished counting, so the two never disagree
      totalEl.textContent = money(toCents(result.bill.total), result.bill.currency || 'USD');
      setSum(result.bill);
      const catId = result.source === 'sample' ? (result.sampleId || input) : null;
      if (catId && opts.cats !== false) { setCats(catId, result.bill); root.classList.add('has-cats'); }
      if (fellBack) {
        notice.innerHTML = `<span class="so-msg">Scanning couldn’t start, so this is a sample.</span><span class="so-acts"><button type="button" class="c-link-btn so-retry">Try again</button></span>`;
        notice.querySelector('.so-retry').addEventListener('click', () => { ownBtn?.focus({ preventScroll: true }); run(input); });
        notice.hidden = false;
        keepInView(notice);
      } else if (result.notice || note) { notice.textContent = note || result.notice; notice.hidden = false; }
      if (nextLink && result.source === 'live') nextLink.hidden = false;
      nItems = result.bill.items.length;
      if (isFile) {
        const v = checksFor(result.bill);
        checks.innerHTML = v.map((c, i) => checkLI(c, i, false)).join('');
      }
      unroll();
      root.classList.add('is-done');
      paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => l.classList.remove('is-active'));
      rest0();
      syncMore();
      setRest(result.bill);
      setStage('done');
      setProg(1);
      // the read ends on the check, in plain words: the lines (plus tax and tip) make the printed total
      const b = result.bill;
      const tipC = b.items.some((it) => it.itemType === 'Tip') ? 0 : toCents(b.tip);
      const sum = b.items.reduce((a, it) => a + toCents(it.amount), 0) + toCents(b.tax) + tipC - Math.round((b.discountAmount || 0) * 100);
      const ok = sum === toCents(b.total);
      root.classList.toggle('is-bad', !ok);
      // when the lines do not make the printed total, say both figures (never "Adds up")
      txt.innerHTML = ok ? `${icon.check}Adds up to ${money(toCents(b.total), b.currency || 'USD')}`
        : `The receipt says ${money(toCents(b.total), b.currency || 'USD')}; the lines make ${money(sum, b.currency || 'USD')}`;
      liveBusy = false;
      opts.onDone?.(result);
    } catch (err) {
      if (signal.aborted || err?.name === 'AbortError' || err?.code === 'ABORTED') return;
      liveBusy = false;
      if (isFile) { showError(err, input); return; }
      setStage('idle'); notice.textContent = 'That did not work. Try a sample receipt.'; notice.hidden = false;
    }
  }

  function storeLine(r) {
    const s = r?.storeInformation || {};
    const n = (r?.items || []).length;
    return `<b>${esc(storeName(s.title))}</b><span>${esc(prettyDate(s.dateTimeOfPurchase))}${n && opts.count ? ` · ${n} items` : ''}</span>`;
  }

  root.querySelectorAll('.pick[data-id]').forEach((b) => b.addEventListener('click', () => { closeConsent(); run(b.dataset.id); }));
  // the receipt is the control: the replay button, or a tap on the paper itself, reads it again
  const again = () => { if (liveBusy) return; const id = last?.sampleId || root.querySelector('.pick[aria-pressed="true"]')?.dataset.id || opts.initial || ids[0]; closeConsent(); run(id); };
  root.querySelector('.so-again').addEventListener('click', again);
  stage.addEventListener('click', again);
  // while the notice is open it is the only thing in the frame (opts.consentAlone): no sample result beside it
  // (consentAlone) the open tab is the selected one: the sample's tab lets go until the notice closes
  let heldPick = null;
  const openConsent = () => {
    // a sample still reading behind the notice finishes at once, so it is never left half-read
    if (!liveBusy && ['uploading', 'reading', 'checking'].includes(root.dataset.stage)) run(last?.sampleId || root.querySelector('.pick[aria-pressed="true"]')?.dataset.id || opts.initial || ids[0], { instant: true });
    heldPick = root.querySelector('.pick[data-id][aria-pressed="true"]');
    heldPick?.setAttribute('aria-pressed', 'false');
    consent.hidden = false;
    // the notice is the only thing in the frame, right under the tabs ("Your photo" stays in view)
    if (opts.consentAlone !== false) root.classList.add('consent-on');
    ownBtn?.setAttribute('aria-expanded', 'true');
    if (isLive()) loadScanner().catch(() => {}); // fetch the scanner while the notice is read (nothing is sent)
    fileInput.focus({ preventScroll: true });
    keepInView(consent);
  };
  const closeConsent = () => {
    if (consent.hidden) return;
    consent.hidden = true;
    root.classList.remove('consent-on');
    ownBtn?.setAttribute('aria-expanded', 'false');
    if (heldPick && !root.querySelector('.pick[data-id][aria-pressed="true"]') && ownBtn?.getAttribute('aria-pressed') !== 'true') heldPick.setAttribute('aria-pressed', 'true');
    heldPick = null;
  };
  ownBtn?.addEventListener('click', () => (consent.hidden ? openConsent() : closeConsent()));
  consent.querySelector('.sc-cancel')?.addEventListener('click', () => { closeConsent(); ownBtn?.focus(); });
  // Escape closes the notice wherever focus is
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !consent.hidden) { closeConsent(); ownBtn?.focus(); } });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    closeConsent();
    run(f);
    fileInput.value = '';
  });
  soloLink?.addEventListener('click', (e) => {
    if (soloLink.getAttribute('aria-disabled') === 'true') e.preventDefault();
  });
  splitBtn?.addEventListener('click', () => {
    if (!last || splitBtn.getAttribute('aria-disabled') === 'true') return;
    // your own photo goes to the app's /split, scan and all (same tab: one place to be, Back returns here)
    if (last.source === 'live' && last.handoff) { location.assign(last.handoff); return; }
    bus.emit('receipt', last);
    const target = document.querySelector(opts.splitTarget);
    target?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  });

  // Leaving the page stops a live scan (Back, Forward, reload, another tab's link). Coming back never replays a
  // sample as if it were the visitor's photo: the card says the scan stopped, with "Scan again" and "Use a sample".
  let leftMidScan = false;
  addEventListener('pagehide', () => {
    if (!liveBusy) return;
    leftMidScan = true;
    try { sessionStorage.setItem(LEFT_KEY, `${Date.now()} ${location.pathname}`); } catch { /* storage off: the restore below still works */ }
    ctrl?.abort();
    liveBusy = false;
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted || !leftMidScan) return;
    leftMidScan = false;
    try { sessionStorage.removeItem(LEFT_KEY); } catch { /* ignore */ }
    showError(null, liveFile, { stopped: true });
  });
  let cameBack = false;
  try {
    // kept per page: another page with a scan card (/split) leaves it alone
    const [at, path] = String(sessionStorage.getItem(LEFT_KEY) || '').split(' ');
    if (path === location.pathname) sessionStorage.removeItem(LEFT_KEY);
    const nav = performance.getEntriesByType?.('navigation')?.[0]?.type;
    cameBack = path === location.pathname && Number(at) > 0 && Date.now() - Number(at) < 30 * 60 * 1000 && (nav === 'back_forward' || nav === 'reload');
  } catch { /* storage off */ }
  if (cameBack && own) showError(null, null, { stopped: true });

  // First state: the canonical receipt, read when it comes into view (instantly with reduced motion).
  const first = opts.initial || ids[0];
  sampleBill(first).then(({ raw, bill }) => {
    if (root.dataset.stage) { root.classList.remove('booting'); return; }
    showPaper(receiptHTML(raw, { sample: getSample(first), shadow: false }));
    reset(storeLine(raw.receipt));
    layout(bill);
    root.classList.remove('booting');
    setStage('idle');
    txt.textContent = '';
    // it reads once most of the frame is on screen, so a visitor scrolling past still sees it happen
    if (opts.autoplay !== false) onVisible(root, () => { if (root.dataset.stage === 'idle') run(first); }, { threshold: opts.threshold ?? 0.3 });
  });

  // the frame is as tall as the tallest sample's finished read, measured with the real markup on a hidden
  // copy (and again when the width changes), so switching receipts never moves anything below it
  let lockW = 0;
  async function lockHeight() {
    // keyed on the window width: the frame's own width stops changing at its cap, its media queries don't
    const w = root.offsetWidth;
    if (!w || innerWidth === lockW || opts.lock === false) return;
    lockW = innerWidth;
    const ghost = root.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.classList.remove('booting', 'is-err', 'no-photo', 'consent-on', 'is-bad');
    ghost.querySelector('.scan-consent').hidden = true;
    ghost.querySelector('.so-notice').hidden = true;
    ghost.classList.add('is-done');
    ghost.dataset.stage = 'done';
    ghost.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:${w}px;min-height:0`;
    root.parentNode.style.position ||= 'relative';
    root.parentNode.appendChild(ghost);
    let max = 0;
    for (const id of ids) {
      const { raw, bill } = await sampleBill(id);
      ghost.querySelector('.so-store').innerHTML = storeLine(raw.receipt);
      ghost.querySelector('.so-items').innerHTML = bill.items.map((it, i) => itemLI(it, i, true)).join('');
      ghost.querySelector('.so-status .txt').innerHTML = `${icon.check}Adds up to ${money(toCents(bill.total))}`;
      ghost.querySelector('.so-total b').textContent = money(toCents(bill.total));
      const gr = ghost.querySelector('.so-rest');
      if (gr) { gr.hidden = false; gr.firstChild.textContent = '+ 10 more items and tax'; gr.querySelector('.money').textContent = '$00.00'; }
      ghost.querySelectorAll('button.so-split:not(.so-solo)').forEach((x) => { x.hidden = getSample(id)?.people?.length === 1; });
      ghost.querySelectorAll('a.so-solo').forEach((x) => { x.hidden = getSample(id)?.people?.length !== 1; });
      max = Math.max(max, ghost.offsetHeight);
    }
    ghost.remove();
    if (max) root.style.minHeight = `${max}px`;
  }
  sampleBill(first).then(() => document.fonts?.ready).then(() => lockHeight());
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { lockHeight(); setRest(); if (['idle', 'done'].includes(root.dataset.stage)) rest0(); }); });

  root._scan = { run, get last() { return last; } };
  return root._scan;
}
let uid = 0;

const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  if (ms <= 0) { resolve(); return; }
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});
/** A recorded sample, played with the kit's stages (uploading, reading, checking, done):
 *  about 2.3 s on desktop, capped at 1.8 s on phones so the card is full before a thumb scrolls past. */
async function playLocal(id, { onStage, instant, signal }) {
  const { raw, bill } = await sampleBill(id);
  const phone = matchMedia('(max-width: 719px)').matches;
  const [up, read, check] = instant ? [0, 0, 0] : phone ? [200, 1150, 400] : [350, 1400, 550];
  const emit = (stage, detail = {}) => onStage?.(stage, { sampleId: id, ...detail });
  emit('uploading', { progress: 1 });
  await wait(up, signal);
  emit('reading', { items: [] });
  const n = bill.items.length;
  if (read) for (let i = 1; i <= n; i += 1) { await wait(read / Math.max(1, n), signal); emit('reading', { items: bill.items.slice(0, i) }); }
  else emit('reading', { items: bill.items });
  emit('checking', { validations: bill.backendValidations });
  await wait(check, signal);
  const result = { source: 'sample', sampleId: id, raw, bill };
  emit('done', { result });
  return result;
}
