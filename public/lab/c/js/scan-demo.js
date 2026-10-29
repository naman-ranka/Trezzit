/* scan-demo.js: tap a sample receipt (recorded scan) or use your own photo
 * (live on trezzit.com only, via the kit's scan-client) and watch it read. */
import { scan, isLive } from '../../_kit/scan-client.js';
import { receiptHTML, ensureReceiptStyles } from '../../_kit/receipts.js';
import { toCents } from '../../_kit/split-engine.js';
import { SAMPLE_META, getSample, sampleBill } from './data.js';
import { h, esc, money, reduced, onVisible, itemName, storeName, prettyDate, icon, bus } from './util.js';

const STAGE_LABEL = { idle: 'Ready', uploading: 'Uploading', reading: 'Reading items', checking: 'Checking the math', done: 'Done' };
const CHECK_LABEL = {
  items_total_check: 'Items add up to the subtotal',
  grand_total_check: 'Total matches the receipt',
  tax_distribution_check: 'Tax is matched to the taxed items',
};

/**
 * mountScan(root, { samples, initial, autoplay, splitTarget, compact })
 *  samples: sample ids for the picker; initial: first sample; autoplay: scan when visible;
 *  splitTarget: selector the "Split this receipt" button scrolls to (omit to hide it).
 */
