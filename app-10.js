function renderWeek(){
 let wk=weekKey(),p=data.weeklyPlans[wk]||{focus:"",outcomes:["","",""],canWait:""};data.weeklyPlans[wk]=p;
 setHeader("📅 Semana",`${fmt(wk,{day:"2-digit",month:"short"})} – ${fmt(addDays(wk,6),{day:"2-digit",month:"short"})}`,`<button class="btn primary" onclick="saveWeekPlan()">Salvar planejamento</button>`);
 let days=Array.from({length:7},(_,i)=>addDays(wk,i));
 document.getElementById("content").innerHTML=`<div class="card"><div class="timeline">${days.map(d=>{let ts=data.tasks.filter(t=>t.date===d),m=ts.filter(t=>t.status!=="done").reduce((a,t)=>a+t.estimate,0);return `<div class="time-row"><b>${new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit"}).format(dateObj(d))}</b><div><div class="small muted">${ts.length} tarefa(s)</div><b>${mins(m)}</b></div><div class="progress ${m>data.settings.dailyCapacity?"danger":m>data.settings.dailyCapacity*.85?"warn":"ok"}"><i style="width:${Math.min(100,m/data.settings.dailyCapacity*100)}%"></i></div></div>`}).join("")}</div></div>
 <div class="section"><h2>🧭 Planejamento semanal</h2></div><div class="grid g2">
 <div class="card form"><label>Foco principal da semana<textarea id="wkFocus">${esc(p.focus)}</textarea></label><label>3 resultados importantes<textarea id="wkOut">${esc((p.outcomes||[]).join("\n"))}</textarea></label></div>
 <div class="card form"><label>O que pode esperar?<textarea id="wkWait">${esc(p.canWait||"")}</textarea></label><div class="callout"><b>Capacidade padrão diária</b><div class="metric">${mins(data.settings.dailyCapacity)}</div><div class="muted small">Ajustável em Configurações.</div></div></div></div>`
}
function saveWeekPlan(){let p=data.weeklyPlans[weekKey()];p.focus=document.getElementById("wkFocus").value;p.outcomes=document.getElementById("wkOut").value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,3);p.canWait=document.getElementById("wkWait").value;save();toast("Planejamento semanal salvo")}

function insightList(){
 let out=[],done=data.tasks.filter(t=>t.status==="done"&&t.actual>0);
 if(done.length>=3){let est=done.reduce((a,t)=>a+t.estimate,0),act=done.reduce((a,t)=>a+t.actual,0),diff=est?Math.round((act-est)/est*100):0;if(diff>10)out.push(`⏱️ Você costuma usar cerca de <b>${diff}% mais tempo</b> do que estima.`);else if(diff<-10)out.push(`⏱️ Suas tarefas têm levado cerca de <b>${Math.abs(diff)}% menos tempo</b> do que o estimado.`);else out.push(`⏱️ Suas estimativas de tempo estão relativamente próximas do realizado.`)}
 let res=data.tasks.filter(t=>t.reschedules>=3&&t.status!=="done");if(res.length)out.push(`🔁 <b>${res.length}</b> tarefa(s) foram reagendadas 3 vezes ou mais. Vale dividir ou cancelar conscientemente.`);
 let hc=habitDayConsistency();if(activeHabits().length)out.push(`🔄 Sua consistência de hábitos hoje está em <b>${hc}%</b>.`);
 let overloaded=recentDays(14).filter(d=>taskPlannedMinutes(d)>data.settings.dailyCapacity).length;if(overloaded>=3)out.push(`⚠️ Você planejou acima da capacidade em <b>${overloaded} dos últimos 14 dias</b>.`);
 if(!out.length)out.push("O Planner ainda precisa de mais histórico real para encontrar padrões úteis.");
 return out
}
function renderProgress(){
 setHeader("📈 Progresso","Compare planejamento, execução e consistência.",`<button class="btn primary" onclick="openMetricsExport()">📄 Exportar relatório TXT</button>`);
 let done=data.tasks.filter(t=>t.status==="done"),est=done.reduce((a,t)=>a+t.estimate,0),act=done.reduce((a,t)=>a+t.actual,0),execution=data.tasks.length?Math.round(done.length/data.tasks.length*100):0;
 document.getElementById("content").innerHTML=`<div class="grid g4">
 <div class="card"><div class="label">Execução</div><div class="metric">${execution}%</div></div>
 <div class="card"><div class="label">Estimado concluído</div><div class="metric">${mins(est)}</div></div>
 <div class="card"><div class="label">Tempo real</div><div class="metric">${mins(act)}</div></div>
 <div class="card"><div class="label">Hábitos hoje</div><div class="metric">${habitDayConsistency()}%</div></div></div>
 <div class="section"><h2>🧠 Insights</h2></div><div class="card"><div class="list">${insightList().map(x=>`<div class="item"><div class="grow">${x}</div></div>`).join("")}</div></div>
 <div class="section"><h2>Planejado × realizado</h2></div><div class="card"><div class="timeline">${done.slice(-12).reverse().map(t=>`<div class="time-row"><b>${esc(t.name)}</b><span>Estimado: ${mins(t.estimate)}</span><span>Real: ${mins(t.actual)}</span></div>`).join("")||'<div class="empty">Conclua algumas tarefas registrando o tempo real.</div>'}</div></div>
 <div class="section"><h2>Hábitos — 28 dias</h2></div><div class="card">${renderHeatmap()}</div>`
}

function openQuick(){openModal("⚡ Captura rápida",`<form class="form" onsubmit="capture(event)"><label>Capture sem organizar agora<textarea name="text" required placeholder="Ex.: verificar contrato do cliente"></textarea></label><button class="btn primary">Enviar para Inbox</button></form>`)}
function capture(e){e.preventDefault();let txt=new FormData(e.target).get("text").trim();data.inbox.push({id:uid(),text:txt,createdAt:new Date().toISOString()});save();closeModal();showPage("inbox");toast("Capturado")}
function renderInbox(){
 setHeader("⚡ Inbox","Capture primeiro. Organize depois.",`<button class="btn primary" onclick="openQuick()">＋ Capturar</button>`);
 document.getElementById("content").innerHTML=`<div class="card"><div class="list">${data.inbox.length?data.inbox.map(x=>`<div class="item"><div class="grow"><div class="item-title">${esc(x.text)}</div><div class="meta">${new Date(x.createdAt).toLocaleString("pt-BR")}</div></div><button class="btn small primary" onclick="inboxToTask('${x.id}')">Virar tarefa</button><button class="btn small danger" onclick="deleteInbox('${x.id}')">Excluir</button></div>`).join(""):`<div class="empty">Inbox vazia.</div>`}</div></div>`
}
function inboxToTask(id){let x=data.inbox.find(i=>i.id===id);if(!x)return;data.tasks.push({id:uid(),name:x.text,date:today(),startTime:"",estimate:30,actual:0,priority:"normal",status:"todo",project:"Geral",reschedules:0,createdAt:today(),updatedAt:new Date().toISOString(),calendarSync:true});data.inbox=data.inbox.filter(i=>i.id!==id);save();render();toast("Convertido em tarefa")}
function deleteInbox(id){data.inbox=data.inbox.filter(i=>i.id!==id);save();render()}


function periodDates(days){
 let end=today(),start=addDays(end,-(days-1));return {start,end}
}
function filterTasksPeriod(start,end){return data.tasks.filter(t=>t.date&&t.date>=start&&t.date<=end)}
function buildMetricsTXT(days=30,sections={summary:true,habits:true,tasks:true,time:true,planning:true,reviews:true,insights:true}){
 let {start,end}=periodDates(days),tasks=filterTasksPeriod(start,end),done=tasks.filter(t=>t.status==="done"),pending=tasks.filter(t=>t.status!=="done"),late=pending.filter(t=>t.date<today());
 let est=done.reduce((a,t)=>a+(+t.estimate||0),0),act=done.reduce((a,t)=>a+(+t.actual||0),0),rate=tasks.length?Math.round(done.length/tasks.length*100):0;
 let lines=[];
 lines.push("MEU PLANNER DIGITAL — RELATÓRIO DE MÉTRICAS",`Período: ${fmt(start,{day:"2-digit",month:"2-digit",year:"numeric"})} a ${fmt(end,{day:"2-digit",month:"2-digit",year:"numeric"})}`,"");
 let sep=()=>lines.push("========================================");
 if(sections.summary){sep();lines.push("RESUMO GERAL");sep();lines.push(`Tarefas no período: ${tasks.length}`,`Concluídas: ${done.length}`,`Pendentes: ${pending.length}`,`Atrasadas: ${late.length}`,`Taxa de conclusão: ${rate}%`,`Consistência de hábitos hoje: ${habitDayConsistency()}%`,"")}
 if(sections.habits){sep();lines.push("HÁBITOS");sep();for(let h of activeHabits()){let ds=[];for(let d=start;d<=end;d=addDays(d,1))ds.push(d);let cfg=configForDate(h,end),cons=habitConsistencyRange(h,ds),vals=ds.map(d=>habitLog(h.id,d)).filter(v=>v>0),avg=vals.length?Math.round(vals.reduce((a,v)=>a+v,0)/vals.length*10)/10:0,st=streakInfo(h),bst=bestStreakInfo(h);lines.push("",h.name,`Categoria: ${h.category}`,`Frequência: ${frequencyLabel(h)}`,`Meta mínima atual: ${cfg.minTarget} ${cfg.unit}`,`Meta ideal atual: ${cfg.target} ${cfg.unit}`,`Consistência no período: ${cons}%`,`Média registrada: ${avg} ${cfg.unit}`,`Sequência atual: ${st.count} ${st.unit}`,`Melhor sequência: ${bst.count} ${bst.unit}`)}lines.push("")}
 if(sections.tasks){sep();lines.push("TAREFAS");sep();lines.push(`Total: ${tasks.length}`,`Concluídas: ${done.length}`,`Pendentes: ${pending.length}`,`Atrasadas: ${late.length}`,`Reagendadas 3x ou mais: ${tasks.filter(t=>t.reschedules>=3).length}`,"");for(let t of tasks.filter(t=>t.reschedules>=3))lines.push(`- ${t.name}: reagendada ${t.reschedules}x`);lines.push("")}
 if(sections.time){sep();lines.push("TEMPO");sep();lines.push(`Tempo estimado concluído: ${mins(est)}`,`Tempo real concluído: ${mins(act)}`,`Diferença: ${mins(Math.abs(act-est))} ${act>=est?"a mais":"a menos"}`,`Diferença percentual: ${est?Math.round((act-est)/est*100):0}%`,"")}
 if(sections.planning){let ds=[];for(let d=start;d<=end;d=addDays(d,1))ds.push(d);let overloaded=ds.filter(d=>taskPlannedMinutes(d)>data.settings.dailyCapacity).length,plans=ds.filter(d=>data.dailyPlans[d]?.started).length;sep();lines.push("PLANEJAMENTO");sep();lines.push(`Dias planejados: ${plans}`,`Dias acima da capacidade: ${overloaded}`,`Capacidade diária padrão: ${mins(data.settings.dailyCapacity)}`,"")}
 if(sections.reviews){sep();lines.push("REVISÕES");sep();let revs=Object.entries(data.dailyPlans).filter(([d,p])=>d>=start&&d<=end&&p.closed);if(!revs.length)lines.push("Nenhuma revisão fechada no período.");for(let [d,p] of revs){lines.push("",fmt(d,{day:"2-digit",month:"2-digit",year:"numeric"}),`Humor: ${p.mood||"—"}`,`O que funcionou: ${p.review||"—"}`,`O que atrapalhou: ${p.blocker||"—"}`)}lines.push("")}
 if(sections.insights){sep();lines.push("INSIGHTS");sep();insightList().forEach(x=>lines.push("- "+x.replace(/<[^>]*>/g,"")));lines.push("")}
 sep();lines.push("GERADO EM");sep();lines.push(new Date().toLocaleString("pt-BR"));
 return lines.join("\n")
}
function openMetricsExport(){
 openModal("📄 Exportar relatório TXT",`<form class="form" onsubmit="exportMetricsTXT(event)">
 <label>Período<select name="days"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 365 dias</option></select></label>
 <div class="formgrid">
 ${[["summary","Resumo"],["habits","Hábitos"],["tasks","Tarefas"],["time","Tempo"],["planning","Planejamento"],["reviews","Revisões"],["insights","Insights"]].map(([v,l])=>`<label style="display:flex;align-items:center;gap:8px;color:var(--text)"><input style="width:auto" type="checkbox" name="${v}" checked> ${l}</label>`).join("")}
 </div><button class="btn primary">Gerar TXT</button></form>`)
}
