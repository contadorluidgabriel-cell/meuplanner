async function loadGoogleCalendarStatus(){
 if(!currentUser||!navigator.onLine){googleCalendarStatus=Object.assign({},googleCalendarStatus,{connected:false});return}
 try{googleCalendarStatus=Object.assign({},googleCalendarStatus,await googleCalendarRequest("status"));if(page==="settings")renderSettings()}catch(error){console.error(error)}
}
function scheduleGoogleCalendarSync(){
 if(!currentUser||!navigator.onLine||!googleCalendarStatus.connected||calendarSyncing)return;
 clearTimeout(calendarSyncTimer);calendarSyncTimer=setTimeout(()=>manualGoogleCalendarSync({silent:true}),2200)
}
async function connectGoogleCalendar(){
 if(!currentUser){toast("Entre no Planner antes de conectar o Google Agenda");openAccount();return}
 try{const result=await googleCalendarRequest("connect",{returnTo:PRODUCTION_URL});if(result.url)location.href=result.url;else throw new Error("O Google não retornou a tela de autorização.")}catch(error){alert("Não foi possível conectar o Google Agenda: "+error.message)}
}
async function manualGoogleCalendarSync(options={}){
 if(calendarSyncing||!currentUser||!navigator.onLine)return;calendarSyncing=true;clearTimeout(calendarSyncTimer);
 if(!options.silent)toast("Sincronizando com o Google Agenda…");
 try{
  const result=await googleCalendarRequest("sync");if(result.state)applyCloudState(result.state);
  googleCalendarStatus.lastSyncedAt=result.lastSyncedAt||new Date().toISOString();
  const meta=readSyncMeta();meta.lastSyncedAt=new Date().toISOString();meta.pending[currentUser.id]=false;writeSyncMeta(meta);
  if(page==="settings")renderSettings();if(!options.silent)toast("Google Agenda sincronizado")
 }catch(error){console.error(error);if(!options.silent)alert("Não foi possível sincronizar: "+error.message)}finally{calendarSyncing=false}
}
async function disconnectGoogleCalendar(){
 if(!confirm("Desconectar o Google Agenda? O calendário e os eventos já criados serão mantidos no Google."))return;
 try{await googleCalendarRequest("disconnect");googleCalendarStatus={configured:true,connected:false,email:null,calendarName:"Meu Planner Digital",lastSyncedAt:null};renderSettings();toast("Google Agenda desconectado")}catch(error){alert("Não foi possível desconectar: "+error.message)}
}
function consumeGoogleCalendarResult(){
 const url=new URL(location.href),result=url.searchParams.get("google_calendar");if(!result)return;
 const detail=url.searchParams.get("detail")||"";url.searchParams.delete("google_calendar");url.searchParams.delete("detail");history.replaceState({},document.title,url.pathname+url.search+url.hash);
 setTimeout(async()=>{if(result==="connected"){toast("Google Agenda conectado");await loadGoogleCalendarStatus();await manualGoogleCalendarSync({silent:true})}else alert("Não foi possível conectar o Google Agenda"+(detail?": "+detail:"."))},500)
}
function toast(t){let x=document.getElementById("toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)}
function openModal(title,body){document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=body;document.getElementById("modal").classList.add("show")}
function closeModal(){document.getElementById("modal").classList.remove("show")}
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()})

function showPage(p){page=p;render()}
function renderNav(){document.getElementById("nav").innerHTML=NAV.map(([id,l])=>`<button class="${page===id?"active":""}" onclick="showPage('${id}')">${l}</button>`).join("")}
function setHeader(title,sub,actions=""){document.getElementById("pageTitle").textContent=title;document.getElementById("pageSub").textContent=sub;document.getElementById("topActions").innerHTML=actions}
function render(){applyPreferences();renderNav();({today:renderToday,tasks:renderTasks,habits:renderHabits,week:renderWeek,progress:renderProgress,inbox:renderInbox,settings:renderSettings}[page]||renderToday)();save()}

