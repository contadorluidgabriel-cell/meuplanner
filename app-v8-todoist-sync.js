/* V8 Todoist Sync — phase 1: Planner tasks <-> Todoist */
(function(){
'use strict';
const ENDPOINT='/functions/v1/todoist-sync';
let syncing=false;
let status={connected:false,configured:false,lastSyncedAt:null};

async function requestTodoist(action){
 const session=await ensureSession();
 if(!session?.access_token)throw new Error('Entre novamente no Planner.');
 const response=await fetch(`${SUPABASE_URL}${ENDPOINT}`,{
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
  body:JSON.stringify({action})
 });
 const text=await response.text();let result={};
 try{result=text?JSON.parse(text):{}}catch{result={error:text}}
 if(!response.ok){const error=new Error(result.error||'Não foi possível acessar o Todoist.');error.code=result.code||'';throw error}
 return result;
}

function applyTasksOnly(tasks){
 if(!Array.isArray(tasks))return;
 applyingRemote=true;
 data.tasks=tasks;
 const serialized=JSON.stringify(data);
 lastSavedState=serialized;
 storageSet(KEY,serialized);
 if(currentUser)storageSet(userCacheKey(currentUser.id),serialized);
 render();
 applyingRemote=false;
}

async function loadStatus(){
 if(!currentUser)return status;
 try{status=await requestTodoist('status');}
 catch(error){console.warn('Todoist status:',error);status={connected:false,configured:false,lastSyncedAt:null,error:error.message};}
 injectSettings();
 return status;
}

window.manualTodoistSync=async function(options={}){
 if(syncing||!currentUser||!navigator.onLine)return false;
 syncing=true;
 if(!options.silent)toast('Sincronizando tarefas com o Todoist…');
 try{
  const result=await requestTodoist('sync');
  if(result.tasks)applyTasksOnly(result.tasks);
  status={...status,connected:true,configured:true,lastSyncedAt:result.lastSyncedAt||new Date().toISOString()};
  injectSettings(true);
  if(!options.silent)toast('Tarefas sincronizadas com o Todoist');
  return true;
 }catch(error){
  console.error('V8 Todoist Sync:',error);
  if(error.code==='setup_required'){
   status={...status,connected:true,configured:false};
   if(!options.silent)toast('Falta concluir a configuração do Todoist');
  }else if(!options.silent){alert('Não foi possível sincronizar com o Todoist: '+error.message)}
  injectSettings(true);
  return false;
 }finally{syncing=false}
};

function fmtSyncDate(v){
 if(!v)return 'Ainda não sincronizado';
 try{return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return 'Sincronizado'}
}
function injectSettings(replace=false){
 if(typeof page!=='undefined'&&page!=='settings')return;
 const grid=document.querySelector('#content .grid.g2');if(!grid)return;
 let card=document.getElementById('v8-todoist-card');
 if(card&&replace)card.remove();else if(card)return;
 card=document.createElement('div');card.className='card form';card.id='v8-todoist-card';
 const ready=Boolean(status.connected&&status.configured);
 card.innerHTML=`<strong>☑️ Todoist</strong>${
  ready
   ?`<div class="sync-meta"><span><strong>Ativo</strong></span><span class="small muted">Tarefas do Planner ↔ Todoist</span></div><div class="small muted">Última sincronização: ${fmtSyncDate(status.lastSyncedAt)}</div><button class="btn primary" onclick="manualTodoistSync()">Sincronizar agora</button>`
   :status.connected
    ?'<div class="small muted">Estrutura pronta. Falta somente liberar a chave da API do Todoist no servidor.</div><button class="btn" onclick="manualTodoistSync()">Testar configuração</button>'
    :'<div class="small muted">Integração preparada para usar o Todoist como execução rápida das tarefas no celular.</div>'
 }</div>`;
 grid.appendChild(card);
}

const baseRenderSettings=window.renderSettings;
if(typeof baseRenderSettings==='function'){
 window.renderSettings=function(){baseRenderSettings();injectSettings(true);loadStatus()};
}

let interval=null;
function startForegroundFallback(){
 clearInterval(interval);
 interval=setInterval(()=>{if(currentUser&&navigator.onLine&&status.connected&&status.configured)window.manualTodoistSync({silent:true})},15*60*1000);
}
window.addEventListener('load',()=>{setTimeout(loadStatus,800);startForegroundFallback()});
setTimeout(()=>{if(currentUser)loadStatus()},1200);
})();