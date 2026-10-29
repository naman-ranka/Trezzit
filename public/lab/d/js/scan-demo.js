// "Scan this receipt": the kit's recorded scans (and a real scan on trezzit.com).
import { scan } from '../../_kit/scan-client.js';
import { renderReceipt } from '../../_kit/receipts.js';
import { toCents } from '../../_kit/split-engine.js';
import { $, $$, esc, money, icon, reducedMotion, onVisible, announce } from './ui.js';
import { itemName, getWorld, getSample, loadScan } from './world.js';

const CHECKS = ['items_total_check', 'grand_total_check', 'tax_distribution_check'];
const NEXT = {
  'green-basket': ['Split it', '#split', 'green-basket'],
  'taqueria-sol': ['Split it', '#split', 'taqueria-sol'],
  'corner-pharmacy': ['See it in October', '#october'],
  'monthly-rent': ['See it in October', '#october'],
};
const STEP_INDEX = { uploading: 0, reading: 1, checking: 2, done: 3 };
const SHOW = () => (matchMedia('(min-width: 760px)').matches ? 8 : 4);

export function initScan(onSplitRequest) {
  const root = document.getElementById('scan');
  if (!root) return;
  const paper = $('[data-paper]', root);
  const R = {
    title: $('[data-r-title]', root), sub: $('[data-r-sub]', root), status: $('[data-r-status]', root),
    steps: $$('[data-r-steps] li', root), items: $('[data-r-items]', root), sums: $('[data-r-sums]', root),
    foot: $('[data-r-foot]', root),
  };
  const picker = $$('[data-sample]', root);
  let ctrl = null; let photoUrl = null; let expanded = false;

  const setStatus = (text, ok) => {
    R.status.className = 'status' + (ok ? ' ok' : '');
    R.status.innerHTML = (ok ? icon('check') : '') + esc(text);
  };
  const setStep = (stage) => {
    const k = STEP_INDEX[stage];
    R.steps.forEach((li, i) => { li.className = i < k || stage === 'done' ? 'done' : i === k ? 'on' : ''; });
  };

  function showPaper(raw, sampleId) {
    paper.innerHTML = '';
    if (photoUrl && !sampleId) {
      paper.innerHTML = `<img class="user-photo" src="${photoUrl}" alt="">`;
    } else {
      paper.appendChild(renderReceipt(raw, { sample: getSample(sampleId) }));
    }
    const beam = document.createElement('div'); beam.className = 'beam'; paper.appendChild(beam);
    requestAnimationFrame(() => paper.style.setProperty('--sweep', Math.max(200, Math.min(paper.scrollHeight, paper.clientHeight) - 60) + 'px'));
  }

  // Rows already on screen keep still; only new rows animate in (no strobe while reading).
  let seen = 0; let lastItems = null;
  R.items.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-more]')) return;
    // Before any scan has run, the static rows are the grocery receipt.
    const items = lastItems || (await getWorld()).scans['green-basket'].bill.items;
    if (!lastItems) seen = R.items.querySelectorAll('li:not(.more)').length;
    expanded = true; renderItems(items);
  });
  const skel = (n, cls = '') => Array.from({ length: Math.max(0, n) }, () => `<li class="sk${cls}" aria-hidden="true"><i></i><i></i></li>`).join('');
  function renderItems(items, reading = false) {
    const list = expanded ? items : items.slice(0, SHOW());
    const was = seen; seen = list.length;
    // While reading, the rows still to come are placeholders, so the card is never an empty box.
    const pad = reading ? skel(SHOW() - list.length) : '';
    R.items.innerHTML = list.map((it, i) => `<li${i < was ? ' class="seen"' : ` style="animation-delay:${Math.min(i - was, 3) * 20}ms"`}><span class="n">${esc(itemName(it.name))}</span>${Number(it.quantity) > 1 && Number.isInteger(Number(it.quantity)) ? `<span class="q">×${Number(it.quantity)}</span>` : ''}<span class="a money">${money(toCents(it.amount))}</span></li>`).join('')
      + pad + (items.length > list.length && !reading ? `<li class="more seen"><button type="button" class="link-arrow" data-more>+ ${items.length - list.length} more item${items.length - list.length === 1 ? '' : 's'}</button></li>` : '');
    lastItems = items;
  }

  // Hold the panel at its tallest size so a new scan never pushes the page around.
  const panel = $('[data-result]', root);
  // Desktop: the fixed-height receipt sets the row, so the panel can size to its content.
  const hold = () => { if (matchMedia('(min-width: 760px)').matches) { panel.style.minHeight = ''; return; } panel.style.minHeight = Math.max(panel.offsetHeight, parseFloat(panel.style.minHeight) || 0) + 'px'; };

  function reset(label) {
    hold();
    expanded = false; seen = 0;
    R.title.textContent = label;
    R.sub.textContent = 'Reading…';
    setStatus('Reading', false);
    panel.classList.remove('is-done');
    R.items.innerHTML = skel(SHOW()); R.sums.innerHTML = '<div class="sk" aria-hidden="true"><i></i><i></i></div>'.repeat(3); R.foot.innerHTML = '';
  }

  function finish(result) {
    const { bill, raw, sampleId, notice } = result;
    const r = raw.receipt || {};
    paper.classList.remove('is-scanning');
    $$('.tz-r-line', paper).forEach((l) => l.classList.add('is-read'));
    R.title.textContent = bill.merchant || 'Your receipt';
    const d = bill.date ? new Date(bill.date + 'T12:00:00') : null;
    R.sub.textContent = [d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null, `${bill.items.length} items`].filter(Boolean).join(' · ');
    renderItems(bill.items);
    const tip = toCents(bill.tip);
    R.sums.innerHTML = `<div><span>Subtotal</span><span class="money">${money(toCents(bill.subtotal))}</span></div>`
      + (toCents(bill.tax) ? `<div><span>Tax</span><span class="money">${money(toCents(bill.tax))}</span></div>` : '')
      + (tip ? `<div><span>Tip</span><span class="money">${money(tip)}</span></div>` : '')
      + `<div class="tot"><span>Total</span><span class="money">${money(toCents(bill.total))}</span></div>`;
    const checks = (raw.backend_validations || r.backend_validations || []).filter((c) => c.passed && CHECKS.includes(c.check));
    setStatus(checks.length ? 'Checked' : 'Read', true);
    setStep('done');
    panel.classList.add('is-done');
    const next = NEXT[sampleId];
    R.foot.innerHTML = (notice ? `<p class="notice">${esc(notice)}</p>` : '')
      + (next ? `<a class="link-arrow" href="${next[1]}" data-next>${next[0]} ${icon('down')}</a>` : '<a class="link-arrow" href="https://app.trezzit.com/signup">Save it in Trezzit ' + icon('arrow') + '</a>');
    const a = $('[data-next]', R.foot);
    if (a && next[2]) a.addEventListener('click', () => onSplitRequest?.(next[2]));
    announce(`${R.title.textContent}: ${bill.items.length} items, total ${money(toCents(bill.total))}.`);
  }

  async function run(input, label) {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    reset(label);
    const isSample = typeof input === 'string';
    if (isSample) showPaper(await loadScan(input), input);
    else showPaper(null, null);
    paper.classList.add('is-scanning');
    paper.classList.toggle('is-live', !isSample);
    let shown = 0;
    try {
      const result = await scan(input, {
        signal,
        onStage(stage, detail) {
          if (signal.aborted) return;
          setStep(stage);
          if (stage === 'uploading') setStatus('Uploading', false);
          if (stage === 'reading') {
            setStatus('Reading', false);
            const items = detail.items || [];
            if (!isSample && !items.length) R.sub.textContent = 'Reading… this can take up to a minute';
            if (items.length > shown) {
              shown = items.length;
              renderItems(items, true);
              const lines = $$('.tz-r-line', paper);
              lines.forEach((l, i) => l.classList.toggle('is-read', i < shown));
            }
          }
          if (stage === 'checking') setStatus('Checking', false);
        },
      });
      if (signal.aborted) return;
      if (!isSample && result.source === 'sample') { photoUrl = null; showPaper(result.raw, result.sampleId); }
      finish(result);
    } catch (e) {
      if (e?.name === 'AbortError' || signal.aborted) return;
      setStatus('Try again', false);
      R.foot.innerHTML = '<p class="notice">That didn’t work. Try one of the sample receipts.</p>';
      paper.classList.remove('is-scanning');
    }
  }

  const pick = (id) => {
    picker.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sample === id)));
    photoUrl = null;
    run(id, getSample(id).title);
  };
  picker.forEach((b) => b.addEventListener('click', () => pick(b.dataset.sample)));

  // First run: the canonical grocery receipt, when the stage comes into view.
  // The finished result is already on the page; the replay keeps every row in place.
  // It starts just before the stage scrolls into view, so nobody sees a finished result reset to "Reading".
  const stage = $('.stage', root);
  const start = () => pick('green-basket');
  if (!reducedMotion()) onVisible(stage, start, 0, '0px 0px 160px 0px');
}
