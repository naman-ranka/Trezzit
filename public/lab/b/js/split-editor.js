/**
 * split-editor.js: the playable itemized split.
 * Tap a face on a line to take that person off it (or put them back); every
 * total re-splits through the kit's engine, to the cent.
 */

import { PEOPLE, CATEGORIES, summarise } from './data.js';
import { money, esc, avatar, ICON, listNames, reduced } from './util.js';

const whole = (c) => (c % 100 === 0 ? money(c).replace(/\.00$/, '') : money(c));
/**
 * Who pays what on one line, in words: "Just Maya", "$1.37 each",
 * "$3.28 each" (a penny left over, rounded), or names for a weighted split
 * ("You $600 · Maya $600 · Jordan $672 · Sam $528").
 */
export const shareText = (shares, order) => {
  const ids = order.filter((id) => shares[id] !== undefined && shares[id] !== 0);
  if (ids.length === 0) return '';
  if (ids.length === 1) return ids[0] === 'you' ? 'Just you' : `Just ${PEOPLE[ids[0]].name}`;
  const vals = ids.map((id) => shares[id]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  // a penny left over is not news: "$4.10 each" (the pills and the live summary stay exact)
  if (hi - lo <= 1) return `${money(Math.round(vals.reduce((a, v) => a + v, 0) / vals.length))} each`;
  return ids.map((id) => `${id === 'you' ? 'You' : PEOPLE[id].name} ${whole(shares[id])}`).join(' · ');
};

const clone = (o) => JSON.parse(JSON.stringify(o));
/**
 * Take `id` off a line, or put them back. A weighted line (rent at 25/25/28/22)
 * keeps the agreed weights: the rest are renormalised, and the original split
 * comes back exactly once everyone is on it again. Returns null when the line
 * would have nobody.
 */
export function toggleSplit(orig, cur, id, order) {
  const who = splitPeople(cur, order);
  const next = who.includes(id) ? who.filter((x) => x !== id) : order.filter((x) => x === id || who.includes(x));
  if (next.length === 0) return null;
  const base = orig || { type: 'equal', people: order };
  const was = splitPeople(base, order);
  if (next.length === was.length && next.every((x) => was.includes(x))) return clone(base);
  const w = base.type === 'percentage' ? base.percents : (base.type === 'shares' ? base.shares : null);
  if (w && next.every((x) => w[x] !== undefined)) return { type: 'shares', shares: Object.fromEntries(next.map((x) => [x, Number(w[x])])) };
  return { type: 'equal', people: next };
}

/** Who had a line: one face per person, filled = on it, dashed = off. Every line, same control.
 *  Each line is one Tab stop (roving tabindex); arrows move between people and lines (wireFaceKeys). */
export function facesHTML(order, who, name) {
  return `<span class="faces" role="group" aria-label="Who had ${esc(name)}" aria-describedby="faces-keys">${order.map((id, k) => avatar(PEOPLE[id], { size: 'face', pressed: who.includes(id), label: `${PEOPLE[id].name} on ${name}` }).replace('<button ', `<button tabindex="${k ? -1 : 0}" `)).join('')}</span>`;
}

/** Left/Right (and Home/End) move along a line's faces; Up/Down move to the same person on the next line. */
export function wireFaceKeys(scope) {
  scope.addEventListener('keydown', (e) => {
    const b = e.target.closest?.('.faces .av');
    if (!b) return;
    const row = b.parentElement;
    const faces = [...row.children];
    const k = faces.indexOf(b);
    let to = null;
    if (e.key === 'ArrowRight') to = faces[Math.min(faces.length - 1, k + 1)];
    else if (e.key === 'ArrowLeft') to = faces[Math.max(0, k - 1)];
    else if (e.key === 'Home') to = faces[0];
    else if (e.key === 'End') to = faces[faces.length - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = [...scope.querySelectorAll('.faces')].filter((r) => r.offsetParent);
      const r = rows[rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1)];
      to = r ? (r.querySelector(`.av[data-id="${b.dataset.id}"]`) || r.firstElementChild) : null;
    } else return;
    e.preventDefault();
    if (!to || to === b) return;
    [...to.parentElement.children].forEach((f) => { f.tabIndex = f === to ? 0 : -1; });
    to.focus();
  });
}

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
    // Same order as the home page: the lines that explain the shares lead.
    const lead = sc.lead || [];
    const shown = [...lead.map((i) => res.items.find((it) => it.index === i && !isExtra(it))).filter(Boolean),
      ...res.items.filter((it) => isExtra(it) || !lead.includes(it.index))];
    const rows = shown.map((it) => {
      const extra = isExtra(it);
      const src = extra ? null : items[it.index];
      const who = src ? splitPeople(src.split, order) : [];
      const c = cat(it.category);
      const whoCell = multi && !extra
        ? facesHTML(order, who, it.name)
        : (extra ? '' : `<span class="se-cat"><span class="dot" style="--c:${c.color}"></span>${esc(c.label)}</span>`);
      return `<li class="ss-item se-item${extra ? ' is-extra' : ''}" data-i="${extra ? '' : it.index}">
        <span class="ss-name"><span>${esc(it.name)}</span><small class="se-each">${multi ? esc(shareText(it.shares, order)) : ''}</small></span>
        <span class="ss-who">${whoCell}</span>
        <span class="ss-price money">${money(it.totalCents)}</span>
      </li>`;
    }).join('');

    // Compact (examples page): the same pills as the home page's split, everyone but you
    // ("You spent" is your pill); no bars, no labels.
    const people = compact ? order.filter((id) => id !== 'you').map((id) => {
      const cents = res.people[id]?.cents || 0;
      return `<li class="se-person" data-id="${id}">${avatar(PEOPLE[id], { size: 'sm' })}<span class="sp-name">${esc(PEOPLE[id].name)}</span><b class="se-pamt money" data-cents="${cents}">${money(cents)}</b></li>`;
    }).join('') : order.map((id) => {
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
      ${multi ? '<p class="se-hint">Tap a face.</p>' : ''}
      <ol class="se-items${res.items.length > 8 ? ' is-clipped' : ''}" role="list">${rows}</ol>
      ${res.items.length > 8 ? `<button type="button" class="se-more" data-more>Show all ${res.items.length} lines</button>` : ''}
      <div class="se-side">
        ${people ? `<ul class="se-people${compact ? ' snap-people' : ''}" role="list">${people}</ul>` : ''}
        <div class="se-yours">
          <p class="se-ytitle">Your ${money(sum.mine)}, by category</p>
          <div class="catbar" aria-hidden="true">${catBar(sum.byCategory)}</div>
          <ul class="cats" role="list">${catList(sum.byCategory)}</ul>
        </div>
        <div class="se-end"><p class="se-check">${ICON.check}<span>Adds up</span></p>${multi ? '<button type="button" class="btn btn-quiet btn-sm" data-reset>Reset</button>' : ''}</div>
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
      clearTimeout(Number(each.dataset.t || 0));
      each.classList.remove('is-warn');
      if (each.textContent !== txt) {
        each.textContent = txt;
        each.classList.remove('flash'); void each.offsetWidth; each.classList.add('flash');
      }
      if (!extra) {
        const who = splitPeople(items[it.index].split, order);
        li.querySelectorAll('.faces .av').forEach((b) => b.setAttribute('aria-pressed', String(who.includes(b.dataset.id))));
      }
    });
    root.querySelectorAll('.se-item.is-extra').forEach((li, k) => {
      const ex = res.items.filter((it) => it.isExtraCharge || it.itemType === 'Tip' || it.itemType === 'Fee' || it.itemType === 'Discount')[k];
      if (ex) li.querySelector('.se-each').textContent = shareText(ex.shares, order);
    });
    order.forEach((id) => {
      const li = root.querySelector(`.se-person[data-id="${id}"]`);
      if (!li) return;
      const cents = res.people[id]?.cents || 0;
      setMoney(li.querySelector('.se-pamt'), cents);
      const bar = li.querySelector('.se-bar i');
      if (bar) bar.style.width = `${res.totalCents ? (cents / res.totalCents) * 100 : 0}%`;
    });
    root.querySelector('.se-ytitle').textContent = `Your ${money(sum.mine)}, by category`;
    root.querySelector('.catbar').innerHTML = catBar(sum.byCategory);
    root.querySelector('.cats').innerHTML = catList(sum.byCategory);
    const live = root.querySelector('[data-live]');
    live.textContent = order.map((id) => `${PEOPLE[id].name} ${money(res.people[id]?.cents || 0)}`).join(', ');
    last = sum;
    onChange?.(sum, changedIndex);
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) {
      const open = !root.querySelector('.se-items.is-clipped') && root.querySelector('.se-items');
      api.reset();
      if (open) { root.querySelector('.se-items').classList.remove('is-clipped'); root.querySelector('[data-more]')?.remove(); }
      root.querySelector('[data-reset]')?.focus();
      return;
    }
    const more = e.target.closest('[data-more]');
    if (more) { root.querySelector('.se-items').classList.remove('is-clipped'); more.remove(); return; }
    const b = e.target.closest('.faces .av');
    if (!b) return;
    const li = b.closest('.se-item');
    const i = Number(li.dataset.i);
    const it = items[i];
    const id = b.dataset.id;
    const next = toggleSplit(sc.bill.items[i].split, it.split, id, order);
    if (!next) {
      const live = root.querySelector('[data-live]');
      live.textContent = 'Someone has to have it. Add another person first.';
      const each = li.querySelector('.se-each');
      const was = each.textContent;
      each.textContent = 'Someone has to have it.';
      each.classList.add('is-warn');
      clearTimeout(Number(each.dataset.t || 0));
      each.dataset.t = String(setTimeout(() => { each.classList.remove('is-warn'); each.textContent = was; }, 2400));
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      return;
    }
    it.split = next;
    update(i);
  });

  wireFaceKeys(root);
  const api = {
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
  return api;
}

/** Set a figure in the same frame as every other figure (no count-up); a changed one flashes once. */
export function setMoney(node, cents) {
  if (!node) return;
  const changed = node.dataset.cents !== String(cents);
  node.dataset.cents = String(cents);
  node.textContent = money(cents);
  if (changed && !reduced()) { node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash'); }
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
