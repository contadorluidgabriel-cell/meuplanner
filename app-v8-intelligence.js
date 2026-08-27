/* V8 Local Intelligence Engine — zero API cost, standalone */
(function(){
'use strict';

if(!Array.isArray(data.assistantHistory)) data.assistantHistory=[];
const chatMemory=data.assistantHistory;

function persistChat(){
  if(chatMemory.length>50) chatMemory.splice(0,chatMemory.length-50);
  try{save()}catch{}
}
function getToday(){return typeof today==='function'?today():new Date().toISOString().slice(0,10)}
function dObj(s){return typeof dateObj==='function'?dateObj(s):new Date(`${s}T12:00:00`)}
function addD(s,n){if(typeof addDays==='function')return addDays(s,n);let d=dObj(s);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function weekStart(){if(typeof weekKey==='function')return weekKey();let d=dObj(getToday()),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.toISOString().slice(0,10)}
function fDate(s){try{return typeof fmt==='function'?fmt(s):new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(dObj(s))}catch{return s}}
function escSafe(s=''){return typeof esc==='function'?esc(s):String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function daysBetween(a,b){return Math.round((dObj(b)-dObj(a))/86400000)}
function openTasks(){return (data.tasks||[]).filter(t=>t.status!=='done')}
function isLate(t){return t.status!=='done'&&t.date&&t.date<getToday()}
function commitmentDateLocal(c){return String(c.start||'').slice(0,10)}
function activeGoalsLocal(){return (data.goals||[]).filter(g=>g.status!=='completed')}
function num(v,fallback=0){let n=Number(v);return Number.isFinite(n)?n:fallback}
function unitAfter(v,u){return `${Number.isInteger(Number(v))?Number(v):Number(v).toLocaleString('pt-BR')} ${u||''}`.trim()}

function goalProgress(g){
  const start=num(g.startValue),target=num(g.targetValue),current=num(g.currentValue,start),distance=target-start;
  if(!distance)return current===target?1:0;
  return Math.max(0,Math.min(1,(current-start)/distance));
}
function goalRemaining(g){
  const target=num(g.targetValue),current=num(g.currentValue);
  return Math.max(0,Math.abs(target-current));
}
function goalDirection(g){return num(g.targetValue)>=num(g.startValue)?'increase':'decrease'}
function goalPaceLocal(g){
  const p=goalProgress(g),created=String(g.createdAt||getToday()).slice(0,10),deadline=g.deadline||getToday();
  const total=Math.max(1,daysBetween(created,deadline)),elapsed=Math.max(0,Math.min(total,daysBetween(created,getToday()))),timePct=elapsed/total;
  const updates=(data.goalUpdates||[]).filter(u=>u.goalId===g.id);
  let label;
  if(p>=1) label='Atingida';
  else if(elapsed<=2&&!updates.length) label='Início';
  else if(p>=Math.min(1,timePct+.15)) label='Adiantada';
  else if(p+0.15<timePct) label='Atrasada';
  else if(p<timePct) label='Atenção';
  else label='No ritmo';
  const projection=elapsed>0?Math.min(2,p/(elapsed/total)):null;
  return {label,projection:projection==null?null:projection*100,progress:p*100,timePct:timePct*100};
}
function doneHistory(days=28){let from=addD(getToday(),-days);return (data.history||[]).filter(h=>h.type==='task-done'&&h.date>=from)}
function dayLoad(date){
  let tasks=openTasks().filter(t=>t.date===date),commitments=(data.commitments||[]).filter(c=>commitmentDateLocal(c)===date&&c.status!=='cancelled');
  let est=tasks.reduce((s,t)=>s+(num(t.estimate,30)||30),0),cm=commitments.reduce((s,c)=>{let a=new Date(c.start),b=c.end?new Date(c.end):new Date(a.getTime()+3600000),v=(b-a)/60000;return s+(Number.isFinite(v)&&v>0?v:60)},0);
  return {date,tasks,commitments,minutes:est+cm};
}
function procrastinationSignals(){return openTasks().filter(t=>(t.reschedules||0)>=2||(t.date&&isLate(t)&&daysBetween(t.date,getToday())>=3)).sort((a,b)=>(b.reschedules||0)-(a.reschedules||0)).slice(0,5)}
function habitCreatedDate(h){return String(h.createdAt||h.startDate||h.date||getToday()).slice(0,10)}
function habitSignals(){
  let hs=Array.isArray(data.habits)?data.habits.filter(h=>!h.archived):[];
  return hs.map(h=>{
    let scheduled=0,done=0,first=habitCreatedDate(h),elapsedDays=Math.max(0,daysBetween(first,getToday()));
    for(let i=0;i<14;i++){
      let d=addD(getToday(),-i);if(d<first)continue;
      let should=true;try{if(typeof isHabitScheduled==='function')should=isHabitScheduled(h,d)}catch{}
      if(should){scheduled++;let raw=data.habitLogs?.[`${h.id}_${d}`]??data.habitLogs?.[h.id]?.[d];let value=typeof raw==='object'?num(raw.value):num(raw);if(value>0)done++}
    }
    return {habit:h,scheduled,done,rate:scheduled?done/scheduled:1,elapsedDays,enough:scheduled>=4&&elapsedDays>=3};
  }).sort((a,b)=>(a.enough===b.enough?0:a.enough?-1:1)||(a.rate-b.rate));
}
function goalSignals(){return activeGoalsLocal().map(g=>({goal:g,pace:goalPaceLocal(g),updates:(data.goalUpdates||[]).filter(u=>u.goalId===g.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)))})).sort((a,b)=>{let r={'Atrasada':0,'Atenção':1,'No ritmo':2,'Início':3,'Adiantada':4,'Atingida':5};return (r[a.pace.label]??6)-(r[b.pace.label]??6)})}
function snapshot(){let wk=weekStart(),loads=Array.from({length:7},(_,i)=>dayLoad(addD(wk,i))),late=openTasks().filter(isLate),procrast=procrastinationSignals(),habits=habitSignals(),goals=goalSignals(),capacity=num(data.settings?.dailyCapacity,360)||360;return {loads,late,procrast,habits,goals,capacity}}
function smartInsights(){
  let s=snapshot(),out=[],td=dayLoad(getToday());
  if(td.minutes>s.capacity)out.push({level:'warn',title:'Dia acima da capacidade',text:`Você planejou cerca de ${Math.round(td.minutes)} min para hoje e sua capacidade configurada é ${s.capacity} min.`});
  if(s.late.length)out.push({level:'danger',title:`${s.late.length} tarefa(s) atrasada(s)`,text:`A mais antiga está atrasada há ${Math.max(...s.late.map(t=>daysBetween(t.date,getToday())))} dia(s).`});
  if(s.procrast.length)out.push({level:'warn',title:'Padrão de adiamento',text:`${s.procrast[0].name} já foi reagendada ${s.procrast[0].reschedules||0} vez(es). Talvez precise ser dividida ou redefinida.`});
  let weak=s.habits.find(x=>x.enough&&x.rate<.6);if(weak)out.push({level:'warn',title:'Constância em queda',text:`${weak.habit.name}: ${Math.round(weak.rate*100)}% de execução nas últimas ocorrências programadas.`});
  let goal=s.goals.find(x=>['Atrasada','Atenção'].includes(x.pace.label));if(goal)out.push({level:'warn',title:'Meta precisa de atenção',text:`${goal.goal.name} está em “${goal.pace.label}”.${goal.pace.projection!=null?` Projeção de ritmo: ${Math.round(goal.pace.projection)}% do necessário.`:''}`});
  let heavy=[...s.loads].sort((a,b)=>b.minutes-a.minutes)[0],light=[...s.loads].sort((a,b)=>a.minutes-b.minutes)[0];if(heavy&&light&&heavy.minutes-light.minutes>=120)out.push({level:'info',title:'Semana desequilibrada',text:`${fDate(heavy.date)} está cerca de ${Math.round(heavy.minutes-light.minutes)} min mais carregado que ${fDate(light.date)}.`});
  if(!out.length)out.push({level:'ok',title:'Planejamento equilibrado',text:'Não encontrei nenhum sinal importante que exija ajuste agora.'});
  return out.slice(0,5);
}
function dailyBriefingLocal(){let tasks=openTasks().filter(t=>t.date===getToday()||isLate(t)),late=tasks.filter(isLate).length,cs=(data.commitments||[]).filter(c=>commitmentDateLocal(c)===getToday()&&c.status!=='cancelled').length;let hs=(data.habits||[]).filter(h=>!h.archived).length;return `Hoje você tem ${tasks.length} tarefa(s), ${cs} compromisso(s) e ${hs} hábito(s) ativo(s).${late?` ${late} tarefa(s) estão atrasadas.`:''}`}
function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function findMentionedGoal(q){
  let nq=normalize(q),goals=activeGoalsLocal();
  return goals.find(g=>{let words=normalize(g.name).split(/\s+/).filter(w=>w.length>=4);return words.some(w=>nq.includes(w))})||null;
}
function goalAnswer(g){
  let p=Math.round(goalProgress(g)*100),pace=goalPaceLocal(g),remain=goalRemaining(g),dir=goalDirection(g),unit=g.unit||'';
  let movement=dir==='decrease'?`reduzir ${unitAfter(remain,unit)}`:`avançar ${unitAfter(remain,unit)}`;
  return `A meta “${g.name}” está em ${p}%. Você começou em ${unitAfter(g.startValue,unit)}, está em ${unitAfter(g.currentValue,unit)} e o alvo é ${unitAfter(g.targetValue,unit)}. Falta ${movement}. Ritmo: ${pace.label}.`;
}
function greeting(lower){return /^(oi+|ol[aá]|opa|e ai|e aí|bom dia|boa tarde|boa noite|hey|hello)[!.?\s]*$/.test(lower)}
function thanks(lower){return /^(obrigad[oa]|valeu|vlw|brigad[oa]|show|perfeito)[!.?\s]*$/.test(lower)}
function helpText(){return 'Posso analisar seu dia, semana, tarefas, hábitos e Metas SMART. Também consigo sugerir prioridades e identificar atrasos ou excesso de carga. Nada é alterado sem sua aprovação.'}
function answer(q){
  let s=snapshot(),lower=normalize(q),mentioned=findMentionedGoal(q);
  if(greeting(lower))return 'Oi! 👋 Posso analisar seu dia, semana, hábitos ou metas e ajudar a decidir o que merece atenção. O que você quer ver agora?';
  if(thanks(lower))return 'Por nada! Se quiser, posso continuar pela sua agenda de hoje, hábitos ou Metas SMART.';
  if(lower==='ajuda'||lower.includes('o que voce faz')||lower.includes('o que consegue'))return helpText();
  if(mentioned)return goalAnswer(mentioned);
  if(lower.includes('prior')){
    let candidates=openTasks().filter(t=>!t.date||t.date<=getToday()).sort((a,b)=>((isLate(b)?100:0)+(b.reschedules||0)*10+(b.goalId?8:0)+(b.dayPriority?20:0))-((isLate(a)?100:0)+(a.reschedules||0)*10+(a.goalId?8:0)+(a.dayPriority?20:0))).slice(0,3);
    return candidates.length?`Eu priorizaria agora: ${candidates.map((t,i)=>`${i+1}) ${t.name}`).join('; ')}. Considerei atraso, prioridade do dia, reagendamentos e vínculo com metas.`:'Não encontrei tarefas pendentes que justifiquem uma lista de prioridades agora.';
  }
  if(lower.includes('hab')){
    let enough=s.habits.filter(x=>x.enough);if(!enough.length)return 'Ainda não há histórico suficiente para avaliar constância dos seus hábitos com segurança. Vou evitar chamar começo de hábito de “queda”. Depois de algumas ocorrências programadas, consigo comparar melhor.';
    let w=enough[0];return `${w.habit.name} é o hábito que mais merece atenção entre os que já têm histórico suficiente: ${Math.round(w.rate*100)}% de execução nas últimas ocorrências programadas. Eu revisaria horário, frequência ou gatilho.`;
  }
  if(lower.includes('procrast')||lower.includes('adiamento')||lower.includes('adiando'))return s.procrast.length?`Encontrei ${s.procrast.length} sinal(is) de adiamento. O principal é “${s.procrast[0].name}”, reagendada ${s.procrast[0].reschedules||0} vez(es). Sugiro dividir a tarefa ou definir um próximo passo menor.`:'Não encontrei um padrão forte de procrastinação nas tarefas abertas.';
  if(lower.includes('semana')){let heavy=[...s.loads].sort((a,b)=>b.minutes-a.minutes)[0],total=s.loads.reduce((a,x)=>a+x.minutes,0);return `Sua semana tem aproximadamente ${Math.round(total/60*10)/10}h planejadas. O dia mais carregado é ${fDate(heavy.date)} com cerca de ${Math.round(heavy.minutes/60*10)/10}h. Posso detalhar onde está a maior carga.`}
  if(lower.includes('meta')){let g=s.goals[0];return g?goalAnswer(g.goal):'Você ainda não tem Meta SMART ativa para eu analisar.'}
  if(lower.includes('dia')||lower.includes('hoje')||lower.includes('organiza')){let ins=smartInsights().filter(x=>x.level!=='ok');return `${dailyBriefingLocal()}${ins.length?' '+ins.slice(0,2).map(x=>x.text).join(' '):' Seu planejamento não mostra nenhum alerta importante agora.'}`}
  if(lower.includes('tarefa'))return `Você tem ${openTasks().length} tarefa(s) aberta(s), sendo ${s.late.length} atrasada(s). Posso sugerir quais devem vir primeiro.`;
  return `Entendi. Para eu ser mais útil, posso olhar isso pelo seu dia, pela semana, pelas tarefas, pelos hábitos ou pelas metas. ${helpText()}`;
}
function renderChat(){
  let log=document.getElementById('assistantLog');if(!log)return;
  log.innerHTML=chatMemory.length?chatMemory.map(m=>`<div class="${m.role}">${escSafe(m.text)}</div>`).join(''):'<div class="assistant">Oi! 👋 Posso analisar seu dia, semana, hábitos ou metas e ajudar a decidir o que priorizar.</div>';
  log.scrollTop=log.scrollHeight;
}
window.v8SmartInsights=smartInsights;
window.v8IntelligenceSnapshot=snapshot;
window.v8LocalAdvancedAnswer=answer;
window.v8RenderSmartChat=renderChat;
window.v8GoalProgressLocal=g=>Math.round(goalProgress(g)*100);
window.v8GoalPaceLocal=goalPaceLocal;
window.v8GoalRemaining=goalRemaining;
window.sendAssistantV8=async function(e){
  e.preventDefault();let input=e.target?.message,q=String(input?.value||'').trim();if(!q)return;if(input)input.value='';
  chatMemory.push({role:'user',text:q,at:new Date().toISOString()});persistChat();renderChat();
  let response='';
  try{let res=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,context:{today:getToday()}})});if(res.ok){let j=await res.json();if(j&&j.provider==='openai')response=j.text||''}}catch{}
  if(!response)response=answer(q);
  chatMemory.push({role:'assistant',text:response,at:new Date().toISOString()});persistChat();renderChat();
};
window.askAssistantV8=function(q){window.sendAssistantV8({preventDefault(){},target:{message:{value:q}}})};
window.clearAssistantHistoryV8=function(){if(!confirm('Limpar o histórico do Assistente?'))return;chatMemory.splice(0);persistChat();renderChat();if(typeof toast==='function')toast('Histórico do Assistente limpo')};
window.startAssistantVoiceV8=function(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('Reconhecimento de voz indisponível neste navegador.');return}let r=new SR();r.lang='pt-BR';r.interimResults=false;r.onresult=e=>window.askAssistantV8(e.results[0][0].transcript);r.onerror=()=>{if(typeof toast==='function')toast('Não foi possível reconhecer a fala')};r.start();if(typeof toast==='function')toast('Pode falar…')};
})();