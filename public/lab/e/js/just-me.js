/* just-me page: scan a receipt, watch your share sort into categories; then the month. */
import { initPage } from './page.js';
import { mountScan } from './scan-demo.js';
import { mountMonth } from './month-demo.js';
import { splitSample } from '../../_kit/receipts.js';
import { CATEGORIES, getSample, SAMPLE_META, sampleBill } from './data.js';
import { money, itemName, esc, reduced } from './util.js';

initPage();
const cats = document.getElementById('cat-demo');

// a category split looks the same everywhere: one horizontal bar (as in the hero), then the list
function catBar(parts, total) {
  return `<div class="cat-bar" aria-hidden="true">${parts.map(([k, c]) => `<i style="--w:${c / total};--c:${(CATEGORIES[k] || CATEGORIES.other).color}"></i>`).join('')}</div>`;
}

function renderCats(result, pending = false) {
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
  cats.innerHTML = `<div class="cats-in${pending ? ' pending' : reduced() ? '' : ' enter'}">
    <div class="cats-chart"><p><small>${shared ? 'Your share' : 'You spent'}</small><b class="money">${money(you.cents)}</b>${shared ? `<small class="money">of ${money(r.totalCents)}</small>` : ''}</p></div>
    <div><p class="cats-t">By category${shared ? ' (your share only)' : ''}</p>${catBar(parts, you.cents)}<ul class="cat-list" role="list">${groups}</ul></div>
  </div>`;
}

// The sorted result is laid out (faint) before the scan runs, so the page never jumps when it lands.
sampleBill('corner-pharmacy').then(({ bill }) => { if (!cats.innerHTML) renderCats({ source: 'sample', sampleId: 'corner-pharmacy', bill }, true); });
mountScan(document.getElementById('scan-demo'), {
  samples: ['corner-pharmacy', 'green-basket'],
  initial: 'corner-pharmacy',
  cats: false, // the sorted result is drawn below, item by item
  onStart: () => cats.querySelector('.cats-in')?.classList.add('pending'),
  onDone: (r) => renderCats(r),
});
// the same month as home (bank vs what you spent, who paid, item search), searching for a pharmacy item
mountMonth(document.getElementById('ledger-demo'), { demoSearch: 'sunscreen' });
