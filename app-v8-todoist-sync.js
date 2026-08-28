/* V8 Todoist Sync — tasks + daily habit occurrences */
(function(){
'use strict';
const ENDPOINT='/functions/v1/todoist-sync';
let syncing=false;
let status={connected:false,configured:false,lastSyncedAt:null};
let interval=null;
let syncTimer=null;
let lastFingerprint='';

async function requestTodoist(action){
 const session=await ensureSession();
 if(!session?.access_token)throw new Error('Entre novamente no Planner.');
 const response=await fetch(`${SUPABASE_URL}${ENDPOINT}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action})});
 const text=await response.text();let result={};
 try{result=text?JSON.parse(text):{}}catch{result={error:text}}
 if(!response.ok){const error=new Error(result.error||'Não foi possível acessar o Todoist.');error.code=result.code||'';throw error}
 return result;
}

function syncFingerprint(){
 try{return JSON.stringify({tasks:(data?.tasks||[]).map(t=>({id:t.id,name:t.name,date:t.date,status:t.status,priority:t.priority,updatedAt:t.updatedAt,todoistSync:t.todoistSync})),habits:(data?.habits||[]).map(h=>({id:h.id,name:h.name,type:h.type,target:h.target,freqType:h.freqType,specificDays:h.specificDays,weeklyGoal:h.weeklyGoal,paused:h.paused,pauseUntil:h.pauseUntil,archived:h.archived,todoistSync:h.todoistSync})),habitLogs:data?.habitLogs||{}})}catch{return ''}
}

function applyTodoistDomains(result){
 applyingRemote=true;
 try{
  if(Array.isArray(result.tasks))data.tasks=result.tasks;
  if(Array.isArray(result.habits))data.habits=result.habits;
  if(result.habitLogs&&typeof result.habitLogs==='object')data.habitLogs=result.habitLogs;
  lastFingerprint=syncFingerprint();
  const serialized=JSON.stringify(data);
  lastSavedState=serialized;
  storageSet(KEY,serialized);
  if(currentUser)storageSet(userCacheKey(currentUser.id),serialized);
  if(typeof render==='function')render();
 }finally{applyingRemote=false}
}

async function loadStatus(){if(!currentUser)return status;try{status=await requestTodoist('status')}catch(error){console.warn('Todoist status:',error);status={connected:false,configured:false,lastSyncedAt:null,error:error.message}}injectSettings();return status}

window.manualTodoistSync=async function(options={}){
 if(syncing||!currentUser||!navigator.onLine)return false;syncing=true;
 if(!options.silent)toast('Sincronizando com o Todoist…');
 try{const result=await requestTodoist('sync');applyTodoistDomains(result);status={...status,connected:true,configured:true,lastSyncedAt:result.lastSyncedAt||new Date().toISOString()};injectSettings(true);if(!options.silent)toast('Todoist sincronizado');return true}
 catch(error){console.error('V8 Todoist Sync:',error);if(error.code==='setup_required'){status={...status,connected:true,configured:false};if(!options.silent)toast('Falta concluir a configuração do Todoist')}else if(!options.silent)alert('Não foi possível sincronizar com o Todoist: '+error.message);injectSettings(true);return false}
 finally{syncing=false}
};

async function pullFreshTodoistState(){
 if(!currentUser||!navigator.onLine||!status.connected||!status.configured)return false;
 return window.manualTodoistSync({silent:true});
}

function scheduleImmediateSync(){if(!currentUser||!navigator.onLine||!status.connected||!status.configured)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>window.manualTodoistSync({silent:true}),1200)}
function fmtSyncDate(v){if(!v)return 'Ainda não sincronizado';try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return 'Sincronizado'}}
function injectSettings(replace=false){
 if(typeof page!=='undefined'&&page!=='settings')return;const grid=document.querySelector('#content .grid.g2');if(!grid)return;let card=document.getElementById('v8-todoist-card');if(card&&replace)card.remove();else if(card)return;card=document.createElement('div');card.className='card form';card.id='v8-todoist-card';const ready=Boolean(status.connected&&status.configured);
 card.innerHTML=`<strong>☑️ Todoist</strong>${ready?`<div class="sync-meta"><span><strong>Ativo</strong></span><span class="small muted">Tarefas + hábitos do Planner ↔ Todoist</span></div><div class="small muted">Hábitos aparecem como uma ocorrência por dia na seção Hábitos.</div><div class="small muted">Automático a cada 1 minuto + atualização ao voltar para o Planner.</div><div class="small muted">Última sincronização: ${fmtSyncDate(status.lastSyncedAt)}</div><button class="btn primary" onclick="manualTodoistSync()">Sincronizar agora</button>`:status.connected?'<div class="small muted">Estrutura pronta. Falta somente liberar a chave da API do Todoist no servidor.</div><button class="btn" onclick="manualTodoistSync()">Testar configuração</button>':'<div class="small muted">Integração preparada para usar o Todoist como execução rápida no celular.</div>'}</div>`;grid.appendChild(card)
}

const baseRenderSettings=window.renderSettings;if(typeof baseRenderSettings==='function')window.renderSettings=function(){baseRenderSettings();injectSettings(true);loadStatus()};
const baseSave=window.save;if(typeof baseSave==='function')window.save=function(...args){const result=baseSave.apply(this,args),fp=syncFingerprint();if(fp!==lastFingerprint){lastFingerprint=fp;scheduleImmediateSync()}return result};
function startForegroundSync(){clearInterval(interval);interval=setInterval(()=>{pullFreshTodoistState()},30*1000)}
function syncOnReturn(){if(document.visibilityState==='visible')setTimeout(()=>pullFreshTodoistState(),250)}
document.addEventListener('visibilitychange',syncOnReturn);window.addEventListener('focus',()=>setTimeout(()=>pullFreshTodoistState(),250));window.addEventListener('pageshow',()=>setTimeout(()=>pullFreshTodoistState(),250));
window.addEventListener('load',()=>{setTimeout(async()=>{await loadStatus();lastFingerprint=syncFingerprint();if(status.connected&&status.configured)await pullFreshTodoistState()},800);startForegroundSync()});
setTimeout(async()=>{if(currentUser){await loadStatus();if(status.connected&&status.configured)pullFreshTodoistState()}},1200);
})();