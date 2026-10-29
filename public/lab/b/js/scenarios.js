/* scenarios.js: the gallery page. Every scenario as a full Bank | Trezzit pair, each split playable. */

import { loadScenarios, PEOPLE, KINDS } from './data.js';
import { createSplitEditor, catBar, catList } from './split-editor.js';
import { initNav, initReveal } from './shared.js';
import { money, bankAmt, esc, ICON, tweenMoney, listNames } from './util.js';

initNav();

const list = document.querySelector('[data-list]');
const rail = document.querySelector('[data-rail]');

function card(sc) {
  const s = sc.sum;
  const b = sc.bank;
  const others = sc.people.filter((id) => id !== 'you').map((id) => PEOPLE[id].name);
  const owe = s.owedToYou
    ? `${esc(listNames(others))} owe${others.length === 1 ? 's' : ''} you <b class="money money-in" data-owe>${money(s.owedToYou)}</b>`
    : (s.youOwe ? `You owe ${esc(PEOPLE[sc.payer].name)} <b class="money" data-owe>${money(s.youOwe)}</b>` : 'Nobody owes anybody.');
  return `
  <article class="scn reveal" id="${sc.id}" data-kind="${sc.kind}" aria-labelledby="t-${sc.id}">
    <header class="scn-h">
      <span class="kind kind-${sc.kind}" aria-hidden="true"></span>
      <div>
        <p class="scn-kind">${KINDS[sc.kind].label}${sc.repeat ? ` · ${esc(sc.repeat)}` : ''}</p>
        <h2 id="t-${sc.id}">${esc(sc.title)}</h2>
        <p class="lede">${esc(sc.lesson)}</p>
      </div>
    </header>
    <div class="pair pair-scn">
      <div class="pane-bank">
        <p class="pane-label"><span>Your bank</span><span>Checking ··4242</span></p>
        <div class="scn-line${b ? '' : ' is-none'}">
          ${b ? `<span>${esc(b.date)}</span><span>${esc(b.merchant)}</span><span>${bankAmt(s.total)}</span>` : '<span class="none-msg">No charge on your statement</span>'}
        </div>
        <p class="scn-says">${b ? `${esc(b.cat)}. One line. That&rsquo;s everything your bank knows.` : `Your bank never sees it. ${esc(PEOPLE[sc.payer].name)}&rsquo;s bank sees all of it.`}</p>
      </div>
      <div class="pane-tz">
        <p class="pane-label tz"><span>Trezzit</span><span>${esc(sc.merchant)}</span></p>
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
        <div class="sd-meta">
          <span class="tag">${sc.itemCount} item${sc.itemCount === 1 ? '' : 's'}</span>
          ${sc.people.length > 1 ? `<span class="tag">${ICON.people}${sc.people.length} people</span>` : `<span class="tag">${ICON.person}Just you</span>`}
          ${sc.group ? `<span class="tag">${esc(sc.group)}</span>` : ''}
          ${sc.repeat ? `<span class="tag rec">${ICON.repeat}Repeats</span>` : ''}
        </div>
        <div data-editor></div>
        <p class="sd-owe">${owe}</p>
        ${sc.next ? `<div class="sd-next" aria-label="Coming up">${sc.next.map((d) => `<span>${esc(d)}<b class="money">${money(s.mine)}</b></span>`).join('')}</div>` : ''}
      </div>
    </div>
  </article>`;
}

loadScenarios({ extras: true }).then((all) => {
  rail.innerHTML = all.map((sc) => `<a href="#${sc.id}" class="chip"><span class="kind-dot kind-${sc.kind}" aria-hidden="true"></span>${esc(sc.short || sc.title)}</a>`).join('');
  list.innerHTML = all.map(card).join('');
  all.forEach((sc) => {
    const art = document.getElementById(sc.id);
    const ed = createSplitEditor(art.querySelector('[data-editor]'), {
      compact: true,
      onChange(sum) {
        if (!sum) return;
        tweenMoney(art.querySelector('[data-mine]'), sum.mine);
        art.querySelector('[data-catbar]').innerHTML = catBar(sum.byCategory);
        art.querySelector('[data-cats]').innerHTML = catList(sum.byCategory, { limit: 5 });
        const owe = art.querySelector('[data-owe]');
        if (owe) owe.textContent = money(sum.owedToYou || sum.youOwe);
        art.querySelectorAll('.sd-next b').forEach((b) => { b.textContent = money(sum.mine); });
      },
    });
    ed.load(sc);
  });
  document.body.classList.add('is-ready');
  initReveal();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
});
