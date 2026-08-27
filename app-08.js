function habitConsistencyRange(h,days){
 let valid=days.filter(d=>!isFutureDate(d));if(!valid.length)return 0;
 let cfg=configForDate(h,valid[valid.length-1]);
 if(cfg.freqType==="weekly"){
   let weeks=[...new Set(valid.map(d=>weekKey(d)))],scores=[];
   for(let w of weeks){
     let weekDays=valid.filter(d=>weekKey(d)===w),complete=weekDays.filter(d=>habitState(h,d)==="complete").length;
     let target=Math.max(1,Number(configForDate(h,w).weeklyGoal)||1);
     let elapsed=weekDays.length;
     if(w===weekKey()&&!weekComplete(w)){
       let expected=Math.min(target,target*(elapsed/7));
       scores.push(expected?Math.min(1,complete/expected):1);
     }else scores.push(Math.min(1,complete/target));
   }
   return scores.length?Math.round(scores.reduce((a,v)=>a+v,0)/scores.length*100):0
 }
 let scheduled=scheduledDaysInRange(h,valid);if(!scheduled.length)return 0;
 let score=scheduled.reduce((a,d)=>{let s=habitState(h,d);return a+(s==="complete"?1:s==="partial"?.65:s==="started"?.25:0)},0);
 return Math.round(score/scheduled.length*100)
}
function toggleFavorite(id){let h=data.habits.find(x=>x.id===id);h.favorite=!h.favorite;save();render()}
function pauseHabit(id){let h=data.habits.find(x=>x.id===id);if(!h)return;let was=h.paused;h.paused=!h.paused;if(!was&&h.paused){h.pauseHistory=h.pauseHistory||[];h.pauseHistory.push({from:today(),to:h.pauseUntil||""})}else if(was&&!h.paused){let open=[...(h.pauseHistory||[])].reverse().find(p=>p.from<=today()&&!p.to);if(open)open.to=today();h.pauseUntil=""}save();render();toast(h.paused?"Hábito pausado":"Hábito retomado")}
function archiveHabit(id){let h=data.habits.find(x=>x.id===id);h.archived=!h.archived;save();closeModal();render();toast(h.archived?"Hábito arquivado":"Hábito restaurado")}
let draggedHabitId=null;
function habitDragStart(e,id){draggedHabitId=id;e.currentTarget.classList.add("dragging")}
function habitDragEnd(e){e.currentTarget.classList.remove("dragging");document.querySelectorAll(".habit-row").forEach(x=>x.classList.remove("drop-target"))}
function habitDragOver(e){e.preventDefault();e.currentTarget.classList.add("drop-target")}
function habitDrop(e,targetId){
 e.preventDefault();e.currentTarget.classList.remove("drop-target");
 if(!draggedHabitId||draggedHabitId===targetId)return;
 let arr=data.habits.filter(h=>!h.archived).sort((a,b)=>a.order-b.order),from=arr.findIndex(h=>h.id===draggedHabitId),to=arr.findIndex(h=>h.id===targetId);
 if(from<0||to<0)return;let [m]=arr.splice(from,1);arr.splice(to,0,m);arr.forEach((h,i)=>h.order=i);
 save();render()
}


