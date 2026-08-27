function editDayPlan(){openPriorityPicker()}
function renderClosedDay(plan){
 let ts=todayTasks(),pending=ts.filter(t=>t.status!=="done"),done=ts.length-pending.length;
 return `<div class="callout ok"><b>✓ Dia encerrado</b><div class="muted">Você pode reabrir o dia se precisar ajustar algo.</div></div>
 <div class="section"><h2>Resumo</h2><button class="btn small" onclick="reopenDay()">Reabrir dia</button></div>
 <div class="grid g3">
   <div class="card"><div class="label">Concluídas</div><div class="metric">${done}</div></div>
   <div class="card"><div class="label">Pendentes</div><div class="metric">${pending.length}</div></div>
   <div class="card"><div class="label">Humor</div><div class="metric">${plan.mood||"—"}</div></div>
 </div>
 <div class="section"><h2>Reflexão</h2></div><div class="card"><p><b>O que funcionou:</b><br>${esc(plan.review||"—")}</p><p><b>O que atrapalhou:</b><br>${esc(plan.blocker||"—")}</p></div>
 ${pending.length?`<div class="section"><h2>Pendências</h2></div><div class="card"><div class="list">${pending.map(taskRow).join("")}</div></div>`:""}`
}
function reopenDay(){let p=getPlan();p.closed=false;p.started=true;save();render()}
function openCloseDay(){
 let p=getPlan();openModal("🌙 Fechar o dia",`<form class="form" onsubmit="closeDay(event)">
 <label>Como foi seu dia?<div class="mood">${["😫","😕","😐","🙂","😄"].map(m=>`<button type="button" class="${p.mood===m?"selected":""}" onclick="document.querySelectorAll('.mood button').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');document.getElementById('moodVal').value='${m}'">${m}</button>`).join("")}</div><input type="hidden" id="moodVal" name="mood" value="${p.mood||""}"></label>
 <label>O que funcionou?<textarea name="review">${esc(p.review||"")}</textarea></label>
 <label>O que atrapalhou?<textarea name="blocker">${esc(p.blocker||"")}</textarea></label>
 <button class="btn primary">Encerrar dia</button></form>`)
}
function closeDay(e){e.preventDefault();let f=new FormData(e.target),p=getPlan();p.mood=f.get("mood");p.review=f.get("review");p.blocker=f.get("blocker");p.closed=true;p.started=true;data.history.push({type:"day-close",date:today(),at:new Date().toISOString()});save();closeModal();render();toast("Dia encerrado")}

