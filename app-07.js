function reschedule(id,d){let t=data.tasks.find(x=>x.id===id);t.date=d;t.reschedules=(t.reschedules||0)+1;t.updatedAt=new Date().toISOString();data.history.push({type:"reschedule",taskId:id,date:d});save();closeModal();render();toast("Tarefa reagendada")}
function splitTask(id){
 let t=data.tasks.find(x=>x.id===id);openModal("Dividir tarefa",`<form class="form" onsubmit="saveSplit(event,'${id}')"><div class="callout"><b>${esc(t.name)}</b></div><label>Subtarefas — uma por linha<textarea name="parts" placeholder="Primeiro passo&#10;Segundo passo&#10;Terceiro passo"></textarea></label><button class="btn primary">Criar tarefas menores</button></form>`)
}
function saveSplit(e,id){e.preventDefault();let t=data.tasks.find(x=>x.id===id),parts=new FormData(e.target).get("parts").split("\n").map(x=>x.trim()).filter(Boolean),now=new Date().toISOString();parts.forEach(p=>data.tasks.push({id:uid(),name:p,date:t.date,startTime:"",estimate:Math.max(10,Math.round(t.estimate/Math.max(parts.length,1))),actual:0,priority:t.priority,status:"todo",project:t.project,category:t.category||"Pessoal",nextAction:"",notes:t.notes||"",taskType:"single",recurrence:"none",reschedules:0,createdAt:today(),updatedAt:now,calendarSync:t.calendarSync!==false}));t.status="done";t.actual=0;t.completedAt=today();t.updatedAt=now;save();closeModal();render();toast("Tarefa dividida")}

