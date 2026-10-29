/* scan-demo.js: tap a sample receipt (recorded scan) or use your own photo
 * (live on trezzit.com only, via the kit's scan-client) and watch it read. */
import { scan, isLive } from '../../_kit/scan-client.js';
import { receiptHTML, ensureReceiptStyles } from '../../_kit/receipts.js';
import { toCents } from '../../_kit/split-engine.js';
import { SAMPLE_META, getSample, sampleBill } from './data.js';
import { h, esc, money, reduced, onVisible, itemName, storeName, prettyDate, icon, bus } from './util.js';

const STAGE_LABEL = { idle: 'Ready', uploading: 'Uploading', reading: 'Reading items', checking: 'Checking the math', done: 'Done' };
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
  return [bad ? { passed: false, message: `${CHECK_LABEL[bad.check] || 'Total'} doesn’t match the receipt` } : { passed: true, message: 'Adds up to the receipt total' }];
};
const checkLI = (c, i, pending) => `<li class="${c.passed ? 'ok' : 'warn'}${pending ? ' pending' : ''}" style="--i:${i}">${icon.check}<span>${esc(CHECK_LABEL[c.check] || c.message)}</span></li>`;

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
        <p class="so-sum"></p>
        <ul class="so-checks" aria-label="Checked against the receipt"></ul>
        <div class="so-foot">
          <p class="so-total"><span>Total</span><b class="money"></b></p>
          ${opts.splitTarget ? `<button type="button" class="c-btn c-btn-sm c-btn-primary so-split">Split this receipt ${icon.arrow}</button>` : ''}
          ${opts.soloHref ? `<a class="c-btn c-btn-sm c-btn-quiet so-split so-solo" href="${esc(opts.soloHref)}" hidden>See it sorted ${icon.arrow}</a>` : ''}
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
  const sumEl = root.querySelector('.so-sum');
  // the receipt-level amounts between the items and the total, so "adds up" is visibly true
  const setSum = (bill) => {
    const cur = bill?.currency || 'USD';
    const parts = [['Subtotal', bill?.subtotal], ['Tax', bill?.tax], ['Tip', bill?.tip]]
      .filter(([, v]) => v != null && toCents(v) > 0)
      .map(([k, v]) => `${k} <span class="money">${money(toCents(v), cur)}</span>`);
    sumEl.innerHTML = parts.join(' <span aria-hidden="true">·</span> ');
  };
  const splitBtn = root.querySelector('button.so-split');
  const soloLink = root.querySelector('.so-solo');
  // a receipt that is just yours has nothing to split: offer where it lands instead
  const setSolo = (id) => {
    if (!soloLink || !splitBtn) return;
    const solo = !!id && getSample(id)?.people?.length === 1;
    soloLink.hidden = !solo;
    splitBtn.hidden = solo;
  };
  const notice = root.querySelector('.so-notice');
  const moreBtn = root.querySelector('.so-more');
  const syncMore = () => {
    const n = list.children.length;
    moreBtn.hidden = n <= (matchMedia('(max-width: 719px)').matches ? 4 : 6);
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
    sumEl.innerHTML = '';
    storeEl.innerHTML = store || '';
    notice.hidden = true;
    root.classList.remove('is-done');
    root.classList.add('short');
    moreBtn.hidden = true;
  }

  const itemLI = (it, i, pending) => `<li class="so-item${pending ? ' pending' : ''}" style="--i:${i}"><span>${esc(itemName(it.name))}${Number(it.quantity) > 1 && Number.isInteger(+it.quantity) ? ` <small>×${+it.quantity}</small>` : ''}</span><span class="money">${money(toCents(it.amount))}</span></li>`;
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
    totalEl.textContent = money(toCents(bill.total), bill.currency || 'USD');
    setSum(bill);
    syncMore();
  }

  async function run(input, { instant = false } = {}) {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const isFile = typeof input !== 'string';
    if (!isFile) {
      press(input);
      setSolo(input);
      const { raw, bill } = await sampleBill(input);
      showPaper(receiptHTML(raw, { sample: getSample(input), shadow: false }));
      reset(storeLine(raw.receipt));
      layout(bill);
      opts.onStart?.(input);
    } else {
      press(null);
      setSolo(null);
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
            if (checks.querySelector('.pending')) checks.querySelectorAll('.pending').forEach((li) => li.classList.remove('pending'));
            else {
              const bill = { backendValidations: detail.validations || [], tax: detail.tax ?? 1 };
              checks.innerHTML = checksFor(bill).map((c, i) => checkLI(c, i, false)).join('');
            }
          }
        },
      });
      if (signal.aborted) return;
      last = result;
      if (result.source === 'sample' && isFile) {
        // fell back: show the sample we played
        press(result.sampleId);
        setSolo(result.sampleId);
        showPaper(receiptHTML(result.raw, { sample: getSample(result.sampleId), shadow: false }));
        settlePaper();
        storeEl.innerHTML = storeLine(result.raw.receipt);
      }
      if (result.source === 'live') storeEl.innerHTML = storeLine(result.raw.receipt);
      totalEl.textContent = money(toCents(result.bill.total), result.bill.currency || 'USD');
      setSum(result.bill);
      if (result.notice) { notice.textContent = result.notice; notice.hidden = false; }
      if (isFile) {
        const v = checksFor(result.bill);
        checks.innerHTML = v.map((c, i) => checkLI(c, i, false)).join('');
      }
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
  sampleBill(first).then(({ raw, bill }) => {
    if (root.dataset.stage) return;
    press(first);
    showPaper(receiptHTML(raw, { sample: getSample(first), shadow: false }));
    reset(storeLine(raw.receipt));
    layout(bill);
    setStage('idle');
    statusEl.querySelector('.txt').textContent = 'Tap a receipt to scan it';
    if (opts.autoplay !== false) onVisible(root, () => { if (root.dataset.stage === 'idle') run(first); }, { threshold: 0.45 });
  });

  return { run, get last() { return last; } };
}
let uid = 0;