function recurrenceLabel(t){return {daily:"Todos os dias",weekdays:"Dias úteis",specific:"Dias específicos",weekly:"Toda semana",monthly:"Todo mês"}[t.recurrence]||""}
function taskMini(t){return `<div class="card"><span class="prio ${t.priority}"></span><h3>${esc(t.name)}</h3><div class="meta">${esc(t.category||"Pessoal")}${recurrenceLabel(t)?` · ↻ ${recurrenceLabel(t)}`:""}</div>${t.status==="done"?'<span class="pill ok">Concluída</span>':`<button class="btn small primary" style="margin-top:10px" onclick="toggleTask('${t.id}')">Concluir</button>`}</div>`}
function taskRow(t){
 let late=t.status!=="done"&&t.date<today();
 return `<div class="item ${t.status==="done"?"done":""}">
 <button class="check ${t.status==="done"?"done":""}" onclick="toggleTask('${t.id}')"></button><span class="prio ${t.priority}"></span>
 <div class="grow"><div class="item-title">${esc(t.name)}</div><div class="meta">${esc(t.category||"Pessoal")} · ${fmt(t.date)}${t.startTime?` às ${esc(t.startTime)}`:" · dia inteiro"}${recurrenceLabel(t)?` · ↻ ${recurrenceLabel(t)}`:""}${t.reschedules?` · reagendada ${t.reschedules}x`:""}${t.googleEventId?" · Google Agenda":""}</div>${t.notes?`<div class="small muted" style="margin-top:4px">${esc(t.notes)}</div>`:""}</div>
 ${late?'<span class="pill danger">Atrasada</span>':""}
 ${t.reschedules>=3?'<span class="pill warn">Procrastinação?</span>':""}
 <button class="btn small" onclick="openTask('${t.id}')">Editar</button><button class="btn small" onclick="openReschedule('${t.id}')">Reagendar</button>
 </div>`
}
function toggleTask(id){
 let t=data.tasks.find(x=>x.id===id);if(!t)return;
 if(t.status==="done"){t.status="todo";t.completedAt=null;t.actual=0;t.updatedAt=new Date().toISOString();save();render();return}
 openModal("Concluir tarefa",`<form class="form" onsubmit="completeTask(event,'${id}')"><div class="callout"><b>${esc(t.name)}</b></div><button class="btn ok">Concluir tarefa</button></form>`)
}
function nextRecurringDate(t){
 let d=t.date||today();if(t.recurrence==="daily")return addDays(d,1);if(t.recurrence==="weekdays"){do{d=addDays(d,1)}while(weekDayNum(d)>5);return d}if(t.recurrence==="specific"){do{d=addDays(d,1)}while(!(t.recurrenceDays||[]).map(Number).includes(weekDayNum(d)));return d}if(t.recurrence==="weekly")return addDays(d,7);if(t.recurrence==="monthly"){let base=dateObj(d),day=base.getDate();base.setDate(1);base.setMonth(base.getMonth()+1);let last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();base.setDate(Math.min(day,last));return iso(base)}return ""
}
function completeTask(e,id){e.preventDefault();let t=data.tasks.find(x=>x.id===id);t.status="done";t.actual=0;t.completedAt=today();t.updatedAt=new Date().toISOString();data.history.push({type:"task-done",taskId:id,date:today()});let nextDate=nextRecurringDate(t);if(nextDate){let next=Object.assign({},t,{id:uid(),date:nextDate,status:"todo",actual:0,completedAt:null,reschedules:0,createdAt:today(),updatedAt:new Date().toISOString(),googleEventId:null});data.tasks.push(next)}save();closeModal();render();toast(nextDate?"Concluída. Próxima ocorrência criada.":"Tarefa concluída")}
function openTask(id){
 let t=id?data.tasks.find(x=>x.id===id):{name:"",date:today(),startTime:"",priority:"normal",category:"Pessoal",notes:"",taskType:"single",recurrence:"none",calendarSync:false};if(!t)return;
 openModal(id?"Editar tarefa":"Nova tarefa",`<form class="form" onsubmit="saveTask(event,'${id||""}')"><div class="formgrid">
 <label class="full">Tarefa<input name="name" required value="${esc(t.name)}" placeholder="Ex.: Preparar proposta para o cliente"></label>
 <label>Categoria<select name="category">${categoryOptions(t.category||"Pessoal")}</select><button type="button" class="btn small" onclick="addQuickCategory('category')">＋ Nova categoria</button></label>
 <label>Tipo<select name="taskType"><option value="single" ${t.taskType!=="recurring"?"selected":""}>Tarefa única</option><option value="recurring" ${t.taskType==="recurring"?"selected":""}>Tarefa recorrente</option></select></label>
 <label>Repetição<select name="recurrence"><option value="none" ${!t.recurrence||t.recurrence==="none"?"selected":""}>Não repetir</option><option value="daily" ${t.recurrence==="daily"?"selected":""}>Todos os dias</option><option value="weekdays" ${t.recurrence==="weekdays"?"selected":""}>Dias úteis</option><option value="specific" ${t.recurrence==="specific"?"selected":""}>Dias específicos</option><option value="weekly" ${t.recurrence==="weekly"?"selected":""}>Toda semana</option><option value="monthly" ${t.recurrence==="monthly"?"selected":""}>Todo mês</option></select><span class="small muted">Ao concluir, a próxima ocorrência é criada automaticamente.</span></label>
 <div class="full"><span class="muted small">Dias específicos</span><div class="daychecks">${[[1,"Seg"],[2,"Ter"],[3,"Qua"],[4,"Qui"],[5,"Sex"],[6,"Sáb"],[7,"Dom"]].map(([n,l])=>`<label><input type="checkbox" name="recurrenceDays" value="${n}" ${(t.recurrenceDays||[]).map(Number).includes(n)?"checked":""}>${l}</label>`).join("")}</div></div>
 <label>Data<input name="date" type="date" value="${esc(t.date||today())}"></label>
 <label>Horário opcional<input name="startTime" type="time" value="${esc(t.startTime||"")}"><span class="small muted">Sem horário, aparece como evento de dia inteiro.</span></label>
 <label>Lembrete antes<select name="reminderLead"><option value="" ${t.reminderLead==null?"selected":""}>Usar padrão das configurações</option><option value="0" ${String(t.reminderLead)==="0"?"selected":""}>Sem antecedência</option><option value="5" ${String(t.reminderLead)==="5"?"selected":""}>5 minutos</option><option value="10" ${String(t.reminderLead)==="10"?"selected":""}>10 minutos</option><option value="15" ${String(t.reminderLead)==="15"?"selected":""}>15 minutos</option><option value="30" ${String(t.reminderLead)==="30"?"selected":""}>30 minutos</option><option value="60" ${String(t.reminderLead)==="60"?"selected":""}>1 hora</option></select></label>
 <label>Prioridade<select name="priority"><option value="important" ${t.priority==="important"||t.priority==="high"||t.priority==="critical"?"selected":""}>Importante</option><option value="normal" ${t.priority==="normal"||t.priority==="low"?"selected":""}>Normal</option></select></label>
 <label class="full">Detalhes / observações<textarea name="notes" placeholder="O que preciso lembrar para executar?">${esc(t.notes||"")}</textarea></label>
 <label style="display:flex;align-items:center;gap:8px"><input name="reminderEnabled" type="checkbox" ${t.reminderEnabled!==false?"checked":""} style="width:auto"> Enviar lembrete</label>
 <label style="display:flex;align-items:center;gap:8px"><input name="calendarSync" type="checkbox" ${t.calendarSync!==false?"checked":""} style="width:auto"> Sincronizar com Google Agenda</label></div><button class="btn primary">${id?"Salvar alterações":"Criar tarefa"}</button></form>`)
}
function saveTask(e,id){e.preventDefault();let f=new FormData(e.target),now=new Date().toISOString(),recurrence=f.get("taskType")==="recurring"&&f.get("recurrence")!=="none"?f.get("recurrence"):"none",next={name:f.get("name").trim(),date:f.get("date")||today(),startTime:f.get("startTime")||"",estimate:0,priority:f.get("priority"),project:"",category:f.get("category")||"Pessoal",nextAction:"",notes:f.get("notes")||"",taskType:recurrence!=="none"?"recurring":"single",recurrence,recurrenceDays:f.getAll("recurrenceDays").map(Number),updatedAt:now,calendarSync:f.get("calendarSync")==="on",reminderEnabled:f.get("reminderEnabled")==="on",reminderLead:f.get("reminderLead")===""?null:Number(f.get("reminderLead"))};
 if(id){let task=data.tasks.find(x=>x.id===id);if(!task)return;Object.assign(task,next)}else data.tasks.push(Object.assign({id:uid(),actual:0,status:"todo",reschedules:0,createdAt:today()},next));
 save();closeModal();render();toast(id?"Tarefa atualizada":"Tarefa criada")}
function openReschedule(id){
 let t=data.tasks.find(x=>x.id===id);openModal("Reagendar tarefa",`<div class="callout ${t.reschedules>=3?"warn":""}"><b>${esc(t.name)}</b><div class="meta">Já foi reagendada ${t.reschedules||0} vez(es).</div>${t.reschedules>=3?'<p>Essa tarefa pode estar grande demais ou pouco clara. Considere dividi-la.</p>':""}</div>
 <div class="grid g2" style="margin-top:12px"><button class="btn" onclick="reschedule('${id}','${today()}')">Hoje</button><button class="btn" onclick="reschedule('${id}','${addDays(today(),1)}')">Amanhã</button><button class="btn" onclick="reschedule('${id}','${addDays(today(),7)}')">Próxima semana</button><button class="btn warn" onclick="splitTask('${id}')">Dividir tarefa</button></div>`)
}