function renderTasks(){
 setHeader("📋 Tarefas","Planeje, execute e reavalie o que não anda.",`<button class="btn primary" onclick="openTask()">＋ Nova tarefa</button>`);
 let all=[...data.tasks].sort((a,b)=>(a.status==="done")-(b.status==="done")||a.date.localeCompare(b.date));
 let projects=[...new Set(all.map(t=>t.project||"Geral"))].sort((a,b)=>a.localeCompare(b,"pt-BR")),taskCategories=[...new Set(all.map(t=>t.category||"Pessoal"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 document.getElementById("content").innerHTML=`<div class="grid g4">
 <div class="card"><div class="label">Pendentes</div><div class="metric">${all.filter(t=>t.status!=="done").length}</div></div>
 <div class="card"><div class="label">Atrasadas</div><div class="metric">${all.filter(t=>t.status!=="done"&&t.date<today()).length}</div></div>
 <div class="card"><div class="label">Reagendadas 3x+</div><div class="metric">${all.filter(t=>t.reschedules>=3&&t.status!=="done").length}</div></div>
 <div class="card"><div class="label">Concluídas</div><div class="metric">${all.filter(t=>t.status==="done").length}</div></div></div>
 <div class="section"><h2>Pesquisar e filtrar</h2></div><div class="card task-tools">
 <label>Pesquisar<input id="taskSearch" value="${esc(taskSearch)}" placeholder="Nome ou projeto" oninput="applyTaskFilters()"></label>
 <label>Situação<select id="taskStatusFilter" onchange="applyTaskFilters()"><option value="all">Todas</option><option value="pending">Pendentes</option><option value="today">Hoje</option><option value="late">Atrasadas</option><option value="done">Concluídas</option></select></label>
 <label>Prioridade<select id="taskPriorityFilter" onchange="applyTaskFilters()"><option value="all">Todas</option><option value="critical">Crítica</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select></label>
 <label>Categoria<select id="taskCategoryFilter" onchange="applyTaskFilters()"><option value="all">Todas</option>${taskCategories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join("")}</select></label>
 <label>Projeto<select id="taskProjectFilter" onchange="applyTaskFilters()"><option value="all">Todos</option>${projects.map(project=>`<option value="${esc(project)}">${esc(project)}</option>`).join("")}</select></label>
 <button class="btn" onclick="clearTaskFilters()">Limpar</button></div>
 <div class="section"><h2>Tarefas <span class="small muted" id="taskResultCount"></span></h2></div><div class="card"><div class="list" id="taskList"></div></div>`;
 ["taskStatusFilter","taskPriorityFilter","taskCategoryFilter","taskProjectFilter"].forEach((id,index)=>{const el=document.getElementById(id);if(el)el.value=[taskStatusFilter,taskPriorityFilter,taskCategoryFilter,taskProjectFilter][index]});applyTaskFilters()
}
function filteredTasks(){
 const query=taskSearch.trim().toLocaleLowerCase("pt-BR");
 return [...data.tasks].sort((a,b)=>(a.status==="done")-(b.status==="done")||a.date.localeCompare(b.date)).filter(t=>{
   const searchOk=!query||`${t.name} ${t.project||"Geral"} ${t.category||"Pessoal"} ${t.nextAction||""} ${t.notes||""}`.toLocaleLowerCase("pt-BR").includes(query);
   const statusOk=taskStatusFilter==="all"||(taskStatusFilter==="pending"&&t.status!=="done")||(taskStatusFilter==="done"&&t.status==="done")||(taskStatusFilter==="today"&&t.status!=="done"&&t.date===today())||(taskStatusFilter==="late"&&t.status!=="done"&&t.date<today());
   return searchOk&&statusOk&&(taskPriorityFilter==="all"||t.priority===taskPriorityFilter)&&(taskCategoryFilter==="all"||(t.category||"Pessoal")===taskCategoryFilter)&&(taskProjectFilter==="all"||(t.project||"Geral")===taskProjectFilter)
 })
}
function applyTaskFilters(){
 const search=document.getElementById("taskSearch"),status=document.getElementById("taskStatusFilter"),priority=document.getElementById("taskPriorityFilter"),category=document.getElementById("taskCategoryFilter"),project=document.getElementById("taskProjectFilter");
 if(search)taskSearch=search.value;if(status)taskStatusFilter=status.value;if(priority)taskPriorityFilter=priority.value;if(category)taskCategoryFilter=category.value;if(project)taskProjectFilter=project.value;
 const filtered=filteredTasks(),list=document.getElementById("taskList"),count=document.getElementById("taskResultCount");
 if(list)list.innerHTML=filtered.length?filtered.map(taskRow).join(""):`<div class="empty">Nenhuma tarefa encontrada com estes filtros.</div>`;
 if(count)count.textContent=`${filtered.length} resultado(s)`
}
function clearTaskFilters(){taskSearch="";taskStatusFilter="all";taskPriorityFilter="all";taskCategoryFilter="all";taskProjectFilter="all";renderTasks()}



function configForDate(h,d){
 let hist=(h.configHistory||[]).slice().sort((a,b)=>a.from.localeCompare(b.from));
 let cfg=hist[0]||h;
 for(let x of hist){if(x.from<=d)cfg=x;else break}
 return Object.assign({},h,cfg)
}
function isPausedHistorically(h,d){
 if((h.pauseHistory||[]).some(p=>p.from<=d&&(!p.to||d<=p.to)))return true;
 if(h.paused){
   if(!h.pauseUntil)return d>=today();
   return d>=today()&&d<=h.pauseUntil
 }
 return false
}
function isFutureDate(d){return d>today()}
function endOfWeek(s=weekKey()){return addDays(s,6)}
function completedWeekBefore(d=today()){let w=weekKey(d);return addDays(w,-7)}
function weekComplete(start){return endOfWeek(start)<today()}

function weekDayNum(d){let n=dateObj(d).getDay();return n===0?7:n}
function habitPausedOn(h,d=today()){return isPausedHistorically(h,d)}
function isHabitScheduled(h,d=today()){
 if(h.archived||habitPausedOn(h,d)||isFutureDate(d))return false;
 let cfg=configForDate(h,d),wd=weekDayNum(d);
 if(cfg.freqType==="daily")return true;
 if(cfg.freqType==="weekdays")return wd<=5;
 if(cfg.freqType==="specific")return (cfg.specificDays||[]).map(Number).includes(wd);
 if(cfg.freqType==="weekly")return true;
 return true
}
function habitState(h,d=today()){
 let cfg=configForDate(h,d),v=habitLog(h.id,d);
 if(v<=0)return "none";
 if(cfg.type==="boolean")return v>=1?"complete":"none";
 if(v>=cfg.target)return "complete";
 if(v>=cfg.minTarget)return "partial";
 return "started"
}
function stateLabel(h,d=today()){let s=habitState(h,d);return {complete:"Meta desejada",partial:"Piso viável",started:"Em andamento",none:"Sem registro"}[s]}
function frequencyLabel(h){
 if(h.freqType==="daily")return "Todos os dias";
 if(h.freqType==="weekdays")return "Dias úteis";
 if(h.freqType==="specific"){let names=["","Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];return (h.specificDays||[]).map(x=>names[Number(x)]).join(", ")||"Dias específicos"}
 if(h.freqType==="weekly")return `${h.weeklyGoal}x por semana`;
 return "Personalizado"
}
function habitGoalLabel(h,d=today()){
 let cfg=configForDate(h,d);
 if(cfg.type==="boolean")return "Feito / não feito";
 if(cfg.freqType==="weekly")return `Compromisso: ${cfg.weeklyGoal} dia(s) por semana`;
 return `Piso ${cfg.minTarget} · meta ${cfg.target} ${cfg.unit}`
}
function periodLabel(h){return {any:"Qualquer período",morning:"Manhã",afternoon:"Tarde",evening:"Noite"}[h.period]||h.period||"Qualquer período"}
function activeHabits(){return data.habits.filter(h=>!h.archived).sort((a,b)=>a.order-b.order)}
function archivedHabits(){return data.habits.filter(h=>h.archived).sort((a,b)=>a.order-b.order)}
function habitWeeklySuccess(h,start=weekKey()){
 let cfg=configForDate(h,start),complete=0;
 for(let i=0;i<7;i++){let d=addDays(start,i);if(d>today())continue;if(habitState(h,d)==="complete")complete++}
 return complete>=cfg.weeklyGoal
}
function streakInfo(h){
 let cfg=configForDate(h,today());
 if(cfg.freqType==="weekly"){
   let count=0,w=weekKey();
   if(!weekComplete(w))w=addDays(w,-7);
   while(habitWeeklySuccess(h,w)){count++;w=addDays(w,-7)}
   return {count,unit:count===1?"semana":"semanas"}
 }
 let count=0,d=addDays(today(),-1),guard=0;
 if(habitState(h,today())==="complete"||habitState(h,today())==="partial")d=today();
 while(guard++<365){
   if(!isHabitScheduled(h,d)){d=addDays(d,-1);continue}
   let st=habitState(h,d);
   if(st==="complete"||st==="partial"){count++;d=addDays(d,-1);continue}
   break
 }
 return {count,unit:count===1?"dia":"dias"}
}
function bestStreakInfo(h){
 let cfg=configForDate(h,today());
 if(cfg.freqType==="weekly"){
   let best=0,cur=0,start=addDays(weekKey(),-7*25);
   for(let i=0;i<26;i++){let w=addDays(start,i*7);if(!weekComplete(w))continue;if(habitWeeklySuccess(h,w)){cur++;best=Math.max(best,cur)}else cur=0}
   return {count:best,unit:best===1?"semana":"semanas"}
 }
 let best=0,cur=0;
 recentDays(180).forEach(d=>{
   if(isFutureDate(d)||!isHabitScheduled(h,d))return;
   let s=habitState(h,d);
   if(s==="complete"||s==="partial"){cur++;best=Math.max(best,cur)}else cur=0
 });
 return {count:best,unit:best===1?"dia":"dias"}
}
function scheduledDaysInRange(h,days){return days.filter(d=>!isFutureDate(d)&&isHabitScheduled(h,d))}
