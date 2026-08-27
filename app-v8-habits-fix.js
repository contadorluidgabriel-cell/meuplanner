/* V8 habit completion fix — reliable touch controls for Today */
(function(){
'use strict';
function getToday(){return typeof today==='function'?today():new Date().toISOString().slice(0,10)}
function getHabit(id){return (data.habits||[]).find(h=>h.id===id)}
function cfg(h,d){try{return typeof configForDate==='function'?configForDate(h,d):h}catch{return h}}
function entryValue(h,d){try{return typeof habitLog==='function'?Number(habitLog(h.id,d))||0:0}catch{return 0}}
function state(h,d){try{return typeof habitState==='function'?habitState(h,d):(entryValue(h,d)>0?'complete':'none')}catch{return 'none'}}
function rerender(){try{if(typeof render==='function')render();else if(typeof window.showPage==='function')window.showPage('today')}catch{} }
window.completeHabitV8=function(id){
 const h=getHabit(id);if(!h)return;
 const d=getToday(),c=cfg(h,d),s=state(h,d);
 try{
   if(c.type==='boolean'){
     setHabitLog(id,d,s==='complete'?0:1);
     if(typeof toast==='function')toast(s==='complete'?'Registro desmarcado':'Hábito marcado como feito');
   }else if(c.type==='checklist'){
     if(typeof openHabitCalendar==='function'){openHabitCalendar(id);return}
     if(typeof toast==='function')toast('Abra o hábito para registrar o checklist');
     return;
   }else{
     const target=Number(c.target)||1;
     setHabitLog(id,d,s==='complete'?0:target);
     if(typeof toast==='function')toast(s==='complete'?'Registro desmarcado':'Meta do hábito registrada');
   }
   rerender();
 }catch(err){console.error('habit completion',err);if(typeof toast==='function')toast('Não foi possível registrar o hábito')}
};
function enhanceTodayHabits(){
 if(typeof page!=='undefined'&&page!=='today')return;
 document.querySelectorAll('.v8-day-item').forEach(row=>{
   const type=row.querySelector('.v8-item-type');
   if(!type||!type.textContent.includes('Hábito'))return;
   const btn=row.querySelector('.v8-check');if(!btn)return;
   btn.setAttribute('type','button');btn.setAttribute('aria-label','Marcar ou desmarcar hábito');
   btn.style.touchAction='manipulation';btn.style.pointerEvents='auto';
 });
}
const observer=new MutationObserver(()=>requestAnimationFrame(enhanceTodayHabits));
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',enhanceTodayHabits);setTimeout(enhanceTodayHabits,0);
})();