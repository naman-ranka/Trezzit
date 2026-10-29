/**
 * split-editor.js: the playable itemized split.
 * Tap a face on a line to take that person off it (or put them back); every
 * total re-splits through the kit's engine, to the cent.
 */

import { PEOPLE, CATEGORIES, summarise } from './data.js';
import { money, esc, avatar, tweenMoney, ICON, listNames } from './util.js';

export const shareText = (shares, order) => {
  const ids = order.filter((id) => shares[id] !== undefined && shares[id] !== 0);
  if (ids.length === 0) return '';
  if (ids.length === 1) return ids[0] === 'you' ? 'Just you' : `Just ${PEOPLE[ids[0]].name}`;
  const vals = ids.map((id) => shares[id]);
  if (vals.every((v) => v === vals[0])) return `${money(vals[0])} each`;
  return vals.map(money).join(' · ');
};

export const splitPeople = (split, order) => {
  if (!split || split.type === 'equal') return split?.people || order;
  const map = split.shares || split.percents || split.amounts || {};
  return order.filter((id) => Object.prototype.hasOwnProperty.call(map, id));
};

export function createSplitEditor(root, { compact = false, onChange, label = 'Split' } = {}) {
  let sc = null;
  let items = [];
  let order = [];
  let last = null;

  root.classList.add('se');
  if (compact) root.classList.add('se--compact');

  function bill() {
    return { ...sc.bill, items: items.map((it) => ({ ...it })) };
  }

  function render() {
    order = sc.people;
    const multi = order.length > 1;
    const sum = summarise(sc, bill());
    const res = sum.result;
    const cat = (c) => CATEGORIES[c] || CATEGORIES.other;
    const rows = res.items.map((it, k) => {
      const extra = it.isExtraCharge || it.itemType === 'Tip' || it.itemType === 'Fee' || it.itemType === 'Discount';
      const src = extra ? null : items[it.index];
      const who = src ? splitPeople(src.split, order) : [];
      const c = cat(it.category);
      const tax = !extra && it.taxCents ? `<span class="se-tax">incl. ${money(it.taxCents)} tax</span>` : '';
      const whoHTML = multi && !extra
        ? `<div class="se-who" role="group" aria-label="Who shares ${esc(it.name)}">${order.map((id) => avatar(PEOPLE[id], { pressed: who.includes(id), label: `${PEOPLE[id].name} on ${it.name}` })).join('')}</div>`
        : (extra ? '<span class="se-prop">In proportion to each share</span>' : `<span class="se-cat"><span class="dot" style="--c:${c.color}"></span>${esc(c.label)}</span>`);
      return `<li class="se-item${extra ? ' is-extra' : ''}" data-i="${extra ? '' : it.index}" style="--cat:${extra ? '#94a3b8' : c.color}">
        <div class="se-line"><span class="dot" style="--c:${extra ? '#94a3b8' : c.color}" title="${esc(c.label)}"></span><span class="se-name">${esc(it.name)}${tax}</span><span class="se-price money">${money(it.totalCents)}</span></div>
        <div class="se-sub">${whoHTML}<span class="se-each money">${multi ? esc(shareText(it.shares, order)) : ''}</span></div>
      </li>`;
    }).join('');

    const people = order.map((id) => {
      const p = PEOPLE[id];
      const cents = res.people[id]?.cents || 0;
      const isPayer = sc.payer === id;
      const payerName = PEOPLE[sc.payer]?.name || '';
      const sub = isPayer ? `Paid ${money(res.totalCents)}` : (sc.payer === 'you' ? 'Owes you' : (id === 'you' ? `You owe ${payerName}` : `Owes ${payerName}`));
      return `<li class="se-person${id === 'you' ? ' is-you' : ''}" data-id="${id}">
        ${avatar(p)}
        <span class="se-pname">${id === 'you' ? 'You' : esc(p.name)}<small>${esc(sub)}</small></span>
        <span class="se-pamt money" data-cents="${cents}">${money(cents)}</span>
        <span class="se-bar" aria-hidden="true"><i style="width:${res.totalCents ? (cents / res.totalCents) * 100 : 0}%;--c:${p.color}"></i></span>
      </li>`;
    }).join('');

    root.innerHTML = `
      <ol class="se-items${res.items.length > 8 ? ' is-clipped' : ''}" role="list">${rows}</ol>
      ${res.items.length > 8 ? `<button type="button" class="btn btn-quiet btn-sm se-more" data-more>Show all ${res.items.length} lines</button>` : ''}
      <div class="se-side">
        <ul class="se-people" role="list">${people}</ul>
        <div class="se-yours">
          <p class="se-ytitle">Your ${money(sum.mine)}, by category</p>
          <div class="catbar" aria-hidden="true">${catBar(sum.byCategory)}</div>
          <ul class="cats" role="list">${catList(sum.byCategory)}</ul>
        </div>
        <p class="se-check">${ICON.check}<span>Adds up to <b class="money">${money(res.totalCents)}</b>, to the cent.</span></p>
        <p class="visually-hidden" aria-live="polite" data-live></p>
      </div>`;
    last = sum;
  }

  function update(changedIndex) {
    const sum = summarise(sc, bill());
    const res = sum.result;
    res.items.forEach((it) => {
      const extra = it.isExtraCharge || it.itemType === 'Tip' || it.itemType === 'Fee' || it.itemType === 'Discount';
      const li = extra ? root.querySelectorAll('.se-item.is-extra')[0] : root.querySelector(`.se-item[data-i="${it.index}"]`);
      if (!li) return;
      const each = li.querySelector('.se-each');
      const txt = order.length > 1 ? shareText(it.shares, order) : '';
      if (each.textContent !== txt) {
        each.textContent = txt;
        each.classList.remove('flash'); void each.offsetWidth; each.classList.add('flash');
      }
      if (!extra) {
        const who = splitPeople(items[it.index].split, order);
        li.querySelectorAll('.av').forEach((b) => b.setAttribute('aria-pressed', String(who.includes(b.dataset.id))));
      }
    });
    root.querySelectorAll('.se-item.is-extra').forEach((li, k) => {
      const ex = res.items.filter((it) => it.isExtraCharge || it.itemType === 'Tip' || it.itemType === 'Fee' || it.itemType === 'Discount')[k];
      if (ex) li.querySelector('.se-each').textContent = shareText(ex.shares, order);
    });
    order.forEach((id) => {
      const li = root.querySelector(`.se-person[data-id="${id}"]`);
      const cents = res.people[id]?.cents || 0;
      tweenMoney(li.querySelector('.se-pamt'), cents);
      li.querySelector('.se-bar i').style.width = `${res.totalCents ? (cents / res.totalCents) * 100 : 0}%`;
    });
    root.querySelector('.se-ytitle').textContent = `Your ${money(sum.mine)}, by category`;
    root.querySelector('.catbar').innerHTML = catBar(sum.byCategory);
    root.querySelector('.cats').innerHTML = catList(sum.byCategory);
    root.querySelector('.se-check b').textContent = money(res.totalCents);
    const live = root.querySelector('[data-live]');
    live.textContent = order.map((id) => `${PEOPLE[id].name} ${money(res.people[id]?.cents || 0)}`).join(', ');
    last = sum;
    onChange?.(sum, changedIndex);
  }

  root.addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) { root.querySelector('.se-items').classList.remove('is-clipped'); more.remove(); return; }
    const b = e.target.closest('.se-who .av');
    if (!b) return;
    const li = b.closest('.se-item');
    const i = Number(li.dataset.i);
    const it = items[i];
    const id = b.dataset.id;
    const who = splitPeople(it.split, order);
    const next = who.includes(id) ? who.filter((x) => x !== id) : order.filter((x) => x === id || who.includes(x));
    if (next.length === 0) {
      const live = root.querySelector('[data-live]');
      live.textContent = 'Someone has to have it. Add another person first.';
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      return;
    }
    it.split = { type: 'equal', people: next };
    update(i);
  });

  return {
    load(scenario) {
      sc = scenario;
      items = scenario.bill.items.map((it) => ({ ...it, split: it.split ? JSON.parse(JSON.stringify(it.split)) : { type: 'equal', people: scenario.people } }));
      render();
      onChange?.(last, null);
    },
    reset() { if (sc) this.load(sc); },
    get summary() { return last; },
    get scenario() { return sc; },
    label,
  };
}

export function catBar(byCat) {
  const total = Object.values(byCat).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  return Object.entries(byCat).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<i style="flex-grow:${Math.max(0, v) / total};--c:${(CATEGORIES[k] || CATEGORIES.other).color}"></i>`).join('');
}

export function catList(byCat, { limit = 8 } = {}) {
  return Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([k, v]) => {
      const c = CATEGORIES[k] || CATEGORIES.other;
      return `<li><span class="dot" style="--c:${c.color}"></span><span>${esc(c.label)}</span><span class="money">${money(v)}</span></li>`;
    }).join('');
}

export { listNames };
export const isExtra = (it) => it.isExtraCharge || it.itemType === 'Tip' || it.itemType === 'Fee' || it.itemType === 'Discount';