function habitTodayRow(h){
 if(h.archived)return "";
 let v=habitLog(h.id),pct=h.type==="boolean"?(v>=1?100:0):Math.round(Math.min(1,v/h.target)*100),state=habitState(h);
 let quick=Math.max(1,Math.round(h.target/4));
 let control=h.type==="boolean"
 ?`<div class="habit-bool"><button class="btn small ${state==="complete"?"ok":"primary"}" onclick="setHabitLog('${h.id}',today(),${state==="complete"?0:1});render()">${state==="complete"?"✓ Feito":"Marcar como feito"}</button></div>`
 :h.type==="checklist"?`<div class="habit-quick">${(h.checklistItems||[]).map((item,index)=>`<label style="display:flex;align-items:center;gap:7px;color:var(--text);font-size:13px"><input style="width:auto" type="checkbox" ${habitEntry(h.id).items.includes(index)?"checked":""} onchange="toggleHabitChecklistItem('${h.id}',${index},this.checked)">${esc(item)}</label>`).join("")||'<span class="muted small">Adicione itens ao checklist ao editar o hábito.</span>'}</div>`
 :`<div class="habit-quick"><input class="habit-input" id="hv_${h.id}" type="number" min="0" step="any" value="${v}"><span class="muted">${esc(h.unit)}</span><button class="btn small primary" onclick="saveHabitValue('${h.id}')">Salvar</button><button class="btn small" onclick="quickHabit('${h.id}',${quick})">+${quick}</button></div>`;
 return `<div class="habit-row ${h.paused?"habit-paused":""}">
 <div class="habit-head"><button class="habit-fav ${h.favorite?"on":""}" onclick="toggleFavorite('${h.id}')" title="Favorito">★</button><div class="grow"><b>${esc(h.name)}</b><div class="meta">${stateLabel(h)} · ${habitGoalLabel(h)} · ${frequencyLabel(h)}${h.period!=="any"?` · ${periodLabel(h)}`:""}${h.time?` · ${esc(h.time)}`:""}</div></div><span class="pill ${state==="complete"?"ok":state==="partial"||state==="started"?"warn":""}">${pct}%</span></div>
 ${control}
 <div class="progress ${state==="complete"?"ok":state==="partial"||state==="started"?"warn":""}" style="margin-top:10px"><i style="width:${pct}%"></i></div>
 ${h.reason?`<div class="habit-reason">💡 ${esc(h.reason)}</div>`:""}</div>`
}
function saveHabitValue(id){setHabitLog(id,today(),document.getElementById("hv_"+id).value);render()}
function quickHabit(id,inc){setHabitLog(id,today(),habitLog(id)+inc);render()}
function toggleHabitChecklistItem(id,index,checked){let e=habitEntry(id),items=[...e.items];if(checked&&!items.includes(index))items.push(index);if(!checked)items=items.filter(x=>x!==index);setHabitLog(id,today(),items.length,e.note,items);render()}
function streak(id){let h=data.habits.find(x=>x.id===id);return h?streakInfo(h).count:0}
function bestStreak(id){let h=data.habits.find(x=>x.id===id);return h?bestStreakInfo(h).count:0}
function weeklyHabitCount(h,start=weekKey()){let n=0;for(let i=0;i<7;i++)if(habitState(h,addDays(start,i))==="complete")n++;return n}
function habitWeekHTML(h){
 let days=Array.from({length:7},(_,i)=>addDays(weekKey(),i));
 return `<div class="weekdots">${days.map(d=>{let s=habitState(h,d),future=isFutureDate(d),scheduled=isHabitScheduled(h,d);return `<div class="wd ${s==="complete"?"on":s==="partial"||s==="started"?"partial":""} ${d===today()?"today":""}" style="${!scheduled?"opacity:.38":""}"><b>${new Intl.DateTimeFormat("pt-BR",{weekday:"short"}).format(dateObj(d)).replace(".","")}</b><br>${fmt(d,{day:"2-digit"})}${future?"<br>fut.":!scheduled?"<br>desc.":""}</div>`}).join("")}</div>`
}
function habitDayConsistency(){
 let hs=activeHabits().filter(h=>configForDate(h,today()).freqType!=="weekly"&&isHabitScheduled(h,today()));if(!hs.length)return 0;
 return Math.round(hs.reduce((a,h)=>a+(habitState(h)==="complete"?1:habitState(h)==="partial"?.65:habitState(h)==="started"?.25:0),0)/hs.length*100)
}
function renderHabits(){
 setHeader("🔄 Hábitos","Metas flexíveis, histórico, descanso e consistência.",`<button class="btn primary" onclick="openHabit()">＋ Novo hábito</button>`);
 let hs=activeHabits(),arch=archivedHabits();
 let rows=hs.map(h=>{
   let st=streakInfo(h),best=bestStreakInfo(h),week=weeklyHabitCount(h),cons=habitConsistencyRange(h,recentDays(30));
   return `<div class="habit-row ${h.paused?"habit-paused":""}" draggable="true" ondragstart="habitDragStart(event,'${h.id}')" ondragend="habitDragEnd(event)" ondragover="habitDragOver(event)" ondrop="habitDrop(event,'${h.id}')">
   <div class="habit-head"><span class="habit-drag" title="Arrastar">⋮⋮</span><button class="habit-fav ${h.favorite?"on":""}" onclick="toggleFavorite('${h.id}')">★</button>
   <div class="grow"><b>${esc(h.name)}</b><div class="meta">${esc(h.category)} · ${habitGoalLabel(h)} · ${frequencyLabel(h)} · ${periodLabel(h)}${h.routine?` · Rotina: ${esc(h.routine)}`:""}${h.paused?" · PAUSADO":""}</div></div>
   <span class="pill ${h.freqType==="weekly"&&week>=h.weeklyGoal?"ok":""}">${h.freqType==="weekly"?`${week}/${h.weeklyGoal} semana`:`Piso ${h.minTarget} / ${h.target}`}</span>
   <button class="btn small primary" onclick="openHabitCalendar('${h.id}')">Calendário</button><button class="btn small" onclick="openHabit('${h.id}')">Editar</button></div>
   <div class="habit-state"><span class="pill">🔥 ${st.count} ${st.unit}</span><span class="pill">🏆 ${best.count} ${best.unit}</span><span class="pill">📈 30d ${cons}%</span>${h.trigger?`<span class="pill">⚡ ${esc(h.trigger)}</span>`:""}</div>
   ${habitWeekHTML(h)}</div>`
 }).join("");
 document.getElementById("content").innerHTML=`<div class="grid g4">
 <div class="card"><div class="label">Hábitos ativos</div><div class="metric">${hs.length}</div></div>
 <div class="card"><div class="label">Favoritos</div><div class="metric">${hs.filter(h=>h.favorite).length}</div></div>
 <div class="card"><div class="label">Consistência hoje</div><div class="metric">${habitDayConsistency()}%</div></div>
 <div class="card"><div class="label">Compromissos semanais</div><div class="metric">${hs.filter(h=>h.freqType==="weekly"&&weeklyHabitCount(h)>=h.weeklyGoal).length}/${hs.filter(h=>h.freqType==="weekly").length||0}</div></div></div>
 <div class="section"><h2>Seus hábitos</h2><span class="muted small">Arraste para reorganizar</span></div><div class="card">${rows||'<div class="empty">Crie seu primeiro hábito.</div>'}</div>
 <div class="section"><h2>Últimos 28 dias</h2></div><div class="card">${renderHeatmap()}<div class="small muted" style="margin-top:10px">Verde = meta ideal; amarelo = parcial; azul = iniciado.</div></div>
 ${arch.length?`<div class="section"><h2>Arquivados</h2></div><div class="card"><div class="list">${arch.map(h=>`<div class="item"><div class="grow"><b>${esc(h.name)}</b><div class="meta">${esc(h.category)}</div></div><button class="btn small" onclick="archiveHabit('${h.id}')">Restaurar</button></div>`).join("")}</div></div>`:""}`
}
function renderHeatmap(){
 let hs=activeHabits();
 return `<div class="heat">${recentDays(28).map(d=>{let scheduled=hs.filter(h=>isHabitScheduled(h,d));let p=scheduled.length?scheduled.reduce((a,h)=>a+(habitState(h,d)==="complete"?1:habitState(h,d)==="partial"?.65:habitState(h,d)==="started"?.25:0),0)/scheduled.length:0;let c=p>=.9?"p4":p>=.65?"p3":p>=.3?"p2":p>0?"p1":"";return `<span class="${c}" title="${fmt(d)} · ${Math.round(p*100)}%"></span>`}).join("")}</div>`
}

function monthKeyFromDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function monthLabelFromKey(key){let [y,m]=key.split("-").map(Number);return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(new Date(y,m-1,1))}
function shiftMonthKey(key,delta){let [y,m]=key.split("-").map(Number),d=new Date(y,m-1+delta,1);return monthKeyFromDate(d)}
function habitMonthStats(h,key){
 let [y,m]=key.split("-").map(Number),last=new Date(y,m,0).getDate(),days=[];
 for(let day=1;day<=last;day++)days.push(`${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
 let scheduled=days.filter(d=>!isFutureDate(d)&&isHabitScheduled(h,d)),complete=scheduled.filter(d=>habitState(h,d)==="complete").length,partial=scheduled.filter(d=>habitState(h,d)==="partial").length,started=scheduled.filter(d=>habitState(h,d)==="started").length;
 return {complete,partial,started,consistency:habitConsistencyRange(h,days)}
}
