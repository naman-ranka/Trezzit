/* scan-demo.js: tap a sample receipt (or use your own photo) and watch it read, line by line.
 * Samples replay the kit's recorded scans. A photo is scanned for real only on https://trezzit.com
 * (scan-client decides), after the AI disclosure; anywhere else it falls back to a sample, with a notice. */
import { scan, isLive, closestSample } from '../../_kit/scan-client.js';
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

export function mountScan(root, { onSplit, onResult, autoStart = true, splitLabel = 'Split this receipt' } = {}) {
  root.innerHTML = `
    <div class="seg-ctl scan-picker" role="group" aria-label="Choose a receipt">
      ${SAMPLES.map((s) => `<button type="button" data-id="${s.id}" aria-pressed="false">${SHORT[s.id].label}<span class="money">${money(toCents(s.total))}</span></button>`).join('')}
      <button type="button" class="file-pick" aria-pressed="false">${ICON.upload}Your photo</button>
      <input type="file" class="visually-hidden file-in" accept="image/*,application/pdf" tabindex="-1" aria-hidden="true">
    </div>
    <div class="scan-stage">
      <div class="viewer" aria-hidden="true">
        <span class="viewer-tag">The paper</span>
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
        <ul class="items" role="list"></ul>
        <div class="sums" hidden></div>
        <div class="result-cta" hidden><button type="button" class="btn btn-primary split-btn">${esc(splitLabel)}</button></div>
      </div>
    </div>
    <dialog class="consent">
      <form method="dialog">
        <h3>Scan your own receipt</h3>
        <p>To read it, your photo is sent to Google Gemini. Trezzit keeps scan photos for 90 days. Up to 10 scans an hour.</p>
        <p><a href="/privacy">Privacy</a> · <a href="/your-data">Your data</a></p>
        <div class="row"><button class="btn btn-quiet" value="cancel">Not now</button><button class="btn btn-primary" value="ok">Choose a photo</button></div>
      </form>
    </dialog>`;

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
  const fileIn = $('.file-in', root);
  const dialog = $('.consent', root);
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

  function place(index) {
    const line = paper.querySelector(`.tz-r-line[data-index="${index}"]`);
    if (!line) return;
    line.classList.add('is-read');
    const vh = viewer.clientHeight;
    const ph = paper.scrollHeight;
    const top = line.offsetTop + paper.querySelector('.tz-receipt').offsetTop;
    follow = Math.max(0, Math.min(top - vh * 0.45, ph - vh + 24));
    paper.style.transform = `translateY(${-follow}px)`;
    beam.style.transform = `translateY(${top + line.offsetHeight - 58 - follow + 28}px)`;
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

  async function run(input, { notice } = {}) {
    if (typeof input !== 'string' && !isLive()) {
      // Off trezzit.com the API refuses this origin: say so up front and play the closest sample.
      return run(closestSample(input), { notice: 'Live scanning runs on trezzit.com, so here is a sample receipt instead.' });
    }
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const isFile = typeof input !== 'string';
    press(isFile ? 'file' : input);
    list.innerHTML = '';
    sums.hidden = true; cta.hidden = true;
    bar.style.width = '4%';
    viewer.classList.remove('is-scanning');
    paper.style.transform = ''; follow = 0;
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }

    let sample = null;
    let total = 0;
    if (isFile) {
      photoUrl = URL.createObjectURL(input);
      paper.innerHTML = input.type.startsWith('image/') ? `<img class="viewer-photo" src="${photoUrl}" alt="">` : '';
      header(null, null);
      title.textContent = input.name || 'Your photo';
      meta.textContent = isLive() ? 'Scanning for real' : 'Live scanning runs on trezzit.com';
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
      const result = await scan(input, {
        signal,
        onStage(stage, detail) {
          if (signal.aborted) return;
          if (stage === 'uploading') { setStatus('Uploading the photo'); bar.style.width = '12%'; }
          if (stage === 'reading') {
            const items = detail.items || [];
            if (!items.length) { setStatus('Reading the receipt'); bar.style.width = '18%'; return; }
            for (; shown < items.length; shown += 1) {
              list.appendChild(itemRow(items[shown], shown, sample));
              if (sample) place(shown);
            }
            list.scrollTop = list.scrollHeight;
            const n = total || items.length;
            setStatus(`Reading items: ${items.length} of ${n}`);
            bar.style.width = `${18 + 70 * (items.length / n)}%`;
          }
          if (stage === 'checking') { setStatus('Checking the totals'); bar.style.width = '94%'; }
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
    $$('.tz-r-line', paper).forEach((l) => l.classList.add('is-read'));
    paper.style.transform = ''; list.scrollTop = 0;
    header(model, result.sampleId);
    const b = result.bill;
    const lineSum = b.items.reduce((a, it) => a + toCents(it.amount), 0) + toCents(b.tax) + (b.items.some((i) => i.itemType === 'Tip') ? 0 : toCents(b.tip)) - Math.round((b.discountAmount || 0) * 100);
    const ok = lineSum === toCents(b.total);
    sums.innerHTML = `
      <div><span>Subtotal</span><span class="money">${money(toCents(b.subtotal))}</span></div>
      ${toCents(b.tax) ? `<div><span>Tax</span><span class="money">${money(toCents(b.tax))}</span></div>` : ''}
      ${toCents(b.tip) ? `<div><span>Tip</span><span class="money">${money(toCents(b.tip))}</span></div>` : ''}
      <div class="tot"><span>Total</span><span class="money">${money(toCents(b.total))}</span></div>`;
    sums.hidden = false;
    cta.hidden = !onSplit;
    bar.style.width = '100%';
    onResult?.(model);
    if (result.notice) setStatus(result.notice, 'note');
    else setStatus(ok ? `Adds up to ${money(toCents(b.total))}.` : 'Check the total before saving.', 'done');
  }

  $$('.scan-picker button[data-id]', root).forEach((b) => b.addEventListener('click', () => run(b.dataset.id)));
  $('.file-pick', root).addEventListener('click', () => {
    if (isLive() && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else fileIn.click();
  });
  let pendingDrop = null;
  dialog.addEventListener('close', () => {
    const f = pendingDrop; pendingDrop = null;
    if (dialog.returnValue !== 'ok') return;
    if (f) run(f); else fileIn.click();
  });
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) run(f); fileIn.value = ''; });
  viewer.addEventListener('dragover', (e) => { e.preventDefault(); });
  viewer.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (isLive() && typeof dialog.showModal === 'function') { pendingDrop = f; dialog.showModal(); } else run(f);
  });
  $('.split-btn', root).addEventListener('click', () => current && onSplit?.(current));

  if (autoStart) onceVisible(root, () => run('green-basket'), { threshold: 0.3 });
  return { run, get model() { return current; } };
}

function titleCaseStore(t) {
  return String(t || '').toLowerCase().replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}
const prettyFromRaw = (n) => prettyName(n);
