/* V8 UX polish — safe additive DOM refinements */
(function(){
'use strict';

function numberText(v){let n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:2}):String(v??'')}
function unitText(v,u){return `${numberText(v)}${u?` ${u}`:''}`}
function dateText(s){try{return typeof fmt==='function'?fmt(s):new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${s}T12:00:00`))}catch{return s||'—'}}
function progress(g){return typeof window.v8GoalProgressLocal==='function'?window.v8GoalProgressLocal(g):0}
function remaining(g){return typeof window.v8GoalRemaining==='function'?window.v8GoalRemaining(g):Math.abs(Number(g.targetValue||0)-Number(g.currentValue||0))}
function pace(g){return typeof window.v8GoalPaceLocal==='function'?window.v8GoalPaceLocal(g):{label:'Em andamento'} }
function updates(g){return (data.goalUpdates||[]).filter(u=>u.goalId===g.id)}
function daysBetween(a,b){let da=new Date(`${a}T12:00:00`),db=new Date(`${b}T12:00:00`);return Math.max(0,Math.round((db-da)/86400000))}

function goalRhythmText(g){
  const left=remaining(g),days=Math.max(1,daysBetween(new Date().toISOString().slice(0,10),g.deadline||new Date().toISOString().slice(0,10))),weeks=Math.max(days/7,1/7);
  if(progress(g)>=100)return 'Meta atingida — confirme a conclusão quando estiver pronto.';
  if(!left)return 'Você chegou ao valor-alvo.';
  const perWeek=left/weeks;
  const verb=Number(g.targetValue)<Number(g.startValue)?'reduzir':'avançar';
  return `Falta ${unitText(left,g.unit)} · ritmo médio necessário: ${numberText(perWeek)} ${g.unit||'un.'}/semana para ${verb} até o prazo`;
}

function polishGoals(){
  if(typeof page!=='undefined'&&page!=='goals')return;
  const cards=[...document.querySelectorAll('.v8-goal-card')];
  if(!cards.length)return;
  const goals=(data.goals||[]);
  cards.forEach((card,i)=>{
    const g=goals[i];if(!g)return;
    const signature=[g.currentValue,g.targetValue,g.startValue,g.deadline,updates(g).length].join('|');
    if(card.dataset.polished===signature)return;
    card.dataset.polished=signature;
    const p=progress(g),pc=pace(g),direction=Number(g.targetValue)<Number(g.startValue)?'Redução':'Crescimento';
    const values=card.querySelector('.v8-goal-values');
    if(values) values.innerHTML=`<div class="v8-goal-value-block"><span>Atual</span><b>${unitText(g.currentValue,g.unit)}</b></div><div class="v8-goal-arrow">→</div><div class="v8-goal-value-block"><span>Meta</span><b>${unitText(g.targetValue,g.unit)}</b></div><strong>${p}%</strong>`;
    const pill=card.querySelector('.pill');
    if(pill){pill.textContent=pc.label;pill.title=`${direction} · progresso manual`;}
    const small=card.querySelector('.small.muted');
    if(small)small.textContent=`Prazo: ${dateText(g.deadline)} · ${goalRhythmText(g)}`;
    const head=card.querySelector('.v8-goal-head .label');
    if(head&&!head.dataset.direction){head.dataset.direction='1';head.textContent=`${g.area||'Meta SMART'} · ${direction}`;}
  });
}

function polishAssistant(){
  if(typeof page!=='undefined'&&page!=='assistant')return;
  const card=document.querySelector('.v8-assistant');if(!card)return;
  if(typeof window.v8RenderSmartChat==='function')window.v8RenderSmartChat();
  if(!card.querySelector('.v8-ai-status')){
    const status=document.createElement('div');status.className='v8-ai-status';status.innerHTML='<span></span> Inteligência local ativa';card.prepend(status);
  }
  const chips=card.querySelector('.v8-assistant-chips');
  if(chips&&!chips.dataset.polished){
    chips.dataset.polished='1';
    chips.innerHTML='<button onclick="askAssistantV8(\'Organize meu dia\')">☀️ Organizar meu dia</button><button onclick="askAssistantV8(\'Analise minha semana\')">🧭 Analisar semana</button><button onclick="askAssistantV8(\'Quais metas precisam de atenção?\')">🎯 Revisar metas</button><button onclick="askAssistantV8(\'Analise meus hábitos\')">🔄 Ver hábitos</button><button onclick="askAssistantV8(\'O que devo priorizar hoje?\')">💡 O que priorizar?</button>';
  }
  const form=card.querySelector('.v8-chat-form');
  if(form&&!card.querySelector('.v8-chat-tools')){
    const tools=document.createElement('div');tools.className='v8-chat-tools';tools.innerHTML='<button type="button" onclick="startAssistantVoiceV8()">🎙 Falar</button><button type="button" onclick="clearAssistantHistoryV8()">🗑 Limpar conversa</button>';
    form.after(tools);
  }
}

function hideLegacyMobileFab(){
  document.querySelectorAll('.mobile-fab').forEach(el=>{el.style.display='none'});
}

function apply(){hideLegacyMobileFab();polishGoals();polishAssistant();}
const observer=new MutationObserver(()=>requestAnimationFrame(apply));
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',()=>setTimeout(apply,0));
setTimeout(apply,0);
})();