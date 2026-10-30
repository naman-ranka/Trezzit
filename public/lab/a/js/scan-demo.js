/* scan-demo.js: tap a sample receipt (or use your own photo) and watch it read, line by line.
 * Samples replay the kit's recorded scans. A photo is scanned for real only on https://trezzit.com
 * (scan-client decides), after the AI disclosure; anywhere else it falls back to a sample, with a notice. */
import { scan, isLive, closestSample, normalizeScan } from '../../_kit/scan-client.js';
import { loadScan, receiptHTML, getSample, SAMPLES, CATEGORIES } from '../../_kit/receipts.js';
import { toCents } from '../../_kit/split-engine.js';
import { $, $$, esc, money, ICON, onceVisible, reduced, prettyName, paper as clean } from './util.js';
import { modelFrom, SHORT, dateLabel } from './data.js';

export const STORE_ICON = {
  basket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8zM8.5 9l3-5m4 5l-3-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  fork: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M17 21V3c-2 1-3 3.5-3 7h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-6.5 8 6.5M6.5 9.5V20h11V9.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21zM9 8h6M9 12h6M9 16h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function mountScan(root, { onSplit, onResult, autoStart = true, splitLabel = 'Split this receipt', exclude = [], foldAll = false } = {}) {
  const samples = SAMPLES.filter((s) => !exclude.includes(s.id));
  root.classList.toggle('fold-all', foldAll);
  root.innerHTML = `
    <div class="seg-ctl scan-picker" role="group" aria-label="Choose a receipt">
      ${samples.map((s) => `<button type="button" data-id="${s.id}" aria-pressed="false">${SHORT[s.id].label}</button>`).join('')}
      <button type="button" class="file-pick" aria-pressed="false" aria-label="Your own photo">${ICON.upload}Photo</button>
      <input type="file" class="visually-hidden file-in" accept="image/*,application/pdf" tabindex="-1" aria-hidden="true">
    </div>
    <div class="scan-stage">
      <div class="viewer" aria-hidden="true">
        <div class="viewer-paper"></div>
        <div class="beam"></div>
      </div>
      <div class="panel result" aria-label="What Trezzit reads">
        <div class="result-head">
          <span class="store-ico">${STORE_ICON.receipt}</span>
          <div><p class="result-title">Pick a receipt</p><p class="result-meta">Trezzit reads every line.</p></div>
        </div>
        <div class="status" role="status" aria-live="polite"><span class="spin" hidden></span><span class="ok-ico">${ICON.check}</span><span class="status-t">Waiting for a receipt</span></div>
        <div class="progress" aria-hidden="true"><i></i></div>
        <ul class="items" role="list" tabindex="-1" aria-label="Receipt items"></ul>
        <button type="button" class="more-items is-off" tabindex="-1"></button>
        <div class="sums is-off">${SUMS_PLACEHOLDER}</div>
        <div class="result-cta is-off"><button type="button" class="btn btn-primary split-btn" tabindex="-1">${esc(typeof splitLabel === 'function' ? splitLabel(null) : splitLabel)}</button></div>
        <div class="consent" role="group" aria-labelledby="consent-t" hidden>
          <p class="consent-t" id="consent-t">Scan your own receipt</p>
          <p>To read it, your photo is sent to Google Gemini. Trezzit keeps scan photos for 90 days. <a href="/privacy">Privacy</a></p>
          <div class="row"><button type="button" class="btn btn-quiet" data-v="no">Not now</button><button type="button" class="btn btn-primary" data-v="ok">Choose photo</button></div>
        </div>
      </div>
    </div>`;

  const viewer = $('.viewer', root);
  const paper = $('.viewer-paper', root);
  const beam = $('.beam', root);
  const title = $('.result-title', root);
  const meta = $('.result-meta', root);
  const ico = $('.store-ico', root);
  const status = $('.status', root);
  const statusT = $('.status-t', root);
  const spin = $('.spin', root);
  const bar = $('.progress i', root);
  const list = $('.items', root);
  const sums = $('.sums', root);
  const cta = $('.result-cta', root);
  const splitBtn = $('.split-btn', root);
  const more = $('.more-items', root);
  // phones: the parsed list stays a fixed 5 rows (no layout shift); the rest folds behind "+N more"
  // the landing folds at every width (5 rows on desktop), so the card has one fixed height and never re-grows
  const compact = () => innerWidth < 900;
  const folds = () => compact() || foldAll;
  // phones: 3 rows on the folding pages (the landing and /scan/), so "Split it" and the next heading come sooner
  const foldN = () => (compact() ? (foldAll ? 3 : 4) : 5);
  const showCta = (on) => { cta.classList.toggle('is-off', !on); splitBtn.tabIndex = on ? 0 : -1; };
  function fold(open) {
    const rows = $$('li', list);
    // exactly one row past the fold takes the button's slot instead of a "+1 more" button (same height)
    const FOLD = foldN();
    const six = folds() && !open && rows.length === FOLD + 1;
    const folding = folds() && !open && rows.length > FOLD + 1;
    rows.forEach((li, i) => { li.hidden = folding && i >= FOLD; });
    list.classList.toggle('is-open', !!open);
    list.classList.toggle('is-six', six);
    // the button's slot is always there on phones (visibility only), so showing it moves nothing
    more.classList.toggle('is-off', !folding);
    more.hidden = !!open;
    more.tabIndex = folding ? 0 : -1;
    const n = rows.length - FOLD;
    if (folding) more.textContent = `+${n} more item${n === 1 ? '' : 's'}`;
  }
  more.addEventListener('click', () => fold(true));
  const fileIn = $('.file-in', root);
  const consent = $('.consent', root);
  let agreed = false;
  let ctrl = null;
  let current = null;
  let photoUrl = null;
  let follow = 0;

  const setStatus = (text, kind = 'busy') => {
    statusT.textContent = text;
    status.classList.toggle('is-done', kind === 'done');
    status.classList.toggle('is-note', kind === 'note');
    spin.hidden = kind !== 'busy';
  };
  const press = (id) => $$('.scan-picker button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id || (id === 'file' && b.classList.contains('file-pick')))));

  // phones show the paper at 0.8 (CSS --ps), so about ten lines are in the window while the beam walks down them
  function place(index) {
    const line = paper.querySelector(`.tz-r-line[data-index="${index}"]`);
    if (!line) return;
    line.classList.add('is-read');
    const k = parseFloat(getComputedStyle(paper).getPropertyValue('--ps')) || 1;
    const vh = viewer.clientHeight;
    const ph = paper.scrollHeight * k;
    const pr = paper.getBoundingClientRect();
    const lr = line.getBoundingClientRect();
    // the line's place on the paper, in the paper's own (unscaled, untranslated) units, then on screen
    const y = (lr.top - pr.top) / k;
    const top = y * k;
    const bottom = (y + lr.height / k) * k;
    follow = Math.max(0, Math.min(top - vh * 0.45, ph - vh + 24));
    paper.style.setProperty('--fy', `${-follow}px`);
    beam.style.transform = `translateY(${bottom - follow - 60}px)`;
  }

  function header(model, sampleId) {
    const s = sampleId ? SHORT[sampleId] : null;
    ico.innerHTML = STORE_ICON[s?.icon || 'receipt'];
    title.textContent = model?.merchant || 'Reading…';
    meta.textContent = model ? [dateLabel(model.date), `${model.lines.length} items`].filter(Boolean).join(' · ') : '';
  }

  function itemRow(item, i, sample) {
    const cat = sample?.lines?.[i]?.category || (item.isExtraCharge ? sample?.tipCategory : null) || 'other';
    const qty = Number(item.quantity) > 1 && Number.isInteger(Number(item.quantity)) ? `<span class="q">×${Number(item.quantity)}</span>` : '';
    const li = document.createElement('li');
    li.className = reduced() ? '' : 'in';
    li.innerHTML = `<span class="dot" style="--c:${CATEGORIES[cat]?.color || CATEGORIES.other.color}" title="${esc(CATEGORIES[cat]?.label || '')}"></span>
      <span>${esc(prettyFromRaw(item.name))}${qty}</span><span class="money">${money(toCents(item.amount))}</span>`;
    return li;
  }

  async function run(input, { notice, instant = false } = {}) {
    if (typeof input !== 'string' && !isLive()) {
      // Off trezzit.com the API refuses this origin: say so up front (before the read starts) and play the closest sample.
      return run(closestSample(input), { notice: "Real scans run on trezzit.com. Here's a sample." });
    }
    consent.hidden = true; root.classList.remove('is-asking');
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const isFile = typeof input !== 'string';
    // a photo that fell back to a sample keeps "Your photo" pressed, and its notice is the status for the whole run
    press(isFile || notice ? 'file' : input);
    const say = (text, kind) => { if (!notice) setStatus(text, kind); };
    if (notice) setStatus(notice, 'note');
    list.innerHTML = '';
    list.tabIndex = -1; // an empty list is no tab stop (0px tall, so its focus ring would be invisible)
    list.classList.remove('is-open', 'is-six');
    more.hidden = false; more.classList.add('is-off'); more.tabIndex = -1;
    sums.classList.add('is-off'); sums.innerHTML = SUMS_PLACEHOLDER; showCta(false);
    bar.style.width = '4%';
    viewer.classList.remove('is-scanning');
    paper.style.setProperty('--fy', '0px'); follow = 0;
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }

    let sample = null;
    let total = 0;
    if (isFile) {
      photoUrl = URL.createObjectURL(input);
      paper.innerHTML = input.type.startsWith('image/') ? `<img class="viewer-photo" src="${photoUrl}" alt="">` : '';
      header(null, null);
      title.textContent = input.name || 'Your photo';
      meta.textContent = isLive() ? 'Scanning for real' : 'Real scans run on trezzit.com';
    } else {
      sample = getSample(input);
      const raw = await loadScan(input);
      if (signal.aborted) return;
      paper.innerHTML = clean(receiptHTML(raw, { sample, shadow: true }));
      total = raw.receipt.items.length;
      header({ merchant: titleCaseStore(raw.receipt.storeInformation.title), date: raw.receipt.storeInformation.dateTimeOfPurchase, lines: raw.receipt.items }, input);
    }
    viewer.classList.add('is-scanning');
    let shown = 0;
    try {
      const result = await (isFile ? scan : quick)(input, {
        signal,
        instant: instant || undefined,
        onStage(stage, detail) {
          if (signal.aborted) return;
          // a sample has no photo to upload: it reads from the first moment
          if (stage === 'uploading') { say(isFile ? 'Uploading the photo' : 'Reading the receipt'); bar.style.width = '12%'; }
          if (stage === 'reading') {
            const items = detail.items || [];
            if (!items.length) { say('Reading the receipt'); bar.style.width = '18%'; return; }
            for (; shown < items.length; shown += 1) {
              list.appendChild(itemRow(items[shown], shown, sample));
              if (sample && !instant) place(shown);
            }
            if (!instant) list.scrollTop = list.scrollHeight;
            const n = total || items.length;
            say(`Reading items: ${items.length} of ${n}`);
            bar.style.width = `${18 + 70 * (items.length / n)}%`;
          }
          if (stage === 'checking') { say('Checking the totals'); bar.style.width = '94%'; }
        },
      });
      if (signal.aborted) return;
      finish(notice ? { ...result, notice } : result);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setStatus("Couldn't read that one. Try a sample.", 'note');
      viewer.classList.remove('is-scanning');
    }
  }

  async function finish(result) {
    const model = modelFrom(result);
    current = model;
    viewer.classList.remove('is-scanning');
    if (result.source === 'sample' && result.sampleId && !paper.querySelector('.tz-receipt')) {
      // a dropped photo fell back to a sample: show that sample's paper
      paper.innerHTML = clean(receiptHTML(result.raw, { sample: getSample(result.sampleId), shadow: true }));
      list.innerHTML = '';
      result.bill.items.forEach((it, i) => list.appendChild(itemRow(it, i, getSample(result.sampleId))));
    }
    if (!list.children.length) result.bill.items.forEach((it, i) => list.appendChild(itemRow(it, i, result.sampleId ? getSample(result.sampleId) : null)));
    // the read-line tint fades out once the scan is done (it marks progress, not a result)
    $$('.tz-r-line', paper).forEach((l) => l.classList.remove('is-read'));
    paper.style.setProperty('--fy', '0px'); list.scrollTop = 0;
    list.tabIndex = 0;
    fold(false);
    header(model, result.sampleId);
    const b = result.bill;
    const lineSum = b.items.reduce((a, it) => a + toCents(it.amount), 0) + toCents(b.tax) + (b.items.some((i) => i.itemType === 'Tip') ? 0 : toCents(b.tip)) - Math.round((b.discountAmount || 0) * 100);
    const ok = lineSum === toCents(b.total);
    // the lines plus tax (and tip) make the total, so anyone checking the math can: one row above Total, outside the
    // fold, reserved even when a bill has neither (rent), so the card's height never changes
    const taxC = toCents(b.tax);
    const tipC = b.items.some((i) => i.itemType === 'Tip') ? 0 : toCents(b.tip);
    const discC = Math.round((b.discountAmount || 0) * 100);
    const extraLabel = [taxC && 'Tax', tipC && 'tip'].filter(Boolean).join(' and ').replace(/^tip/, 'Tip');
    sums.innerHTML = `<div class="sum-x${taxC || tipC ? '' : ' is-nil'}"><span>${extraLabel || 'Tax'}</span><span class="money">${money(taxC + tipC)}</span></div>`
      + (discC ? `<div class="sum-x"><span>Discount</span><span class="money">${money(-discC)}</span></div>` : '')
      + `<div class="tot"><span>Total</span><span class="money">${money(toCents(b.total))}</span></div>`;
    sums.classList.remove('is-off');
    // the button says where it goes (the landing: down to the story for its own receipt, another page for the rest)
    if (typeof splitLabel === 'function') splitBtn.textContent = splitLabel(model);
    showCta(!!onSplit);
    bar.style.width = '100%';
    onResult?.(model);
    if (result.notice) setStatus(result.notice, 'note');
    else setStatus(ok ? 'Adds up to the total.' : 'Check the total before saving.', 'done');
  }

  $$('.scan-picker button[data-id]', root).forEach((b) => b.addEventListener('click', () => run(b.dataset.id)));
  // the privacy line comes before the picker: the first tap shows it inside the card, with "Choose photo";
  // once agreed, later taps open the picker directly
  let pendingDrop = null;
  const ask = (f = null) => {
    pendingDrop = f;
    consent.hidden = false;
    root.classList.add('is-asking');
    press('file');
    $('[data-v="ok"]', consent).focus({ preventScroll: true });
    // phones: the card sits under the receipt window, so bring the question to the thumb
    if (compact()) consent.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  };
  consent.addEventListener('click', (e) => {
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (!v) return;
    consent.hidden = true;
    root.classList.remove('is-asking');
    const f = pendingDrop; pendingDrop = null;
    if (v !== 'ok') { if (current) press(current.id); return; }
    agreed = true;
    if (f) run(f); else fileIn.click();
  });
  $('.file-pick', root).addEventListener('click', () => { if (agreed) fileIn.click(); else ask(); });
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) run(f); fileIn.value = ''; });
  viewer.addEventListener('dragover', (e) => { e.preventDefault(); });
  viewer.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (agreed) run(f); else ask(f);
  });
  $('.split-btn', root).addEventListener('click', () => current && onSplit?.(current));

  // watch the stage, not the root: the landing lays the root out with display: contents (no box to observe)
  // phones start a little before the stage is in view, so a visitor scrolling at normal speed meets the end of the read
  if (autoStart) onceVisible($('.scan-stage', root), () => run('green-basket'), compact() ? { threshold: 0, rootMargin: '0px 0px 120px 0px' } : { threshold: 0.1 });
  return { run, get model() { return current; } };
}

