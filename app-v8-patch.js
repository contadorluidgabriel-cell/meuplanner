/* Ajustes de integração V8 sobre formulários legados */
(function(){
'use strict';

const baseOpenTask=window.openTask, baseSaveTask=window.saveTask;
if(baseOpenTask&&baseSaveTask){
 window.openTask=function(id){
   baseOpenTask(id);
   setTimeout(()=>{
     const form=document.querySelector('#modal form');if(!form)return;
     const task=id?data.tasks.find(x=>x.id===id):null;
     const prioritySelect=form.querySelector('select[name="priority"]');
     if(prioritySelect){prioritySelect.value='normal';const label=prioritySelect.closest('label');if(label)label.style.display='none'}
     if(!form.querySelector('[name="dayPriority"]')){
       const wrap=document.createElement('div');wrap.className='formgrid v8-task-links';
       wrap.innerHTML=`<label style="display:flex;align-items:center;gap:8px"><input name="dayPriority" type="checkbox" style="width:auto" ${task?.dayPriority?'checked':''}> ⭐ Prioridade do dia</label><label>Meta SMART relacionada<select name="goalId"><option value="">Nenhuma</option>${(data.goals||[]).filter(g=>g.status!=='completed').map(g=>`<option value="${g.id}" ${task?.goalId===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>`;
       const submit=form.querySelector('button.primary:last-child');form.insertBefore(wrap,submit)
     }
   },0)
 };
 window.saveTask=function(e,id){
   const form=e.target,fd=new FormData(form),goalId=fd.get('goalId')||'',dayPriority=fd.get('dayPriority')==='on',beforeIds=new Set(data.tasks.map(t=>t.id));
   baseSaveTask(e,id);
   let task=id?data.tasks.find(t=>t.id===id):data.tasks.find(t=>!beforeIds.has(t.id));
   if(task){task.goalId=goalId;task.dayPriority=dayPriority;save()}
 }
}

const baseOpenHabit=window.openHabit, baseSaveHabit=window.saveHabit;
if(baseOpenHabit&&baseSaveHabit){
 window.openHabit=function(id){
   baseOpenHabit(id);
   setTimeout(()=>{
     const form=document.querySelector('#modal form');if(!form||form.querySelector('[name="goalId"]'))return;
     const habit=id?data.habits.find(x=>x.id===id):null;
     const label=document.createElement('label');label.className='full';label.innerHTML=`Meta SMART relacionada<select name="goalId"><option value="">Nenhuma</option>${(data.goals||[]).filter(g=>g.status!=='completed').map(g=>`<option value="${g.id}" ${habit?.goalId===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select><span class="small muted">O hábito contribui para a meta, mas não altera o progresso automaticamente.</span>`;
     const grid=form.querySelector('.formgrid');if(grid)grid.appendChild(label)
   },0)
 };
 window.saveHabit=function(e,id){
   const fd=new FormData(e.target),goalId=fd.get('goalId')||'',beforeIds=new Set(data.habits.map(h=>h.id));
   baseSaveHabit(e,id);
   let h=id?data.habits.find(x=>x.id===id):data.habits.find(x=>!beforeIds.has(x.id));if(h){h.goalId=goalId;save()}
 }
}

// Revisões rápidas conectadas ao planejamento.
window.openWeeklyReviewV8=function(){
 let wk=weekKey(),p=data.weeklyPlans[wk]||{};
 openModal('🔄 Revisão semanal',`<form class="form" onsubmit="saveWeeklyReviewV8(event)"><div class="auth-note">Resumo curto para aprender com a semana e preparar a próxima.</div><label>O que avançou?<textarea name="wins"></textarea></label><label>O que travou ou foi adiado?<textarea name="blockers"></textarea></label><label>O que quero levar para a próxima semana?<textarea name="next"></textarea></label><button class="btn primary">Salvar revisão</button></form>`)
};
window.saveWeeklyReviewV8=function(e){e.preventDefault();let f=new FormData(e.target);data.reviews.push({id:uid(),type:'weekly',period:weekKey(),createdAt:new Date().toISOString(),wins:f.get('wins')||'',blockers:f.get('blockers')||'',next:f.get('next')||''});save();closeModal();toast('Revisão semanal salva')};
window.openMonthlyReviewV8=function(){
 openModal('🔄 Revisão mensal',`<form class="form" onsubmit="saveMonthlyReviewV8(event)"><label>Principais avanços<textarea name="wins"></textarea></label><label>O que não aconteceu como esperado?<textarea name="blockers"></textarea></label><label>O que precisa mudar no próximo mês?<textarea name="next"></textarea></label><button class="btn primary">Salvar revisão mensal</button></form>`)
};
window.saveMonthlyReviewV8=function(e){e.preventDefault();let f=new FormData(e.target);data.reviews.push({id:uid(),type:'monthly',period:`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`,createdAt:new Date().toISOString(),wins:f.get('wins')||'',blockers:f.get('blockers')||'',next:f.get('next')||''});save();closeModal();toast('Revisão mensal salva')};

// Atalhos de revisão dentro do Planejar após cada render.
const baseRenderPlan=window.renderPlanV8;
if(baseRenderPlan){
 window.renderPlanV8=function(){baseRenderPlan();setTimeout(()=>{const body=document.getElementById('planBody');if(!body)return;const bar=document.createElement('div');bar.className='v8-review-actions';bar.innerHTML=planView==='week'?`<button class="btn" onclick="openWeeklyReviewV8()">🔄 Revisão semanal</button>`:planView==='month'?`<button class="btn" onclick="openMonthlyReviewV8()">🔄 Revisão mensal</button>`:'';if(bar.innerHTML)body.appendChild(bar)},0)}
}
})();