function getPlan(d=today()){data.dailyPlans[d]=data.dailyPlans[d]||{capacity:data.settings.dailyCapacity,priorities:[],started:false,closed:false,mood:null,review:"",blocker:""};return data.dailyPlans[d]}
function todayTasks(){return data.tasks.filter(t=>t.date===today())}
function taskPlannedMinutes(d=today()){return data.tasks.filter(t=>t.date===d&&t.status!=="done").reduce((a,t)=>a+(Number(t.estimate)||0),0)}
function habitEntry(id,d=today()){
 let raw=data.habitLogs[`${id}_${d}`];
 if(raw==null)return {value:0,note:"",items:[]};
 if(typeof raw==="number")return {value:raw,note:"",items:[]};
 return {value:Number(raw.value)||0,note:raw.note||"",items:Array.isArray(raw.items)?raw.items:[]}
}
function habitLog(id,d=today()){return habitEntry(id,d).value}
function habitNote(id,d=today()){return habitEntry(id,d).note}
function setHabitLog(id,d,val,note=habitNote(id,d),items=habitEntry(id,d).items){data.habitLogs[`${id}_${d}`]={value:Math.max(0,Number(val)||0),note:note||"",items:Array.isArray(items)?items:[]};save()}
function habitPct(h,d=today()){return Math.min(1,habitLog(h.id,d)/h.target)}
function habitDone(h,d=today()){return habitLog(h.id,d)>=h.target}
function habitPartial(h,d=today()){let p=habitPct(h,d);return p>0&&p<1}
function recentDays(n=28){return Array.from({length:n},(_,i)=>addDays(today(),-(n-1-i)))}
const DAILY_MESSAGES=["Comece pelo próximo passo.","Constância pequena vale mais que perfeição.","Hoje é uma nova oportunidade de avançar.","Faça o que está ao seu alcance, com presença.","Disciplina é cuidado com o futuro.","Um dia bem vivido começa com uma escolha simples."];
function dailyMessage(done,total){
 if(total&&done===total)return "Excelente: você concluiu o que planejou para hoje.";
 if(done>0)return "Você já avançou. Continue com calma e firmeza.";
 return DAILY_MESSAGES[new Date().getDate()%DAILY_MESSAGES.length]
}

