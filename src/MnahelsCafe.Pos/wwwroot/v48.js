/* Mnahel's Cafe POS v0.15.26 · shift polish and lightweight UI stability. */
(function(){
  'use strict';
  const q=(selector,root=document)=>root.querySelector(selector);
  const metricMeta={
    'Opening Float':['◌','attention'],
    'Gross Sales':['↗','positive'],
    'Cash Sales':['▣','positive'],
    'Non-Cash':['◇','positive'],
    'Cash In':['+','positive'],
    'Cash Out':['−','attention'],
    'Refunds':['↩','attention'],
    'Orders':['#','neutral'],
    'Expected Drawer':['◎','expected']
  };

  function labelText(label){
    const node=[...label.childNodes].find(item=>item.nodeType===Node.TEXT_NODE&&item.textContent.trim());
    if(!node)return '';
    const text=node.textContent.trim();
    node.remove();
    const caption=document.createElement('span');
    caption.className='v48-field-label';
    caption.textContent=text;
    label.prepend(caption);
    return text;
  }

  function icon(text){
    const span=document.createElement('span');
    span.className='v48-control-icon';
    span.setAttribute('aria-hidden','true');
    span.textContent=text;
    return span;
  }

  function wrapControl(id,symbol,prefix){
    const control=q(id);
    if(!control||control.closest('.v48-control'))return;
    const label=control.closest('label');
    if(label)labelText(label);
    const shell=document.createElement('div');
    shell.className='v48-control';
    control.parentNode.insertBefore(shell,control);
    shell.appendChild(icon(symbol));
    if(prefix){const p=document.createElement('span');p.className='v48-prefix';p.textContent=prefix;shell.appendChild(p);}
    shell.appendChild(control);
    if(control.tagName==='SELECT'){
      const arrow=document.createElement('span');
      arrow.className='v48-chevron';
      arrow.setAttribute('aria-hidden','true');
      arrow.textContent='⌄';
      shell.appendChild(arrow);
    }
  }

  function decorateMetrics(){
    const host=q('#v46-metrics');
    if(!host)return;
    [...host.children].forEach(card=>{
      const name=q('small',card)?.textContent.trim()||'';
      const meta=metricMeta[name]||['•','neutral'];
      card.dataset.v48Tone=meta[1];
      let badge=q('.v48-metric-icon',card);
      if(!badge){badge=document.createElement('span');badge.className='v48-metric-icon';badge.setAttribute('aria-hidden','true');card.appendChild(badge);}
      badge.textContent=meta[0];
    });
  }

  function syncShiftTitle(){
    const active=q('#screen-shift.active');
    if(!active)return;
    const title=q('#page-title');
    if(title&&title.textContent!=='Shift Details')title.textContent='Shift Details';
  }

  function polishShift(){
    const screen=q('#screen-shift');
    if(!screen)return;
    screen.dataset.v48Polished='1';
    wrapControl('#v46-type','↕');
    wrapControl('#v46-amount','₨','Rs');
    wrapControl('#v46-purpose','✎');
    const amount=q('#v46-amount');
    if(amount){amount.placeholder='0';amount.inputMode='decimal';amount.autocomplete='off';}
    const purpose=q('#v46-purpose');
    if(purpose)purpose.placeholder='Reason, reference, or note';
    decorateMetrics();
    syncShiftTitle();
  }

  function observeShift(){
    const metrics=q('#v46-metrics');
    if(metrics)new MutationObserver(()=>requestAnimationFrame(decorateMetrics)).observe(metrics,{childList:true});
    const screen=q('#screen-shift');
    if(screen)new MutationObserver(()=>requestAnimationFrame(syncShiftTitle)).observe(screen,{attributes:true,attributeFilter:['class']});
  }

  function boot(){
    polishShift();
    observeShift();
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-screen="shift"],#v46-refresh'))requestAnimationFrame(()=>setTimeout(polishShift,0));
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.mnahelsV48={polishShift,decorateMetrics,syncShiftTitle};
})();
