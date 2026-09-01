/* Mnahel's Cafe POS v0.15.27 · UI readability and workflow refinement. */
(function(){
  'use strict';
  const BUILD='0.15.27',UI_REVISION='20260901-ui-readability-27';
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
  let metricsObserver=null;
  let orderObserver=null;

  function metricLabel(card){return q('small',card)?.textContent.trim()||''}

  function ownMetrics(){
    let host=q('#v46-metrics');
    if(!host||host.dataset.v49Owned==='1')return host;
    const clone=host.cloneNode(true);
    clone.dataset.v49Owned='1';
    host.replaceWith(clone);
    metricsObserver?.disconnect();
    metricsObserver=new MutationObserver(()=>queueMicrotask(layoutMetrics));
    metricsObserver.observe(clone,{childList:true});
    return clone;
  }

  function groupMetrics(title,help,cards){
    const group=document.createElement('section');
    group.className='v49-metric-group';
    const heading=document.createElement('div');
    heading.className='v49-metric-heading';
    heading.innerHTML=`<b>${title}</b><small>${help}</small>`;
    const row=document.createElement('div');
    row.className='v49-metric-row';
    row.style.setProperty('--v49-columns',String(cards.length));
    cards.forEach(card=>row.append(card));
    group.append(heading,row);
    return group;
  }

  function layoutMetrics(){
    const host=q('#v46-metrics');
    if(!host||host.dataset.v49Busy==='1')return;
    const cards=qa(':scope > .metric',host);
    if(!cards.length)return;
    const byLabel=new Map(cards.map(card=>[metricLabel(card),card]));
    const take=(label,newLabel,description)=>{
      const card=byLabel.get(label);
      if(!card)return null;
      const caption=q('small',card);
      if(caption)caption.textContent=newLabel;
      card.title=description;
      card.dataset.v49Metric=newLabel;
      return card;
    };
    const drawer=[
      take('Opening Float','Opening Cash','Cash present when this shift started.'),
      take('Cash Sales','Cash Sales','Cash received from paid orders.'),
      take('Cash In','Cash Added','Extra cash added to the drawer.'),
      take('Cash Out','Cash Given','Cash taken out for an expense or handover.'),
      take('Expected Drawer','Expected Cash','Opening cash + cash sales + cash added − cash given.')
    ].filter(Boolean);
    const sales=[
      take('Non-Cash','Card / Online','Payments that do not affect the cash drawer.'),
      take('Discounts','Discounts','Discount value used during this shift.'),
      take('Orders','Paid Orders','Number of paid orders in this shift.')
    ].filter(Boolean);
    if(!drawer.length&&!sales.length)return;
    host.dataset.v49Busy='1';
    host.classList.add('v49-metric-board');
    const groups=[];
    if(drawer.length)groups.push(groupMetrics('Cash Drawer','Physical cash only',drawer));
    if(sales.length)groups.push(groupMetrics('Shift Sales','Supporting totals',sales));
    host.replaceChildren(...groups);
    delete host.dataset.v49Busy;
  }

  function closeMovementSelect(except=null){
    qa('.v49-select.open').forEach(shell=>{
      if(shell===except)return;
      shell.classList.remove('open');
      q('.v49-select-menu',shell).hidden=true;
      q('.v49-select-toggle',shell).setAttribute('aria-expanded','false');
    });
  }

  function enhanceMovementSelect(){
    const select=q('#v46-type');
    if(!select||select.dataset.v49Select==='1'||!select.closest('.v48-control'))return;
    select.dataset.v49Select='1';
    select.classList.add('v49-native-select');
    select.parentElement.querySelector('.v48-chevron')?.remove();
    const shell=document.createElement('div');
    shell.className='v49-select';
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='v49-select-toggle';
    toggle.setAttribute('aria-haspopup','listbox');
    toggle.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');
    menu.className='v49-select-menu';
    menu.setAttribute('role','listbox');
    menu.hidden=true;
    select.parentNode.insertBefore(shell,select);
    shell.append(select,toggle,menu);

    const sync=()=>{
      const selected=select.options[select.selectedIndex];
      toggle.textContent=selected?.textContent||'Choose movement';
      toggle.disabled=select.disabled;
      qa('.v49-select-option',menu).forEach(button=>button.setAttribute('aria-selected',String(button.dataset.value===select.value)));
    };
    const choose=value=>{
      select.value=value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      closeMovementSelect();
      sync();
      toggle.focus();
    };
    [...select.options].forEach(option=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='v49-select-option';
      button.dataset.value=option.value;
      button.setAttribute('role','option');
      button.textContent=option.textContent;
      button.addEventListener('click',()=>choose(option.value));
      menu.append(button);
    });
    toggle.addEventListener('click',event=>{
      event.stopPropagation();
      const opening=!shell.classList.contains('open');
      closeMovementSelect(shell);
      shell.classList.toggle('open',opening);
      menu.hidden=!opening;
      toggle.setAttribute('aria-expanded',String(opening));
      if(opening)q('.v49-select-option[aria-selected="true"]',menu)?.focus();
    });
    toggle.addEventListener('keydown',event=>{
      if(event.key==='Escape'){closeMovementSelect();toggle.focus();return}
      if(!['ArrowDown','ArrowUp'].includes(event.key))return;
      event.preventDefault();
      const options=qa('.v49-select-option',menu);
      const current=Math.max(0,options.findIndex(button=>button.dataset.value===select.value));
      const next=(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
      if(menu.hidden){toggle.click();return}
      options[next]?.focus();
    });
    menu.addEventListener('keydown',event=>{
      const options=qa('.v49-select-option',menu);
      const current=options.indexOf(document.activeElement);
      if(event.key==='Escape'){event.preventDefault();closeMovementSelect();toggle.focus();return}
      if(!['ArrowDown','ArrowUp','Enter',' '].includes(event.key))return;
      event.preventDefault();
      if(event.key==='Enter'||event.key===' '){document.activeElement?.click();return}
      options[(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();
    });
    select.addEventListener('change',sync);
    new MutationObserver(sync).observe(select,{attributes:true,attributeFilter:['disabled']});
    sync();
  }

  function moveOrderActions(){
    const dialog=q('#v38-order-setup');
    if(!dialog)return;
    const selected=q('.v38-selected-mode',dialog);
    const footer=q('#v38-setup-footer',dialog);
    if(!selected){footer?.classList.remove('v49-actions-moved');return}
    if(q('.v49-order-actions',selected))return;
    const change=q(':scope > [data-v38-back]',selected);
    const back=q('.v38-back[data-v38-back]',footer);
    const start=q('.v38-start[data-v38-start]',footer);
    if(!change||!back||!start)return;
    change.textContent='Change';
    back.textContent='← Back';
    const actions=document.createElement('div');
    actions.className='v49-order-actions';
    actions.append(change,back,start);
    selected.append(actions);
    footer.classList.add('v49-actions-moved');
  }

  function watchOrderDialog(){
    const dialog=q('#v38-order-setup');
    if(!dialog||dialog.dataset.v49Observed==='1')return;
    dialog.dataset.v49Observed='1';
    orderObserver?.disconnect();
    orderObserver=new MutationObserver(()=>queueMicrotask(moveOrderActions));
    orderObserver.observe(dialog,{childList:true,subtree:true});
    moveOrderActions();
  }

  function patchShiftPolish(){
    const api=window.mnahelsV48;
    if(!api||api.v49Patched)return;
    const original=api.polishShift;
    api.polishShift=function(){
      const result=original.apply(this,arguments);
      ownMetrics();
      layoutMetrics();
      enhanceMovementSelect();
      return result;
    };
    api.v49Patched=true;
  }

  function refresh(){
    patchShiftPolish();
    if(q('#v46-metrics > .metric')){
      window.mnahelsV48?.decorateMetrics?.();
      ownMetrics();
      layoutMetrics();
    }
    enhanceMovementSelect();
    watchOrderDialog();
    moveOrderActions();
  }

  document.addEventListener('click',event=>{if(!event.target.closest('.v49-select'))closeMovementSelect()},true);
  document.documentElement.dataset.uiRevision='49';
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
  setTimeout(refresh,700);
  setTimeout(refresh,1700);
  setInterval(()=>{if(document.visibilityState==='visible')refresh()},4000);
  window.mnahelsV49={build:BUILD,uiRevision:UI_REVISION,refresh,layoutMetrics,enhanceMovementSelect,moveOrderActions};
})();
