'use strict';
// Read-only diagnostics: native setters still receive the exact original value.
// Record only disposable guided-order fields, never login/password inputs.
module.exports=function(){
 const ids=['v38-customer-name','v38-customer-phone','v38-delivery-address'];
 const trace=window.__qaSetupTrace=[];
 const values=()=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value??null]));
 const save=(event,detail={})=>{trace.push({at:Math.round(performance.now()),event,...detail});if(trace.length>24)trace.shift()};
 const stack=()=>new Error().stack?.split('\n').slice(2,8).join('\n');
 const input=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
 Object.defineProperty(HTMLInputElement.prototype,'value',{...input,set(value){
  if(ids.includes(this.id))save('value assignment',{id:this.id,before:input.get.call(this),after:String(value),stack:stack()});
  return input.set.call(this,value);
 }});
 for(const [prototype,key] of [[Element.prototype,'innerHTML'],[Node.prototype,'textContent']]){
  const native=Object.getOwnPropertyDescriptor(prototype,key);
  Object.defineProperty(prototype,key,{...native,set(value){
   if(this.nodeType===1&&(this.id==='v38-setup-body'||ids.some(id=>this.querySelector?.('#'+id))))save(key+' replacement',{target:this.id||this.tagName,values:values(),stack:stack()});
   return native.set.call(this,value);
  }});
 }
 for(const type of ['input','change','focusin','focusout'])document.addEventListener(type,e=>{if(ids.includes(e.target?.id))save(type,{id:e.target.id,value:e.target.value})},true);
 document.addEventListener('click',e=>{const button=e.target.closest?.('#v38-order-setup button');if(button)save('guided button click',{text:button.textContent.trim().slice(0,60),values:values()})},true);
 window.addEventListener('keydown',e=>{if(e.key==='F2')save('F2',{values:values()})},true);
};
