/* V8 — simplificação inteligente do formulário de hábitos */
(function(){
'use strict';
const baseOpenHabit=window.openHabit;
if(typeof baseOpenHabit!=='function')return;

function tuneHabitForm(){
 const form=document.querySelector('#modalBody form');
 if(!form)return;
 const type=form.querySelector('[name="type"]');
 const checklist=form.querySelector('[name="checklistItems"]')?.closest('label');
 const freq=form.querySelector('[name="freqType"]');
 const weekly=form.querySelector('[name="weeklyGoal"]')?.closest('label');
 const days=form.querySelector('.daychecks')?.parentElement;
 const calendar=form.querySelector('[name="calendarSync"]')?.closest('label');

 if(weekly){
  const text=[...weekly.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
  if(text)text.textContent='Meta semanal';
 }
 if(calendar)calendar.remove();

 function refresh(){
  if(checklist)checklist.style.display=type?.value==='checklist'?'':'none';
  const mode=freq?.value||'daily';
  if(weekly)weekly.style.display=mode==='weekly'?'':'none';
  if(days)days.style.display=mode==='specific'?'':'none';
 }
 if(type)type.onchange=refresh;
 if(freq)freq.onchange=refresh;
 refresh();
}

window.openHabit=function(id){
 baseOpenHabit(id);
 requestAnimationFrame(tuneHabitForm);
};
})();