/* A sample replays the kit's recorded scan, faster than the kit's 2.5 s default: about 1.3 s from tap to total, so a
 * visitor scrolling at normal speed meets the finished read, not a half-read card. Same stages, same data. */
const nap = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});
async function quick(id, { onStage, instant, signal }) {
  const raw = await loadScan(id);
  const bill = normalizeScan(raw);
  const fast = instant || reduced();
  const emit = (stage, detail = {}) => onStage?.(stage, { sampleId: id, ...detail });
  emit('uploading', { progress: 1 });
  if (!fast) await nap(150, signal);
  emit('reading', { items: [] });
  if (!fast) {
    const step = 900 / Math.max(1, bill.items.length);
    for (let i = 1; i <= bill.items.length; i += 1) { await nap(step, signal); emit('reading', { items: bill.items.slice(0, i) }); }
  } else emit('reading', { items: bill.items });
  emit('checking', {});
  if (!fast) await nap(250, signal);
  return { source: 'sample', sampleId: id, raw, bill };
}

// keeps the totals block (tax row + Total) at its final height while it is hidden
const SUMS_PLACEHOLDER = '<div class="sum-x"><span>Tax</span><span class="money">$0.00</span></div><div class="tot"><span>Total</span><span class="money">$0.00</span></div>';

function titleCaseStore(t) {
  return String(t || '').toLowerCase().replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}
const prettyFromRaw = (n) => prettyName(n);
