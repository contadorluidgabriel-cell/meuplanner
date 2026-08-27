function openHabitCalendar(id,key=monthKeyFromDate(new Date())){
 let h=data.habits.find(x=>x.id===id);if(!h)return;
 let [y,m]=key.split("-").map(Number),first=new Date(y,m-1,1),last=new Date(y,m,0),start=(first.getDay()+6)%7,stats=habitMonthStats(h,key),cells=[];
 for(let i=0;i<start;i++)cells.push(`<button class="habit-month-day muted" disabled></button>`);
 for(let day=1;day<=last.getDate();day++){
   let d=`${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`,v=habitLog(h.id,d),s=habitState(h,d),future=isFutureDate(d),scheduled=isHabitScheduled(h,d),cfg=configForDate(h,d);
   cells.push(`<button class="habit-month-day ${s} ${d===today()?"today":""} ${future?"muted":""}" ${future?"disabled":""} style="${!future&&!scheduled?"opacity:.4":""}" onclick="editHabitDay('${h.id}','${d}','${key}')"><div class="dnum">${day}</div><div class="dval">${future?"Futuro":!scheduled?"Descanso":v>0?`${v} ${esc(cfg.unit)} · ${stateLabel(h,d)}`:"Sem registro"}</div></button>`)
 }
 let recent=[];
 for(let day=last.getDate();day>=1&&recent.length<10;day--){let d=`${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`,v=habitLog(h.id,d);if(v>0||habitNote(h.id,d)){let cfg=configForDate(h,d);recent.push(`<div class="habit-log-item"><div><span>${fmt(d,{day:"2-digit",month:"short"})}</span>${habitNote(h.id,d)?`<div class="habit-note">${esc(habitNote(h.id,d))}</div>`:""}</div><b>${v} ${esc(cfg.unit)} · ${stateLabel(h,d)}</b></div>`)}}
 let st=streakInfo(h),bst=bestStreakInfo(h);
 openModal(`📅 ${h.name}`,`<div class="habit-cal-wrap">
 <div class="habit-cal-head"><div class="habit-cal-title"><h3>${esc(h.name)}</h3><div class="muted">${esc(h.category)} · ${frequencyLabel(h)} · ${habitGoalLabel(h)}</div></div>
 <div class="actions"><button class="btn small" onclick="openHabitCalendar('${h.id}','${shiftMonthKey(key,-1)}')">←</button><span class="pill">${esc(monthLabelFromKey(key))}</span><button class="btn small" onclick="openHabitCalendar('${h.id}','${shiftMonthKey(key,1)}')">→</button></div></div>
 <div class="habit-detail-grid"><div class="habit-detail-box"><b>⚡ Gatilho</b><div class="muted small">${esc(h.trigger||"Não definido")}</div></div><div class="habit-detail-box"><b>🔁 Rotina</b><div class="muted small">${esc(h.routine||"Não vinculada")}</div></div>${h.reason?`<div class="habit-detail-box" style="grid-column:1/-1"><b>💡 Por quê?</b><div class="muted small">${esc(h.reason)}</div></div>`:""}</div>
 <div class="habit-cal-stats"><div class="habit-cal-stat"><span class="label">Consistência</span><b>${stats.consistency}%</b></div><div class="habit-cal-stat"><span class="label">Ideais</span><b>${stats.complete}</b></div><div class="habit-cal-stat"><span class="label">Parciais</span><b>${stats.partial+stats.started}</b></div><div class="habit-cal-stat"><span class="label">Sequência</span><b>${st.count} ${st.unit}</b></div></div>
 <div class="habit-legend"><span>Sem registro</span><span class="lg-started">Em andamento</span><span class="lg-partial">Piso viável</span><span class="lg-complete">Meta desejada</span></div>
 <div class="habit-month-grid">${["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(x=>`<div class="habit-month-dow">${x}</div>`).join("")}${cells.join("")}</div>
 <div><div class="section" style="margin-top:8px"><h2>Registros recentes</h2><span class="pill">🏆 ${bst.count} ${bst.unit}</span></div><div class="habit-log-list">${recent.join("")||'<div class="empty">Nenhum registro neste mês.</div>'}</div></div>
 </div>`)
}
function editHabitDay(id,date,key){
 let h=data.habits.find(x=>x.id===id);if(!h)return;let e=habitEntry(id,date);
 openModal(`Registrar ${h.name}`,`<form class="form" onsubmit="saveHabitDay(event,'${id}','${date}','${key}')">
 <div class="callout"><b>${fmt(date,{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</b><div class="meta">Piso: ${h.minTarget} · Meta: ${h.target} ${esc(h.unit)} · ${isHabitScheduled(h,date)?"Dia programado":"Dia de descanso"}</div></div>
 <label>Valor realizado<input name="value" type="number" min="0" step="any" value="${e.value}"></label>
 <label>Nota do dia<textarea name="note" placeholder="Ex.: treino leve, leitura difícil, estava viajando...">${esc(e.note)}</textarea></label>
 <div class="grid g2"><button type="button" class="btn" onclick="this.form.value.value=0;this.form.note.value=''">Limpar registro</button><button class="btn primary">Salvar registro</button></div></form>`)
}
function saveHabitDay(e,id,date,key){e.preventDefault();let f=new FormData(e.target);setHabitLog(id,date,f.get("value"),f.get("note"));openHabitCalendar(id,key);toast("Registro atualizado")}

