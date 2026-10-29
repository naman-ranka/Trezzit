/* scenarios.js: one playable Bank | Trezzit pair; the rail switches which charge it shows. */

import { loadScenarios, PEOPLE } from './data.js';
import { createSplitEditor, catBar, catList, setMoney } from './split-editor.js';
import { initNav, initReveal } from './shared.js';
import { money, bankAmt, esc, listNames } from './util.js';

initNav();

const list = document.querySelector('[data-list]');
const rail = document.querySelector('[data-rail]');

/* Who owes whom, naming only the people who still have a share. */
function oweHTML(sc, s) {
  const others = sc.people.filter((id) => id !== 'you' && s.result.people[id]?.cents > 0).map((id) => PEOPLE[id].name);
  if (s.owedToYou && others.length) return `${esc(listNames(others))} owe${others.length === 1 ? 's' : ''} you <b class="money money-in">${money(s.owedToYou)}</b>`;
  if (s.youOwe) return `You owe ${esc(PEOPLE[sc.payer].name)} <b class="money">${money(s.youOwe)}</b>`;
  return 'Nobody owes anybody.';
}

/* Examples page order: Rent first (an unequal split the home page only summarises), the
   home hero's Green Basket last, so the first thing seen here is new. */
const ORDER = ['rent', 'trip', 'streaming', 'dinner', 'order', 'pharmacy', 'groceries'];

function card(sc) {
  const s = sc.sum;
  const b = sc.bank;
  return `
  <article class="scn" id="scn-${sc.id}" data-kind="${sc.kind}" aria-labelledby="t-${sc.id}">
    <header class="scn-h">
      <span class="kind kind-${sc.kind}" aria-hidden="true"></span>
      <div>
        <h2 id="t-${sc.id}" tabindex="-1">${esc(sc.title)}</h2>
        ${sc.why ? `<p class="lede">${esc(sc.why)}</p>` : ''}
      </div>
    </header>
    <div class="pair pair-scn">
      <div class="pane-bank">
        <p class="pane-label"><span>Your bank</span><span>Checking ··4242</span></p>
        <div class="scn-line${b ? '' : ' is-none'}">
          ${b ? `<span>${esc(b.date)}</span><span>${esc(b.merchant)}</span><span>${bankAmt(s.total)}</span>` : '<span class="none-msg">No charge on your statement</span>'}
        </div>
      </div>
      <div class="pane-tz">
        <p class="pane-label tz"><span>${esc(sc.merchant)}${sc.repeat ? ` · ${esc(sc.repeat)}` : ''}</span></p>
        <div class="scn-top">
          <div>
            <p class="pt-label">You spent</p>
            <p class="scn-amt money" data-mine data-cents="${s.mine}">${money(s.mine)}</p>
            <p class="pt-of">${s.mine === s.total ? 'All yours' : `of <span class="money">${money(s.total)}</span>`} · ${sc.payer === 'you' ? 'you paid' : `${esc(PEOPLE[sc.payer].name)} paid`}</p>
          </div>
          <div class="scn-cats">
            <div class="catbar" aria-hidden="true" data-catbar>${catBar(s.byCategory)}</div>
            <ul class="cats" role="list" data-cats>${catList(s.byCategory, { limit: 5 })}</ul>
          </div>
        </div>
        <div data-editor></div>
        <p class="sd-owe" data-owe>${oweHTML(sc, s)}</p>
        ${sc.next ? `<div class="sd-next" aria-label="Coming up">${sc.next.map((d) => `<span>${esc(d)}<b class="money">${money(s.mine)}</b></span>`).join('')}</div>` : ''}
      </div>
    </div>
  </article>`;
}

loadScenarios({ extras: true }).then((loaded) => {
  const byId = Object.fromEntries(loaded.map((sc) => [sc.id, sc]));
  const all = [...ORDER.map((id) => byId[id]).filter(Boolean), ...loaded.filter((sc) => !ORDER.includes(sc.id))];
  const status = document.querySelector('[data-status]');
  rail.innerHTML = all.map((sc) => `<button type="button" class="chip" data-pick="${sc.id}" aria-pressed="false"><span class="kind-dot kind-${sc.kind}" aria-hidden="true"></span>${esc(sc.short || sc.title)}</button>`).join('');

  function show(id, { focus = false } = {}) {
    const sc = byId[id] || all[0];
    rail.querySelectorAll('[data-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pick === sc.id)));
    list.innerHTML = card(sc);
    const art = list.firstElementChild;
    const ed = createSplitEditor(art.querySelector('[data-editor]'), {
      compact: true,
      onChange(sum) {
        if (!sum) return;
        // every figure changes in the same frame, so they always add up (no count-up)
        setMoney(art.querySelector('[data-mine]'), sum.mine);
        art.querySelector('[data-catbar]').innerHTML = catBar(sum.byCategory);
        art.querySelector('[data-cats]').innerHTML = catList(sum.byCategory, { limit: 5 });
        art.querySelector('[data-owe]').innerHTML = oweHTML(sc, sum);
        art.querySelectorAll('.sd-next b').forEach((b) => { b.textContent = money(sum.mine); });
      },
    });
    ed.load(sc);
    if (history.replaceState) history.replaceState(null, '', `#${sc.id}`);
    if (focus) {
      art.querySelector('h2')?.focus({ preventScroll: true });
      if (status) status.textContent = `Showing: ${sc.title}`;
    }
  }

  // a chip that gets focus off-screen scrolls fully into the rail
  rail.addEventListener('focusin', (e) => e.target.closest('[data-pick]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }));
  rail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) show(b.dataset.pick, { focus: true });
  });
  show(location.hash.slice(1) || ORDER[0]);
  addEventListener('hashchange', () => show(location.hash.slice(1) || ORDER[0]));
  document.body.classList.add('is-ready');
  initReveal();
});
