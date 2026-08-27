/* Meu Planner Digital V8 — camada de produto aditiva sobre a V7 */
(function(){
'use strict';

const V8_VERSION=8;
let todayFilter='all', planView='week', calendarCursor=new Date();
let assistantMessages=[];

function ensureV8Shape(){
  data.v8Schema=V8_VERSION;
  data.commitments=Array.isArray(data.commitments)?data.commitments:[];
  data.goals=Array.isArray(data.goals)?data.goals:[];
  data.goalUpdates=Array.isArray(data.goalUpdates)?data.goalUpdates:[];
  data.yearPlans=data.yearPlans&&typeof data.yearPlans==='object'?data.yearPlans:{};
  data.monthPlans=data.monthPlans&&typeof data.monthPlans==='object'?data.monthPlans:{};
  data.aiProposals=Array.isArray(data.aiProposals)?data.aiProposals:[];
  data.reviews=Array.isArray(data.reviews)?data.reviews:[];
  data.tasks=(data.tasks||[]).map(t=>Object.assign({goalId:'',dayPriority:false},t));
  data.habits=(data.habits||[]).map(h=>Object.assign({goalId:''},h));
  data.inbox=(data.inbox||[]).map(x=>Object.assign({source:'text',state:'open'},x));
}
ensureV8Shape();
try{save()}catch{}

window.showPage=function(p){page=p;render()};
window.setTodayFilter=function(v){todayFilter=v;renderTodayV8()};
window.setPlanView=function(v){planView=v;renderPlanV8()};

function isMobile(){return window.matchMedia?.('(max-width:780px)').matches}
function renderNavV8(){
 const nav=document.getElementById('nav');if(!nav)return;
 if(isMobile()){
  const more=['tasks','commitments','habits','goals','calendar','progress','settings','assistant'].includes(page);
  nav.innerHTML=`<button class="${page==='today'?'active':''}" onclick="showPage('today')">☀️ Hoje</button><button class="${page==='plan'?'active':''}" onclick="showPage('plan')">🧭 Planejar</button><button class="${page==='inbox'?'active':''}" onclick="showPage('inbox')">⚡ Inbox</button><button class="${more?'active':''}" onclick="openV8More()">••• Mais</button>`;
 }else{
  const items=[['today','☀️ Hoje'],['plan','🧭 Planejar'],['tasks','📋 Tarefas'],['commitments','📅 Compromissos'],['habits','🔄 Hábitos'],['goals','🎯 Metas'],['calendar','🗓 Calendário'],['inbox','⚡ Inbox'],['assistant','✨ Assistente'],['settings','⚙ Ajustes']];
  nav.innerHTML=items.map(([id,l])=>`<button class="${page===id?'active':''}" onclick="showPage('${id}')">${l}</button>`).join('');
 }
}
window.openV8More=function(){
 openModal('Mais',`<div class="mobile-more-grid v8-more">${[
 ['tasks','📋','Tarefas'],['commitments','📅','Compromissos'],['habits','🔄','Hábitos'],['goals','🎯','Metas SMART'],['calendar','🗓','Calendário'],['assistant','✨','Assistente'],['progress','📈','Progresso'],['settings','⚙','Ajustes']
 ].map(([id,ic,l])=>`<button class="btn" onclick="closeModal();showPage('${id}')">${ic}<span>${l}</span></button>`).join('')}</div>`)
}

function renderV8(){
 ensureV8Shape();renderNavV8();
 const map={today:renderTodayV8,plan:renderPlanV8,commitments:renderCommitmentsV8,goals:renderGoalsV8,calendar:renderCalendarV8,inbox:renderInboxV8,assistant:renderAssistantV8,tasks:renderTasks,habits:renderHabits,progress:renderProgress,settings:renderSettings};
 (map[page]||renderTodayV8)();try{save()}catch{}
}
window.render=renderV8;

function goalById(id){return (data.goals||[]).find(g=>g.id===id)}
function goalTag(goalId){let g=goalById(goalId);return g?`<button class="goal-tag" onclick="showPage('goals');setTimeout(()=>openGoalV8('${g.id}'),0)">🎯 ${esc(g.name)}</button>`:''}
function activeGoals(){return (data.goals||[]).filter(g=>g.status!=='completed')}
function commitmentDate(c){return String(c.start||'').slice(0,10)}
function commitmentTime(c){return String(c.start||'').slice(11,16)}
function isDoneTask(t){return t.status==='done'}
function isTodayTask(t){return !isDoneTask(t)&&t.date===today()}
function isLateTask(t){return !isDoneTask(t)&&t.date&&t.date<today()}
function todayHabitsV8(){return activeHabits().filter(h=>{let cfg=configForDate(h,today());return cfg.freqType==='weekly'?weeklyHabitCount(h)<cfg.weeklyGoal&&!habitPausedOn(h,today()):isHabitScheduled(h,today())})}
function sortTodayItems(items){
 return items.sort((a,b)=>{
  const score=x=>x.late?0:x.priority?1:x.time?2:x.type==='habit'?3:4;
  return score(a)-score(b)||(a.time||'99:99').localeCompare(b.time||'99:99')
 })
}
function todayUnifiedItems(){
 let items=[];
 (data.tasks||[]).filter(t=>isTodayTask(t)||isLateTask(t)).forEach(t=>items.push({type:'task',id:t.id,title:t.name,time:t.startTime||'',late:isLateTask(t),priority:!!t.dayPriority,goalId:t.goalId||'',meta:isLateTask(t)?`Atrasada desde ${fmt(t.date)}`:(t.estimate?mins(t.estimate):'Tarefa de hoje')}));
 (data.commitments||[]).filter(c=>commitmentDate(c)===today()&&c.status!=='cancelled').forEach(c=>items.push({type:'commitment',id:c.id,title:c.title,time:commitmentTime(c),late:false,priority:false,goalId:c.goalId||'',meta:[commitmentTime(c),c.end?String(c.end).slice(11,16):'',c.location||''].filter(Boolean).join(' · ')}));
 todayHabitsV8().forEach(h=>items.push({type:'habit',id:h.id,title:h.name,time:h.time||'',late:false,priority:false,goalId:h.goalId||'',meta:`${frequencyLabel(h)}${h.time?' · '+h.time:''}`}));
 return sortTodayItems(items)
}
function filterLabel(type){return {task:'Tarefa',commitment:'Compromisso',habit:'Hábito'}[type]||type}
function renderTodayItem(x){
 const icon={task:'✓',commitment:'📅',habit:'◉'}[x.type];
 const action=x.type==='task'?`<button class="v8-check" onclick="completeTaskV8('${x.id}')">✓</button>`:x.type==='habit'?`<button class="v8-check" onclick="completeHabitV8('${x.id}')">✓</button>`:`<button class="v8-check neutral" onclick="openCommitmentV8('${x.id}')">›</button>`;
 return `<div class="v8-day-item ${x.late?'late':''} ${x.priority?'priority':''}">${action}<div class="grow"><div class="v8-item-type">${icon} ${filterLabel(x.type)}${x.priority?' · ⭐ Prioridade':''}</div><b>${esc(x.title)}</b><div class="meta">${esc(x.meta||'')}</div>${goalTag(x.goalId)}</div>${x.type==='task'?`<button class="icon-btn" onclick="openTask('${x.id}')">•••</button>`:''}</div>`
}
window.completeTaskV8=function(id){let t=data.tasks.find(x=>x.id===id);if(!t)return;t.status='done';t.completedAt=today();t.updatedAt=new Date().toISOString();save();renderTodayV8();toast('Tarefa concluída')}
window.completeHabitV8=function(id){let h=data.habits.find(x=>x.id===id);if(!h)return;let cfg=configForDate(h,today());setHabitLog(id,today(),cfg.type==='boolean'?1:cfg.target);renderTodayV8();toast('Hábito registrado')}
function dailyBriefing(){
 const tasks=(data.tasks||[]).filter(t=>isTodayTask(t)||isLateTask(t)), late=tasks.filter(isLateTask).length, cs=(data.commitments||[]).filter(c=>commitmentDate(c)===today()).length, hs=todayHabitsV8().length;
 let text=`Hoje você tem ${tasks.length} tarefa(s), ${cs} compromisso(s) e ${hs} hábito(s).`;
 if(late)text+=` ${late} tarefa(s) estão atrasadas.`;
 return text
}
function renderTodayV8(){
 setHeader('☀️ Hoje',new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date()),`<button class="btn" onclick="openQuick()">⚡ Capturar</button><button class="btn primary" onclick="openTask()">＋ Tarefa</button>`);
 let all=todayUnifiedItems(),filtered=all.filter(x=>todayFilter==='all'||x.type===todayFilter),priorities=all.filter(x=>x.type==='task'&&x.priority);
 document.getElementById('content').innerHTML=`
 <div class="v8-ai-brief"><div><b>✨ Seu dia</b><div class="small muted">${dailyBriefing()}</div></div><button class="btn small" onclick="showPage('assistant')">Analisar</button></div>
 ${priorities.length?`<div class="section"><h2>⭐ Prioridades do dia</h2></div><div class="v8-priority-strip">${priorities.map(x=>`<span>${esc(x.title)}</span>`).join('')}</div>`:''}
 <div class="v8-filterbar">${[['all','Todos'],['task','Tarefas'],['commitment','Compromissos'],['habit','Hábitos']].map(([v,l])=>`<button class="${todayFilter===v?'active':''}" onclick="setTodayFilter('${v}')">${l}</button>`).join('')}</div>
 <div class="card v8-day-list">${filtered.length?filtered.map(renderTodayItem).join(''):'<div class="empty">Nada pendente nesta visão.</div>'}</div>
 <div class="v8-goal-glance">🎯 <b>${activeGoals().length}</b> meta(s) ativa(s) · <button onclick="showPage('goals')">ver metas</button></div>`
}

function yearKey(){return String(new Date().getFullYear())}
function monthKeyV8(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function ensureYearPlan(y=yearKey()){data.yearPlans[y]=data.yearPlans[y]||{focus:'',priorities:[],events:[]};return data.yearPlans[y]}
function ensureMonthPlan(k=monthKeyV8()){data.monthPlans[k]=data.monthPlans[k]||{focus:'',priorities:[],events:[],review:''};return data.monthPlans[k]}
function renderPlanV8(){
 setHeader('🧭 Planejar','Ano → Mês → Semana → Hoje',`<button class="btn primary" onclick="savePlanV8()">Salvar</button>`);
 document.getElementById('content').innerHTML=`<div class="v8-segment">${[['week','Semana'],['month','Mês'],['year','Ano']].map(([v,l])=>`<button class="${planView===v?'active':''}" onclick="setPlanView('${v}')">${l}</button>`).join('')}</div><div id="planBody"></div>`;
 document.getElementById('planBody').innerHTML=planView==='year'?yearPlanHTML():planView==='month'?monthPlanHTML():weekPlanHTMLV8()
}
function weekPlanHTMLV8(){
 let wk=weekKey(),p=data.weeklyPlans[wk]||{focus:'',outcomes:[],canWait:''};data.weeklyPlans[wk]=p;
 let days=Array.from({length:7},(_,i)=>addDays(wk,i));
 return `<div class="card form v8-plan-card"><strong>📋 Minha Semana</strong><label>Foco da semana<textarea id="v8WFocus">${esc(p.focus||'')}</textarea></label><label>Até 3 prioridades<textarea id="v8WPrio" placeholder="Uma por linha">${esc((p.outcomes||[]).join('\n'))}</textarea></label><div class="section compact"><h2>7 dias</h2></div><div class="v8-week-grid">${days.map(d=>{let nt=(data.tasks||[]).filter(t=>t.date===d&&t.status!=='done').length,nc=(data.commitments||[]).filter(c=>commitmentDate(c)===d).length;return `<div class="v8-week-day ${d===today()?'today':''}"><b>${new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(dateObj(d))}</b><span>${fmt(d,{day:'2-digit'})}</span><small>${nt} tarefa(s)<br>${nc} compromisso(s)</small></div>`}).join('')}</div><div class="v8-ai-inline">✨ A IA poderá sugerir redistribuição da carga sem alterar nada sem aprovação.</div></div>`
}
function monthPlanHTML(){
 let k=monthKeyV8(),p=ensureMonthPlan(k),label=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date());
 return `<div class="card form v8-plan-card"><strong>📆 Meu Mês — ${label}</strong><label>Foco do mês<textarea id="v8MFocus">${esc(p.focus||'')}</textarea></label><label>Até 3 prioridades<textarea id="v8MPrio" placeholder="Uma por linha">${esc((p.priorities||[]).join('\n'))}</textarea></label><label>Acontecimentos importantes<textarea id="v8MEvents" placeholder="Um por linha">${esc((p.events||[]).join('\n'))}</textarea></label><div class="v8-goal-mini">${activeGoals().map(g=>goalMiniHTML(g)).join('')||'<div class="empty">Nenhuma Meta SMART ativa.</div>'}</div><button class="btn" onclick="showPage('calendar')">🗓 Abrir calendário do mês</button></div>`
}
function yearPlanHTML(){
 let y=yearKey(),p=ensureYearPlan(y),months=Array.from({length:12},(_,i)=>new Date(Number(y),i,1));
 return `<div class="card form v8-plan-card"><strong>🗓 Meu Ano — ${y}</strong><label>Foco do ano<textarea id="v8YFocus">${esc(p.focus||'')}</textarea></label><label>Grandes prioridades<textarea id="v8YPrio" placeholder="Uma por linha">${esc((p.priorities||[]).join('\n'))}</textarea></label><div class="section compact"><h2>Metas SMART</h2></div><div class="v8-goal-mini">${activeGoals().map(g=>goalMiniHTML(g)).join('')||'<div class="empty">Crie suas metas para dar direção ao ano.</div>'}</div><div class="section compact"><h2>12 meses</h2></div><div class="v8-year-grid">${months.map(m=>{let k=monthKeyV8(m),mp=data.monthPlans[k]||{};return `<button onclick="planView='month';renderPlanV8()"><b>${new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(m)}</b><span>${esc(mp.focus||'—')}</span></button>`}).join('')}</div></div>`
}
window.savePlanV8=function(){
 if(planView==='week'){let p=data.weeklyPlans[weekKey()]||{};p.focus=document.getElementById('v8WFocus')?.value||'';p.outcomes=(document.getElementById('v8WPrio')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,3);data.weeklyPlans[weekKey()]=p}
 if(planView==='month'){let p=ensureMonthPlan();p.focus=document.getElementById('v8MFocus')?.value||'';p.priorities=(document.getElementById('v8MPrio')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,3);p.events=(document.getElementById('v8MEvents')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean)}
 if(planView==='year'){let p=ensureYearPlan();p.focus=document.getElementById('v8YFocus')?.value||'';p.priorities=(document.getElementById('v8YPrio')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,5)}
 save();toast('Planejamento salvo')
}

function goalProgress(g){let start=Number(g.startValue)||0,target=Number(g.targetValue)||0,current=Number(g.currentValue)||0;let den=target-start;if(!den)return 0;return Math.max(0,Math.min(100,Math.round((current-start)/den*100)))}
function goalPace(g){
 let start=new Date((g.createdAt||today())+'T12:00:00'),end=new Date((g.deadline||today())+'T12:00:00'),now=new Date(),total=end-start,elapsed=Math.max(0,Math.min(total,now-start)),timePct=total>0?elapsed/total:1,prog=goalProgress(g)/100;
 let label=prog>=1?'Atingida':prog>=timePct+.12?'Adiantada':prog>=timePct-.08?'No ritmo':prog>=timePct-.22?'Atenção':'Atrasada';
 let projected=timePct>0?Math.round((prog/timePct)*100):prog*100;return {label,projected:Math.max(0,projected)}
}
function goalMiniHTML(g){let p=goalProgress(g),pace=goalPace(g);return `<button class="v8-goal-mini-item" onclick="showPage('goals');setTimeout(()=>openGoalV8('${g.id}'),0)"><b>${esc(g.name)}</b><span>${p}% · ${pace.label}</span><i><em style="width:${p}%"></em></i></button>`}
function renderGoalsV8(){
 setHeader('🎯 Metas SMART','Direção, progresso manual e revisão.',`<button class="btn primary" onclick="openGoalV8()">＋ Nova meta</button>`);
 document.getElementById('content').innerHTML=`<div class="grid g4"><div class="card"><div class="label">Ativas</div><div class="metric">${activeGoals().length}</div></div><div class="card"><div class="label">Concluídas</div><div class="metric">${data.goals.filter(g=>g.status==='completed').length}</div></div><div class="card"><div class="label">Precisam atenção</div><div class="metric">${activeGoals().filter(g=>['Atenção','Atrasada'].includes(goalPace(g).label)).length}</div></div><div class="card"><div class="label">Sem atualização</div><div class="metric">${activeGoals().filter(g=>daysSince(g.lastUpdateAt||g.createdAt)>30).length}</div></div></div><div class="section"><h2>Suas metas</h2></div><div class="v8-goal-list">${data.goals.length?data.goals.map(goalCardHTML).join(''):'<div class="card empty">Crie sua primeira Meta SMART.</div>'}</div>`
}
function daysSince(d){if(!d)return 999;return Math.floor((new Date()-new Date(d+'T12:00:00'))/86400000)}
function goalCardHTML(g){let p=goalProgress(g),pace=goalPace(g),updates=data.goalUpdates.filter(u=>u.goalId===g.id).sort((a,b)=>a.date.localeCompare(b.date));return `<div class="card v8-goal-card"><div class="v8-goal-head"><div><div class="label">${esc(g.area||'Meta SMART')}</div><h3>${esc(g.name)}</h3></div><span class="pill">${pace.label}</span></div><div class="v8-goal-values"><b>${esc(g.unit||'')} ${g.currentValue}</b><span>de ${esc(g.unit||'')} ${g.targetValue}</span><strong>${p}%</strong></div><div class="progress"><i style="width:${p}%"></i></div><div class="small muted">Prazo: ${fmt(g.deadline)} · Projeção de ritmo: ${pace.projected}% do alvo até o prazo</div>${updates.length?`<div class="v8-spark">${updates.slice(-8).map(u=>`<span style="height:${Math.max(8,Math.min(100,goalProgress(Object.assign({},g,{currentValue:u.value}))))}%" title="${fmt(u.date)} · ${u.value}"></span>`).join('')}</div>`:''}<div class="actions"><button class="btn small primary" onclick="updateGoalProgressV8('${g.id}')">Atualizar progresso</button><button class="btn small" onclick="openGoalV8('${g.id}')">Detalhes</button></div></div>`}
window.openGoalV8=function(id=''){
 let g=id?goalById(id):{id:'',name:'',specific:'',measure:'',attainable:'',relevant:'',deadline:'',startValue:0,currentValue:0,targetValue:100,unit:'',area:'',reviewFrequency:'monthly',status:'active'};
 openModal(id?'Editar Meta SMART':'Nova Meta SMART',`<form class="form" onsubmit="saveGoalV8(event,'${id}')"><label>S — O que exatamente você quer alcançar?<input name="name" required value="${esc(g.name)}"></label><label>Específica<textarea name="specific" required>${esc(g.specific||'')}</textarea></label><div class="formgrid"><label>M — Como medir?<input name="measure" required value="${esc(g.measure||'')}"></label><label>Unidade<input name="unit" value="${esc(g.unit||'')}"></label><label>Valor inicial<input name="startValue" type="number" step="any" value="${g.startValue}"></label><label>Valor atual<input name="currentValue" type="number" step="any" value="${g.currentValue}"></label><label>Valor-alvo<input name="targetValue" required type="number" step="any" value="${g.targetValue}"></label><label>T — Prazo<input name="deadline" required type="date" value="${esc(g.deadline||'')}"></label></div><label>A — O que torna essa meta possível para você?<textarea name="attainable" required>${esc(g.attainable||'')}</textarea></label><label>R — Por que essa meta é relevante?<textarea name="relevant" required>${esc(g.relevant||'')}</textarea></label><div class="formgrid"><label>Área da vida (opcional)<input name="area" value="${esc(g.area||'')}"></label><label>Revisar<select name="reviewFrequency"><option value="weekly" ${g.reviewFrequency==='weekly'?'selected':''}>Semanalmente</option><option value="biweekly" ${g.reviewFrequency==='biweekly'?'selected':''}>Quinzenalmente</option><option value="monthly" ${g.reviewFrequency==='monthly'?'selected':''}>Mensalmente</option></select></label></div><button class="btn primary">Salvar Meta SMART</button></form>`)
}
window.saveGoalV8=function(e,id){e.preventDefault();let f=new FormData(e.target),g=id?goalById(id):{id:uid(),createdAt:today(),status:'active'};Object.assign(g,{name:f.get('name').trim(),specific:f.get('specific').trim(),measure:f.get('measure').trim(),unit:f.get('unit').trim(),startValue:Number(f.get('startValue')),currentValue:Number(f.get('currentValue')),targetValue:Number(f.get('targetValue')),deadline:f.get('deadline'),attainable:f.get('attainable').trim(),relevant:f.get('relevant').trim(),area:f.get('area').trim(),reviewFrequency:f.get('reviewFrequency')});if(!id)data.goals.push(g);save();closeModal();renderGoalsV8();toast('Meta salva')}
window.updateGoalProgressV8=function(id){let g=goalById(id);if(!g)return;openModal('Atualizar progresso',`<form class="form" onsubmit="saveGoalUpdateV8(event,'${id}')"><div class="callout"><b>${esc(g.name)}</b><div class="meta">Atual: ${g.currentValue} · alvo: ${g.targetValue} ${esc(g.unit||'')}</div></div><label>Novo valor<input name="value" required type="number" step="any" value="${g.currentValue}"></label><label>Observação<textarea name="note" placeholder="O que mudou desde a última atualização?"></textarea></label><button class="btn primary">Registrar evolução</button></form>`)}
window.saveGoalUpdateV8=function(e,id){e.preventDefault();let g=goalById(id),f=new FormData(e.target),v=Number(f.get('value'));g.currentValue=v;g.lastUpdateAt=today();data.goalUpdates.push({id:uid(),goalId:id,date:today(),value:v,note:f.get('note')||''});save();closeModal();if(v>=Number(g.targetValue)){setTimeout(()=>{if(confirm('Meta atingida 🎯\nVocê chegou ao resultado definido. Deseja concluir esta meta?')){g.status='completed';g.completedAt=today();save();renderGoalsV8()}},50)}renderGoalsV8();toast('Progresso atualizado')}

function renderCommitmentsV8(){
 setHeader('📅 Compromissos','Eventos próprios do Planner, com sincronização opcional.',`<button class="btn primary" onclick="openCommitmentV8()">＋ Novo compromisso</button>`);
 let list=[...data.commitments].sort((a,b)=>(a.start||'').localeCompare(b.start||''));
 document.getElementById('content').innerHTML=`<div class="card"><div class="list v8-commit-list">${list.length?list.map(c=>`<div class="item"><div class="grow"><div class="item-title">${esc(c.title)}</div><div class="meta">${fmt(commitmentDate(c),{day:'2-digit',month:'short',year:'numeric'})} · ${commitmentTime(c)}${c.location?' · '+esc(c.location):''}</div>${goalTag(c.goalId)}</div><button class="btn small" onclick="openCommitmentV8('${c.id}')">Editar</button></div>`).join(''):'<div class="empty">Nenhum compromisso cadastrado.</div>'}</div></div>`
}
window.openCommitmentV8=function(id=''){
 let c=id?data.commitments.find(x=>x.id===id):{title:'',start:`${today()}T09:00`,end:`${today()}T10:00`,location:'',link:'',recurrence:'none',calendarSync:true,goalId:''};
 openModal(id?'Editar compromisso':'Novo compromisso',`<form class="form" onsubmit="saveCommitmentV8(event,'${id}')"><label>Título<input name="title" required value="${esc(c.title)}"></label><div class="formgrid"><label>Início<input name="start" type="datetime-local" required value="${esc(c.start)}"></label><label>Fim<input name="end" type="datetime-local" value="${esc(c.end||'')}"></label><label>Local<input name="location" value="${esc(c.location||'')}"></label><label>Link<input name="link" value="${esc(c.link||'')}"></label><label>Recorrência<select name="recurrence"><option value="none">Não repetir</option><option value="weekly" ${c.recurrence==='weekly'?'selected':''}>Semanal</option><option value="monthly" ${c.recurrence==='monthly'?'selected':''}>Mensal</option></select></label><label>Meta relacionada<select name="goalId"><option value="">Nenhuma</option>${activeGoals().map(g=>`<option value="${g.id}" ${c.goalId===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label></div><label style="display:flex;align-items:center;gap:8px"><input name="calendarSync" type="checkbox" style="width:auto" ${c.calendarSync!==false?'checked':''}> Sincronizar com Google Agenda</label><button class="btn primary">Salvar compromisso</button></form>`)
}
window.saveCommitmentV8=function(e,id){e.preventDefault();let f=new FormData(e.target),c=id?data.commitments.find(x=>x.id===id):{id:uid(),createdAt:new Date().toISOString(),status:'active'};Object.assign(c,{title:f.get('title').trim(),start:f.get('start'),end:f.get('end'),location:f.get('location').trim(),link:f.get('link').trim(),recurrence:f.get('recurrence'),goalId:f.get('goalId')||'',calendarSync:f.get('calendarSync')==='on',updatedAt:new Date().toISOString()});if(!id)data.commitments.push(c);save();closeModal();renderCommitmentsV8();toast('Compromisso salvo')}

function calendarItemsForDate(d){return [
 ...(data.tasks||[]).filter(t=>t.date===d&&t.status!=='done').map(t=>({type:'task',label:t.name})),
 ...(data.commitments||[]).filter(c=>commitmentDate(c)===d&&c.status!=='cancelled').map(c=>({type:'commitment',label:`${commitmentTime(c)} ${c.title}`})),
 ...activeGoals().filter(g=>g.deadline===d).map(g=>({type:'goal',label:`Prazo: ${g.name}`}))
 ]}
function renderCalendarV8(){
 let y=calendarCursor.getFullYear(),m=calendarCursor.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),offset=(first.getDay()+6)%7,cells=[];
 for(let i=0;i<offset;i++)cells.push('<div class="v8-cal-day ghost"></div>');
 for(let n=1;n<=last.getDate();n++){let d=iso(new Date(y,m,n)),items=calendarItemsForDate(d);cells.push(`<div class="v8-cal-day ${d===today()?'today':''}"><b>${n}</b>${items.slice(0,3).map(x=>`<span class="${x.type}">${esc(x.label)}</span>`).join('')}${items.length>3?`<small>+${items.length-3}</small>`:''}</div>`)}
 setHeader('🗓 Calendário',new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(calendarCursor),`<button class="btn" onclick="shiftCalendarV8(-1)">←</button><button class="btn" onclick="shiftCalendarV8(1)">→</button>`);
 document.getElementById('content').innerHTML=`<div class="v8-filterbar"><button class="active">Todos</button><button>Tarefas</button><button>Compromissos</button><button>Hábitos</button><button>Metas</button></div><div class="card v8-calendar"><div class="v8-cal-dow">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=>`<b>${x}</b>`).join('')}</div><div class="v8-cal-grid">${cells.join('')}</div></div>`
}
window.shiftCalendarV8=function(delta){calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+delta,1);renderCalendarV8()}

function renderInboxV8(){
 setHeader('⚡ Inbox','Capture por texto ou voz. Organize depois.',`<button class="btn" onclick="startVoiceCaptureV8()">🎙 Falar</button><button class="btn primary" onclick="openQuick()">＋ Digitar</button>`);
 let list=data.inbox.filter(x=>x.state!=='discarded');
 document.getElementById('content').innerHTML=`<div class="card inbox-card"><div class="list inbox-list">${list.length?list.map(x=>`<div class="inbox-item"><div class="grow"><div class="item-title">${esc(x.text)}</div><div class="meta">${new Date(x.createdAt).toLocaleString('pt-BR')} · ${x.source==='voice'?'🎙 Voz':'⌨ Texto'}</div></div><div class="v8-inbox-actions"><button onclick="classifyInboxV8('${x.id}','task')">✓ Tarefa</button><button onclick="classifyInboxV8('${x.id}','commitment')">📅 Compromisso</button><button onclick="classifyInboxV8('${x.id}','habit')">◉ Hábito</button><button onclick="classifyInboxV8('${x.id}','goal')">🎯 Meta</button><button onclick="classifyInboxV8('${x.id}','discard')">🗑</button></div></div>`).join(''):'<div class="empty">Inbox vazia.</div>'}</div></div>`
}
window.classifyInboxV8=function(id,type){let x=data.inbox.find(i=>i.id===id);if(!x)return;if(type==='discard'){x.state='discarded';save();renderInboxV8();return}if(type==='task'){data.tasks.push({id:uid(),name:x.text,date:today(),startTime:'',estimate:30,actual:0,status:'todo',project:'Geral',category:'Pessoal',reschedules:0,createdAt:today(),updatedAt:new Date().toISOString(),goalId:'',dayPriority:false,calendarSync:true});x.state='organized';save();renderInboxV8();toast('Virou tarefa');return}if(type==='commitment'){openCommitmentFromInboxV8(x);return}if(type==='habit'){openHabitFromInboxV8(x);return}if(type==='goal'){openGoalFromInboxV8(x);return}}
function openCommitmentFromInboxV8(x){openModal('Transformar em compromisso',`<form class="form" onsubmit="saveInboxCommitmentV8(event,'${x.id}')"><label>Título<input name="title" value="${esc(x.text)}" required></label><label>Início<input name="start" type="datetime-local" value="${today()}T09:00" required></label><button class="btn primary">Criar compromisso</button></form>`)}
window.saveInboxCommitmentV8=function(e,id){e.preventDefault();let f=new FormData(e.target),x=data.inbox.find(i=>i.id===id);data.commitments.push({id:uid(),title:f.get('title'),start:f.get('start'),end:'',status:'active',recurrence:'none',calendarSync:true,createdAt:new Date().toISOString()});x.state='organized';save();closeModal();renderInboxV8();toast('Compromisso criado')}
function openHabitFromInboxV8(x){closeModal();showPage('habits');setTimeout(()=>{openHabit();let input=document.querySelector('#modal input[name="name"]');if(input)input.value=x.text;x.state='organized';save()},50)}
function openGoalFromInboxV8(x){openGoalV8();setTimeout(()=>{let input=document.querySelector('#modal input[name="name"]');if(input)input.value=x.text;x.state='organized';save()},20)}
window.startVoiceCaptureV8=function(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('Reconhecimento de voz não está disponível neste navegador.');return}let r=new SR();r.lang='pt-BR';r.interimResults=false;r.onresult=e=>{let text=e.results[0][0].transcript;data.inbox.push({id:uid(),text,source:'voice',state:'open',createdAt:new Date().toISOString()});save();renderInboxV8();toast('Captura por voz adicionada')};r.onerror=()=>toast('Não foi possível reconhecer a fala');r.start();toast('Pode falar…')
}

function renderAssistantV8(){
 setHeader('✨ Assistente','Analisa e sugere. Você aprova qualquer mudança.',`<button class="btn" onclick="startAssistantVoiceV8()">🎙 Falar</button>`);
 document.getElementById('content').innerHTML=`<div class="card v8-assistant"><div id="assistantLog" class="v8-chat">${assistantMessages.length?assistantMessages.map(m=>`<div class="${m.role}">${esc(m.text)}</div>`).join(''):'<div class="assistant">Posso ajudar a organizar seu dia, analisar sua semana, revisar metas ou interpretar uma captura.</div>'}</div><form onsubmit="sendAssistantV8(event)" class="v8-chat-form"><input name="message" required placeholder="Ex.: meu dia está pesado?" autocomplete="off"><button class="btn primary">Enviar</button></form><div class="v8-assistant-chips"><button onclick="askAssistantV8('Organize meu dia')">Organizar meu dia</button><button onclick="askAssistantV8('Analise minha semana')">Analisar semana</button><button onclick="askAssistantV8('Quais metas precisam de atenção?')">Revisar metas</button></div></div>`
}
function localAssistantAnswer(q){
 const lower=q.toLowerCase(),late=data.tasks.filter(isLateTask).length,items=todayUnifiedItems(),attention=activeGoals().filter(g=>['Atenção','Atrasada'].includes(goalPace(g).label));
 if(lower.includes('dia'))return `${dailyBriefing()} ${late?'Eu priorizaria resolver ou reagendar as atrasadas antes de adicionar novas tarefas.':''}`;
 if(lower.includes('semana'))return `Nesta semana existem ${data.tasks.filter(t=>t.date>=weekKey()&&t.date<=addDays(weekKey(),6)&&t.status!=='done').length} tarefas pendentes. Posso sugerir redistribuição, mas cada mudança precisa da sua aprovação.`;
 if(lower.includes('meta'))return attention.length?`${attention.length} meta(s) merecem atenção: ${attention.map(g=>g.name).join(', ')}.`:'Suas metas ativas não apresentam atraso relevante pelo ritmo atual.';
 return `Entendi. Hoje há ${items.length} item(ns) ativos. Posso transformar isso em uma sugestão de organização sem alterar seus dados automaticamente.`
}
window.sendAssistantV8=async function(e){e.preventDefault();let input=e.target.message,q=input.value.trim();if(!q)return;input.value='';assistantMessages.push({role:'user',text:q});renderAssistantV8();let answer='';try{let res=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,context:{today:today(),tasks:data.tasks,commitments:data.commitments,habits:data.habits,goals:data.goals,weeklyPlan:data.weeklyPlans[weekKey()]||{}}})});if(res.ok){let j=await res.json();answer=j.text||''}}catch{}if(!answer)answer=localAssistantAnswer(q);assistantMessages.push({role:'assistant',text:answer});renderAssistantV8()}
window.askAssistantV8=function(q){let fake={preventDefault(){},target:{message:{value:q}}};sendAssistantV8(fake)}
window.startAssistantVoiceV8=function(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('Reconhecimento de voz indisponível.');return}let r=new SR();r.lang='pt-BR';r.onresult=e=>askAssistantV8(e.results[0][0].transcript);r.start();toast('Pode falar…')}

// Vincular meta a tarefas/hábitos sem alterar progresso automaticamente.
const originalOpenTask=window.openTask;
if(originalOpenTask){window.openTask=function(id){originalOpenTask(id);setTimeout(()=>injectGoalSelect('#modal form',id?'task':'task',id),0)}}
function injectGoalSelect(formSelector,type,id){let form=document.querySelector(formSelector);if(!form||form.querySelector('[name="goalId"]'))return;let current='';if(type==='task'&&id)current=(data.tasks.find(x=>x.id===id)||{}).goalId||'';let label=document.createElement('label');label.innerHTML=`Meta SMART relacionada<select name="goalId"><option value="">Nenhuma</option>${activeGoals().map(g=>`<option value="${g.id}" ${current===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select>`;let btn=form.querySelector('button.primary:last-child');if(btn)form.insertBefore(label,btn);else form.appendChild(label)}

// Captura rápida existente continua válida, mas marca origem.
const originalCapture=window.capture;
if(originalCapture){window.capture=function(e){let before=data.inbox.length;originalCapture(e);for(let i=before;i<data.inbox.length;i++){data.inbox[i].source='text';data.inbox[i].state='open'}save();if(page==='inbox')renderInboxV8()}}

renderV8();
})();
