/* just-me page: scan a receipt, watch your share sort into categories; then the month. */
import { initPage } from './page.js';
import { mountScan } from './scan-demo.js';
import { mountLedger } from './ledger-demo.js';
import { splitSample } from '../../_kit/receipts.js';
import { CATEGORIES, getSample, SAMPLE_META } from './data.js';
import { money, itemName, esc, reduced } from './util.js';

initPage();
const cats = document.getElementById('cat-demo');

function donut(parts, total) {
  const R = 52; const C = 2 * Math.PI * R; let off = 0;
  const segs = parts.map(([k, c]) => {
    const len = (c / total) * C;
    const s = `<circle r="${R}" cx="64" cy="64" fill="none" stroke="${(CATEGORIES[k] || CATEGORIES.other).color}" stroke-width="18" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" />`;
    off += len; return s;
  });
  return `<svg class="donut" viewBox="0 0 128 128" width="148" height="148" aria-hidden="true"><g transform="rotate(-90 64 64)">${segs.join('')}</g></svg>`;
}

function renderCats(result) {
  if (!result) { cats.innerHTML = ''; return; }
  if (result.source !== 'sample') {
    cats.innerHTML = '<p class="cats-note">In the app, each item you scan gets its own category.</p>';
    return;
  }
  const s = getSample(result.sampleId);
  const r = splitSample(s, result.bill);
  const you = r.people.you;
  const parts = Object.entries(you.byCategory).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  const shared = s.people.length > 1;
  const groups = parts.map(([k, c]) => {
    const lines = you.lines.filter((l) => (l.category || (r.items.find((x) => x.index === l.itemIndex)?.itemType === 'Tip' ? s.tipCategory : 'other')) === k && l.cents);
    return `<li class="cat-g" style="--c:${(CATEGORIES[k] || CATEGORIES.other).color}">
      <p class="cat-h"><i></i><b>${(CATEGORIES[k] || CATEGORIES.other).label}</b><b class="money">${money(c)}</b></p>
      <p class="cat-items">${lines.map((l) => esc(l.name === 'Tip' ? 'Tip' : itemName(l.name))).join(', ')}</p></li>`;
  }).join('');
  cats.innerHTML = `<div class="cats-in${reduced() ? '' : ' enter'}">
    <div class="cats-chart">${donut(parts, you.cents)}<p><small>${shared ? 'Your share' : 'You spent'}</small><b class="money">${money(you.cents)}</b>${shared ? `<small class="money">of ${money(r.totalCents)}</small>` : ''}</p></div>
    <div><p class="cats-t">${esc(SAMPLE_META[result.sampleId].label)}, sorted${shared ? ' (your share only)' : ''}</p><ul class="cat-list" role="list">${groups}</ul></div>
  </div>`;
}

mountScan(document.getElementById('scan-demo'), {
  samples: ['corner-pharmacy', 'green-basket', 'taqueria-sol'],
  initial: 'corner-pharmacy',
  onDone: renderCats,
});
mountLedger(document.getElementById('ledger-demo'));
