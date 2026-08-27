/* V8 Commitments — agenda events only; no SMART-goal relationship */
(function(){
'use strict';

function escSafe(s=''){return typeof esc==='function'?esc(s):String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function getToday(){return typeof today==='function'?today():new Date().toISOString().slice(0,10)}

// Remove legacy goal links from commitments without touching the commitments themselves.
let changed=false;
(data.commitments||[]).forEach(c=>{if(c.goalId){c.goalId='';changed=true}});
if(changed){try{save()}catch{}}

window.openCommitmentV8=function(id=''){
 const c=id?(data.commitments||[]).find(x=>x.id===id):{title:'',start:`${getToday()}T09:00`,end:`${getToday()}T10:00`,location:'',link:'',recurrence:'none',calendarSync:true};
 if(!c)return;
 openModal(id?'Editar compromisso':'Novo compromisso',`<form class="form" onsubmit="saveCommitmentV8(event,'${id}')"><label>Título<input name="title" required value="${escSafe(c.title||'')}" placeholder="Ex.: Aula, aniversário, consulta"></label><div class="formgrid"><label>Início<input name="start" type="datetime-local" required value="${escSafe(c.start||'')}"></label><label>Fim<input name="end" type="datetime-local" value="${escSafe(c.end||'')}"></label><label>Local<input name="location" value="${escSafe(c.location||'')}" placeholder="Ex.: Faculdade, igreja, clínica"></label><label>Link<input name="link" value="${escSafe(c.link||'')}" placeholder="Meet, Zoom, endereço online..."></label><label>Recorrência<select name="recurrence"><option value="none">Não repetir</option><option value="weekly" ${c.recurrence==='weekly'?'selected':''}>Semanal</option><option value="monthly" ${c.recurrence==='monthly'?'selected':''}>Mensal</option><option value="yearly" ${c.recurrence==='yearly'?'selected':''}>Anual</option></select></label></div><div class="callout"><b>📅 Compromisso = agenda</b><div class="meta">Use para aula, aniversário, consulta, reunião, culto, viagem ou qualquer horário em que você precisa estar presente.</div></div><label style="display:flex;align-items:center;gap:8px"><input name="calendarSync" type="checkbox" style="width:auto" ${c.calendarSync!==false?'checked':''}> Sincronizar com Google Agenda</label><button class="btn primary">Salvar compromisso</button></form>`)
};

window.saveCommitmentV8=function(e,id){
 e.preventDefault();const f=new FormData(e.target);let c=id?(data.commitments||[]).find(x=>x.id===id):{id:uid(),createdAt:new Date().toISOString(),status:'active'};if(!c)return;
 Object.assign(c,{title:String(f.get('title')||'').trim(),start:f.get('start'),end:f.get('end'),location:String(f.get('location')||'').trim(),link:String(f.get('link')||'').trim(),recurrence:f.get('recurrence')||'none',calendarSync:f.get('calendarSync')==='on',goalId:'',updatedAt:new Date().toISOString()});
 if(!id)data.commitments.push(c);save();closeModal();if(typeof render==='function')render();if(typeof toast==='function')toast('Compromisso salvo');
};
})();
