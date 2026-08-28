/* V8 Today habit completion visibility fix — UI/domain compatibility patch */
(function(){
'use strict';

function isHabitDoneToday(h){
  try{
    const d=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    const cfg=typeof configForDate==='function'?configForDate(h,d):h;
    const value=typeof habitLog==='function'?Number(habitLog(h.id,d)||0):Number((data.habitLogs||{})[`${h.id}_${d}`]?.value||0);
    const target=cfg?.type==='boolean'?1:Math.max(1,Number(cfg?.target||h.target||1));
    return value>=target;
  }catch{return false}
}

function pruneCompletedTodayHabits(){
  try{
    if(typeof page!=='undefined'&&page!=='today')return;
    const doneNames=new Set((data?.habits||[]).filter(isHabitDoneToday).map(h=>String(h.name||'').trim()));
    if(!doneNames.size)return;
    document.querySelectorAll('.v8-day-item').forEach(row=>{
      const type=row.querySelector('.v8-item-type')?.textContent||'';
      if(!type.includes('Hábito'))return;
      const title=row.querySelector('.grow > b')?.textContent?.trim()||'';
      if(doneNames.has(title))row.remove();
    });
    const list=document.querySelector('.v8-day-list');
    if(list&&!list.querySelector('.v8-day-item')&&!list.querySelector('.empty'))list.innerHTML='<div class="empty">Nada pendente nesta visão.</div>';
  }catch(error){console.warn('Today habit completion fix:',error)}
}

const baseRender=window.render;
if(typeof baseRender==='function'){
  window.render=function(...args){
    const result=baseRender.apply(this,args);
    queueMicrotask(pruneCompletedTodayHabits);
    return result;
  };
}

const observer=new MutationObserver(()=>queueMicrotask(pruneCompletedTodayHabits));
window.addEventListener('load',()=>{
  const content=document.getElementById('content');
  if(content)observer.observe(content,{childList:true,subtree:true});
  pruneCompletedTodayHabits();
});
window.addEventListener('focus',()=>setTimeout(pruneCompletedTodayHabits,500));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(pruneCompletedTodayHabits,500)});
})();