function renderToday(){
 let plan=getPlan(),ts=todayTasks(),done=ts.filter(t=>t.status==="done").length;
 let todaysHabits=activeHabits().filter(h=>{
   let cfg=configForDate(h,today());
   if(cfg.freqType==="weekly")return weeklyHabitCount(h)<cfg.weeklyGoal&&!habitPausedOn(h,today());
   return isHabitScheduled(h,today())
 }).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.order-b.order),dailyScoreHabits=todaysHabits.filter(h=>configForDate(h,today()).freqType!=="weekly"),hdone=dailyScoreHabits.filter(h=>habitState(h)==='complete').length;
 setHeader("☀️ Meu Dia",new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long"}).format(new Date()),
 `<button class="btn" onclick="openQuick()">⚡ Capturar</button><button class="btn primary" onclick="openTask()">＋ Tarefa</button>`);
 let html=`<div class="card" style="margin-bottom:16px"><b>✨ ${dailyMessage(done,ts.length)}</b><div class="small muted" style="margin-top:4px">Um passo de cada vez.</div></div><div class="grid g4">
  <div class="card"><div class="label">Tarefas</div><div class="metric">${done}/${ts.length}</div><div class="progress"><i style="width:${ts.length?done/ts.length*100:0}%"></i></div></div>
  <div class="card"><div class="label">Pendentes</div><div class="metric">${ts.length-done}</div><div class="small muted">para hoje</div></div>
  <div class="card"><div class="label">Prioridades</div><div class="metric">${plan.priorities.length}</div><div class="small muted">foco do dia</div></div>
  <div class="card"><div class="label">Hábitos</div><div class="metric">${hdone}/${dailyScoreHabits.length}</div><div class="small muted">${habitDayConsistency()}% do dia</div></div>
 </div>`;
 html+=plan.closed?renderClosedDay(plan):renderExecution(plan);
 document.getElementById("content").innerHTML=html
}
function renderMorningPlan(plan){
 let ts=todayTasks().filter(t=>t.status!=="done");
 return `<div class="section"><h2>🧭 Planejar o dia</h2></div>
 <div class="card"><div class="plan-step"><div class="stepnum">1</div><div><h3 style="margin-top:4px">Escolha até 3 prioridades</h3><div class="priority-pick">${ts.map(t=>`<label><input type="checkbox" name="prio" value="${t.id}" ${plan.priorities.includes(t.id)?"checked":""}><span>${esc(t.name)}</span></label>`).join("")||'<div class="empty">Sem tarefas para hoje.</div>'}</div></div></div><button class="btn primary" style="width:100%;margin-top:18px" onclick="startDay()">Começar meu dia</button></div>`
}
function startDay(){
 let p=getPlan(),ids=[...document.querySelectorAll('input[name="prio"]:checked')].map(x=>x.value).slice(0,3);p.priorities=ids;p.started=true;p.closed=false;save();render();toast("Dia iniciado")
}
function renderExecution(plan){
 let ts=todayTasks(),prio=plan.priorities.map(id=>data.tasks.find(t=>t.id===id)).filter(Boolean),late=data.tasks.filter(t=>t.status!=="done"&&t.date<today()).slice(0,5);
 let todaysHabits=activeHabits().filter(h=>{let cfg=configForDate(h,today());if(cfg.freqType==="weekly")return weeklyHabitCount(h)<cfg.weeklyGoal&&!habitPausedOn(h,today());return isHabitScheduled(h,today())}).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.order-b.order);
 return `<div class="section"><h2>🎯 Prioridades</h2><button class="btn small" onclick="openPriorityPicker()">Escolher prioridades</button></div>
 <div class="grid g3">${prio.length?prio.map(taskMini).join(""):`<div class="card empty">Nenhuma prioridade escolhida.</div>`}</div>
 <div class="section"><h2>📋 Tarefas de hoje</h2><button class="btn small primary" onclick="openTask()">＋ Tarefa</button></div>
 <div class="card"><div class="list">${ts.length?ts.map(taskRow).join(""):`<div class="empty">Nada planejado para hoje.</div>`}</div></div>
 <div class="section"><h2>🔄 Hábitos de hoje</h2></div><div class="card">${todaysHabits.length?todaysHabits.map(habitTodayRow).join(""):`<div class="empty">Nenhum hábito programado para hoje.</div>`}</div>
 ${late.length?`<div class="section"><h2>⚠️ Pendências antigas</h2></div><div class="card"><div class="list">${late.map(taskRow).join("")}</div></div>`:""}
 <div class="section"><h2>🌙 Encerrar</h2></div><div class="card"><p class="muted">Quando terminar, registre como foi o dia e decida conscientemente o que fazer com as pendências.</p><button class="btn primary" onclick="openCloseDay()">Fechar meu dia</button></div>`
}
function openPriorityPicker(){
 let p=getPlan(),ts=todayTasks().filter(t=>t.status!=="done");
 openModal("🎯 Prioridades de hoje",`<form class="form" onsubmit="savePriorities(event)"><div class="auth-note">Escolha até 3 tarefas que realmente merecem seu foco hoje.</div><div class="priority-pick">${ts.map(t=>`<label><input type="checkbox" name="prio" value="${t.id}" ${p.priorities.includes(t.id)?"checked":""}><span>${esc(t.name)}</span></label>`).join("")||'<div class="empty">Sem tarefas pendentes para hoje.</div>'}</div><button class="btn primary">Salvar prioridades</button></form>`)
}
function savePriorities(e){e.preventDefault();let p=getPlan();p.priorities=[...new FormData(e.target).getAll("prio")].slice(0,3);p.started=true;save();closeModal();render();toast("Prioridades atualizadas")}