function openHabit(id){
 let h=id?data.habits.find(x=>x.id===id):normalizeHabit({id:uid(),name:"",type:"boolean",target:1,minTarget:1,unit:"feito",weeklyGoal:5},data.habits.length);
 openModal(id?"Editar hábito":"Novo hábito",`<form class="form" onsubmit="saveHabit(event,'${id||""}')"><div class="formgrid">
 <label class="full">Nome<input name="name" required value="${esc(id?h.name:"")}"></label>
 <label>Como acompanhar?<select name="type"><option value="boolean" ${h.type==="boolean"?"selected":""}>Feito / não feito</option><option value="checklist" ${h.type==="checklist"?"selected":""}>Checklist</option></select><span class="small muted">Escolha como marcar o hábito.</span></label>
 <label>Categoria<select name="category">${categoryOptions(h.category||"Pessoal")}</select><button type="button" class="btn small" onclick="addQuickCategory('category')">＋ Nova categoria</button></label>
 <label class="full">Itens do checklist<textarea name="checklistItems" placeholder="Um item por linha. Ex.:&#10;Separar roupa&#10;Fazer treino&#10;Alongar">${esc((h.checklistItems||[]).join("\n"))}</textarea><span class="small muted">Usado apenas quando o acompanhamento for Checklist.</span></label>
 <label>Ritmo<select name="freqType"><option value="daily" ${h.freqType==="daily"?"selected":""}>Todos os dias</option><option value="weekdays" ${h.freqType==="weekdays"?"selected":""}>Dias úteis</option><option value="specific" ${h.freqType==="specific"?"selected":""}>Dias específicos</option><option value="weekly" ${h.freqType==="weekly"?"selected":""}>X vezes por semana</option></select></label>
 <label>Compromisso semanal<input name="weeklyGoal" type="number" min="1" max="7" value="${h.weeklyGoal}"><span class="small muted">Usado quando o ritmo é “X vezes por semana”.</span></label>
 <div class="full"><span class="muted small">Dias específicos / dias de descanso</span><div class="daychecks">${[[1,"Seg"],[2,"Ter"],[3,"Qua"],[4,"Qui"],[5,"Sex"],[6,"Sáb"],[7,"Dom"]].map(([n,l])=>`<label><input type="checkbox" name="days" value="${n}" ${(h.specificDays||[]).map(Number).includes(n)?"checked":""}>${l}</label>`).join("")}</div></div>
 <label>Data de início<input name="startDate" type="date" value="${esc(h.createdAt||today())}"></label>
 <label>Horário<input name="time" type="time" value="${esc(h.time||"")}"></label>
 <label>Lembrete antes<select name="reminderLead"><option value="" ${h.reminderLead==null?"selected":""}>Usar padrão das configurações</option><option value="0" ${String(h.reminderLead)==="0"?"selected":""}>Sem antecedência</option><option value="5" ${String(h.reminderLead)==="5"?"selected":""}>5 minutos</option><option value="10" ${String(h.reminderLead)==="10"?"selected":""}>10 minutos</option><option value="15" ${String(h.reminderLead)==="15"?"selected":""}>15 minutos</option><option value="30" ${String(h.reminderLead)==="30"?"selected":""}>30 minutos</option><option value="60" ${String(h.reminderLead)==="60"?"selected":""}>1 hora</option></select></label>
 <label class="full">Gatilho ou rotina vinculada<input name="routine" value="${esc(h.routine||h.trigger||"")}" placeholder="Ex.: Depois do café · rotina da manhã"></label>
 <label style="display:flex;align-items:center;gap:8px;color:var(--text)"><input style="width:auto" type="checkbox" name="reminderEnabled" ${h.reminderEnabled!==false?"checked":""}> Enviar lembrete</label>
 <label style="display:flex;align-items:center;gap:8px;color:var(--text)"><input style="width:auto" type="checkbox" name="calendarSync" ${h.calendarSync!==false?"checked":""}> Criar evento recorrente no Google Agenda</label>
 <label>Pausar até<input name="pauseUntil" type="date" value="${esc(h.pauseUntil||"")}"></label>
 <label style="display:flex;align-items:center;gap:8px;color:var(--text)"><input style="width:auto" type="checkbox" name="paused" ${h.paused?"checked":""}> Hábito pausado</label>
 </div>
 <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">${id?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ${h.archived?"ok":"warn"}" onclick="archiveHabit('${h.id}')">${h.archived?"Restaurar":"Arquivar"}</button><button type="button" class="btn danger" onclick="deleteHabit('${h.id}')">Excluir hábito</button></div>`:"<span></span>"}<button class="btn primary">Salvar hábito</button></div></form>`)
}
function deleteHabit(id){
 let h=data.habits.find(x=>x.id===id);if(!h)return;
 if(!confirm(`Excluir o hábito “${h.name}”?\n\nO hábito e todo o histórico de registros dele serão apagados. Esta ação não pode ser desfeita.`))return;
 data.habits=data.habits.filter(x=>x.id!==id);
 Object.keys(data.habitLogs||{}).forEach(k=>{if(k.startsWith(id+"_"))delete data.habitLogs[k]});
 save();closeModal();render();toast("Hábito excluído")
}
function saveHabit(e,id){
 e.preventDefault();let f=new FormData(e.target),h=id?data.habits.find(x=>x.id===id):normalizeHabit({id:uid()},data.habits.length);
 let type=f.get("type"),checklistItems=String(f.get("checklistItems")||"").split("\n").map(x=>x.trim()).filter(Boolean).slice(0,30),target=type==="checklist"?Math.max(1,checklistItems.length):1;
 let next={name:f.get("name").trim(),type,target,minTarget:target,unit:type==="checklist"?"itens":"feito",checklistItems,freqType:f.get("freqType"),specificDays:f.getAll("days").map(Number),weeklyGoal:Number(f.get("weeklyGoal"))||5,category:f.get("category")||"Pessoal",period:"any",time:f.get("time"),routine:f.get("routine"),trigger:"",reason:"",calendarSync:f.get("calendarSync")==="on",reminderEnabled:f.get("reminderEnabled")==="on",reminderLead:f.get("reminderLead")===""?null:Number(f.get("reminderLead")),paused:f.get("paused")==="on",pauseUntil:f.get("pauseUntil")||"",order:id?h.order:data.habits.length};
 if(id){
   let changed=["type","target","minTarget","unit","freqType","weeklyGoal"].some(k=>String(h[k])!==String(next[k]))||JSON.stringify(h.specificDays||[])!==JSON.stringify(next.specificDays||[]);
   if(changed)(h.configHistory||=[]).push({from:today(),type:next.type,target:next.target,minTarget:next.minTarget,unit:next.unit,freqType:next.freqType,specificDays:[...next.specificDays],weeklyGoal:next.weeklyGoal});
   if(!h.paused&&next.paused)(h.pauseHistory||=[]).push({from:today(),to:next.pauseUntil||""});
   if(h.paused&&!next.paused){let open=[...(h.pauseHistory||[])].reverse().find(p=>p.from<=today()&&!p.to);if(open)open.to=today()}
 }
 Object.assign(h,next);
 if(!id){h.createdAt=f.get("startDate")||today();h.configHistory=[{from:h.createdAt,type:h.type,target:h.target,minTarget:h.minTarget,unit:h.unit,freqType:h.freqType,specificDays:[...h.specificDays],weeklyGoal:h.weeklyGoal}];data.habits.push(h)}
 save();closeModal();render();toast("Hábito salvo")
}