export function mountScan(root, opts = {}) {
  ensureReceiptStyles();
  const ids = opts.samples || ['green-basket', 'taqueria-sol', 'corner-pharmacy', 'monthly-rent'];
  const base = new URL('../assets/', import.meta.url).href;
  root.classList.add('scan');
  root.innerHTML = `
    <div class="scan-pick" role="group" aria-label="Pick a receipt to scan">
      ${ids.map((id) => `<button type="button" class="pick" data-id="${id}" aria-pressed="false">
        <img src="${base}thumb-${id}.webp" alt="" width="36" height="52" loading="lazy" decoding="async">
        <span><b>${esc(SAMPLE_META[id].short)}</b><small>${esc(SAMPLE_META[id].kind)}</small></span></button>`).join('')}
      ${isLive() ? `<button type="button" class="pick pick-own" data-own aria-expanded="false">
        <span class="pick-ico">${icon.upload}</span><span><b>Your receipt</b><small>Photo or PDF</small></span></button>` : ''}
    </div>
    <div class="scan-body">
      <div class="scan-stage" aria-hidden="true">
        <div class="scan-paper"></div>
        <div class="scan-beam"></div>
        <div class="scan-fade"></div>
      </div>
      <div class="scan-out">
        <div class="so-head">
          <p class="so-status" aria-live="polite"><span class="dot"></span><span class="txt">Pick a receipt</span></p>
          <p class="so-store"></p>
        </div>
        <ol class="so-items" aria-label="Items read from the receipt"></ol>
        <button type="button" class="c-link-btn so-more" hidden></button>
        <ul class="so-checks" aria-label="Checks"></ul>
        <div class="so-foot">
          <p class="so-total"><span>Total</span><b class="money"></b></p>
          ${opts.splitTarget ? `<button type="button" class="c-btn c-btn-sm c-btn-primary so-split" hidden>Split this receipt ${icon.arrow}</button>` : ''}
        </div>
        <p class="so-notice" hidden></p>
      </div>
    </div>
    <div class="scan-consent" hidden role="dialog" aria-modal="false" aria-label="Scan your own receipt">
      <p>We read your photo to find the items. Nothing is saved to an account. <a href="https://trezzit.com/privacy">Privacy</a></p>
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
  const splitBtn = root.querySelector('.so-split');
  const notice = root.querySelector('.so-notice');
  const moreBtn = root.querySelector('.so-more');
  const syncMore = () => {
    const n = list.children.length;
    moreBtn.hidden = n <= 6;
    moreBtn.textContent = root.classList.contains('short') ? `Show all ${n} items` : 'Show fewer items';
  };
  root.classList.add('short');
  moreBtn.addEventListener('click', () => { root.classList.toggle('short'); syncMore(); });
  const consent = root.querySelector('.scan-consent');
  const ownBtn = root.querySelector('[data-own]');
  if (!ownBtn) root.classList.add('no-own');
  const fileInput = consent.querySelector('input[type=file]');
  let ctrl = null;
  let last = null;
  let objectUrl = null;

  const setStage = (s) => {
    root.dataset.stage = s;
    statusEl.querySelector('.txt').textContent = STAGE_LABEL[s] || s;
  };
  const press = (id) => root.querySelectorAll('.pick[data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));

  function showPaper(html) {
    paper.innerHTML = html;
    paper.style.transform = 'translateY(0)';
  }
  function follow(index) {
    const line = paper.querySelector(`.tz-r-line[data-index="${index}"]`);
    paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => l.classList.remove('is-active'));
    if (!line) return;
    line.classList.add('is-active');
    const max = Math.max(0, paper.scrollHeight - stage.clientHeight);
    const y = Math.min(max, Math.max(0, line.offsetTop - stage.clientHeight * 0.42));
    paper.style.transform = `translateY(${-y}px)`;
  }
  function settlePaper() {
    paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => l.classList.remove('is-active'));
    const max = Math.max(0, paper.scrollHeight - stage.clientHeight);
    const total = paper.querySelector('.tz-r-total');
    const y = total ? Math.min(max, Math.max(0, total.offsetTop - stage.clientHeight * 0.5)) : 0;
    paper.style.transform = `translateY(${-y}px)`;
  }

  function reset(store) {
    list.innerHTML = '';
    checks.innerHTML = '';
    totalEl.textContent = '';
    storeEl.innerHTML = store || '';
    notice.hidden = true;
    if (splitBtn) splitBtn.hidden = true;
    root.classList.remove('is-done');
    root.classList.add('short');
    moreBtn.hidden = true;
  }

  function addItem(it, i) {
    const li = h(`<li class="so-item" style="--i:${i}"><span>${esc(itemName(it.name))}${Number(it.quantity) > 1 && Number.isInteger(+it.quantity) ? ` <small>×${+it.quantity}</small>` : ''}</span><span class="money">${money(toCents(it.amount))}</span></li>`);
    list.appendChild(li);
  }

  async function run(input, { instant = false } = {}) {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const isFile = typeof input !== 'string';
    if (!isFile) {
      press(input);
      const { raw } = await sampleBill(input);
      showPaper(receiptHTML(raw, { sample: getSample(input), shadow: false }));
      reset(storeLine(raw.receipt));
    } else {
      press(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = input.type.startsWith('image/') ? URL.createObjectURL(input) : null;
      showPaper(objectUrl ? `<img class="scan-photo" src="${objectUrl}" alt="">` : '<div class="scan-pdf">PDF</div>');
      reset(`<b>${esc(input.name || 'Your receipt')}</b>`);
    }
    let shown = 0;
    try {
      const result = await scan(input, {
        signal,
        instant: instant || reduced(),
        onStage(stage, detail) {
          if (signal.aborted) return;
          setStage(stage);
          if (stage === 'reading' && detail.items) {
            for (; shown < detail.items.length; shown += 1) addItem(detail.items[shown], shown);
            if (shown) follow(shown - 1);
          }
          if (stage === 'checking') {
            settlePaper();
            const v = detail.validations || [];
            checks.innerHTML = v.map((c, i) => `<li class="${c.passed ? 'ok' : 'warn'}" style="--i:${i}">${icon.check}<span>${esc(CHECK_LABEL[c.check] || c.message)}</span></li>`).join('');
          }
        },
      });
      if (signal.aborted) return;
      last = result;
      if (result.source === 'sample' && isFile) {
        // fell back: show the sample we played
        press(result.sampleId);
        showPaper(receiptHTML(result.raw, { sample: getSample(result.sampleId), shadow: false }));
        settlePaper();
        storeEl.innerHTML = storeLine(result.raw.receipt);
      }
      if (result.source === 'live') storeEl.innerHTML = storeLine(result.raw.receipt);
      totalEl.textContent = money(toCents(result.bill.total), result.bill.currency || 'USD');
      if (result.notice) { notice.textContent = result.notice; notice.hidden = false; }
      if (splitBtn) splitBtn.hidden = false;
      root.classList.add('is-done');
      paper.querySelectorAll('.tz-r-line.is-active').forEach((l) => l.classList.remove('is-active'));
      paper.style.transform = 'translateY(0)';
      syncMore();
      setStage('done');
      opts.onDone?.(result);
    } catch (err) {
      if (err?.name !== 'AbortError') { setStage('idle'); notice.textContent = 'That did not work. Try a sample receipt.'; notice.hidden = false; }
    }
  }

  function storeLine(r) {
    const s = r?.storeInformation || {};
    const n = (r?.items || []).length;
    return `<b>${esc(storeName(s.title))}</b><span>${esc(prettyDate(s.dateTimeOfPurchase))}${n ? ` · ${n} items` : ''}</span>`;
  }

  root.querySelectorAll('.pick[data-id]').forEach((b) => b.addEventListener('click', () => { closeConsent(); run(b.dataset.id); }));
  const openConsent = () => { consent.hidden = false; ownBtn?.setAttribute('aria-expanded', 'true'); consent.querySelector('label').focus?.(); };
  const closeConsent = () => { consent.hidden = true; ownBtn?.setAttribute('aria-expanded', 'false'); };
  ownBtn?.addEventListener('click', () => (consent.hidden ? openConsent() : closeConsent()));
  consent.querySelector('.sc-cancel').addEventListener('click', () => { closeConsent(); ownBtn?.focus(); });
  consent.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeConsent(); ownBtn?.focus(); } });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    closeConsent();
    run(f);
    fileInput.value = '';
  });
  splitBtn?.addEventListener('click', () => {
    if (!last) return;
    bus.emit('receipt', last);
    const target = document.querySelector(opts.splitTarget);
    target?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  });

  // First state: the canonical receipt, read when it comes into view (instantly with reduced motion).
  const first = opts.initial || ids[0];
  sampleBill(first).then(({ raw }) => {
    if (root.dataset.stage) return;
    press(first);
    showPaper(receiptHTML(raw, { sample: getSample(first), shadow: false }));
    reset(storeLine(raw.receipt));
    setStage('idle');
    statusEl.querySelector('.txt').textContent = 'Tap a receipt to scan it';
    if (opts.autoplay !== false) onVisible(root, () => { if (root.dataset.stage === 'idle') run(first); }, { threshold: 0.45 });
  });

  return { run, get last() { return last; } };
}
let uid = 0;
