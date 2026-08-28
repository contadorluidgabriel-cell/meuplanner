/* V8 Google Tasks Sync — manual fallback only while Todoist owns task execution */
(function(){
'use strict';
const ENDPOINT='/functions/v1/google-tasks-sync';
let taskSyncing=false;

async function requestTasksSync(){
 const session=await ensureSession();
 if(!session?.access_token)throw new Error('Entre novamente no Planner.');
 const response=await fetch(`${SUPABASE_URL}${ENDPOINT}`,{
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
  body:JSON.stringify({action:'sync'})
 });
 const text=await response.text();let result={};
 try{result=text?JSON.parse(text):{}}catch{result={error:text}}
 if(!response.ok){const error=new Error(result.error||'Não foi possível sincronizar o Google Tasks.');error.code=result.code||'';throw error}
 return result;
}

window.enableGoogleTasksV8=async function(){
 if(!currentUser){toast('Entre no Planner primeiro');openAccount();return}
 try{
  const result=await googleCalendarRequest('connect',{returnTo:PRODUCTION_URL});
  if(result.url)location.href=result.url;else throw new Error('O Google não retornou a tela de autorização.');
 }catch(error){alert('Não foi possível ativar o Google Tasks: '+error.message)}
};

window.manualGoogleTasksSync=async function(options={}){
 if(taskSyncing||!currentUser||!navigator.onLine)return false;
 if(googleCalendarStatus.connected&&googleCalendarStatus.tasksAuthorized===false){
  if(!options.silent)toast('Autorize o Google Tasks em Ajustes');
  return false;
 }
 taskSyncing=true;
 if(!options.silent)toast('Sincronizando tarefas com o Google Tasks…');
 try{
  const result=await requestTasksSync();
  if(result.state)applyCloudState(result.state);
  if(!options.silent)toast('Tarefas sincronizadas com o Google Tasks');
  return true;
 }catch(error){
  console.error('V8 Google Tasks Sync:',error);
  if(error.code==='reauthorize'){
   googleCalendarStatus.tasksAuthorized=false;
   if(page==='settings')renderSettings();
   if(!options.silent)toast('Autorize o Google Tasks em Ajustes');
  }else if(!options.silent){alert('Não foi possível sincronizar tarefas: '+error.message)}
  return false;
 }finally{taskSyncing=false}
};

function injectTasksSettings(){
 if(typeof page!=='undefined'&&page!=='settings')return;
 const grid=document.querySelector('#content .grid.g2');
 if(!grid||document.getElementById('v8-google-tasks-card'))return;
 const connected=Boolean(googleCalendarStatus.connected);
 const authorized=Boolean(googleCalendarStatus.tasksAuthorized);
 const card=document.createElement('div');card.className='card form';card.id='v8-google-tasks-card';
 card.innerHTML=`<strong>✅ Google Tasks</strong>${
  !connected?'<div class="small muted">Conecte sua conta Google para usar o Google Tasks como alternativa manual.</div><button class="btn primary" onclick="connectGoogleCalendar()">Conectar Google</button>':
  !authorized?'<div class="small muted">Google Tasks está como alternativa manual. O Todoist é a execução principal das tarefas.</div><button class="btn primary" onclick="enableGoogleTasksV8()">Autorizar Google Tasks</button>':
  '<div class="sync-meta"><span><strong>Manual</strong></span><span class="small muted">Todoist é a sincronização principal de tarefas</span></div><button class="btn" onclick="manualGoogleTasksSync()">Sincronizar Google Tasks manualmente</button>'
 }</div>`;
 grid.appendChild(card);
}

const baseRenderSettings=window.renderSettings;
if(typeof baseRenderSettings==='function'){
 window.renderSettings=function(){baseRenderSettings();injectTasksSettings()};
}

window.addEventListener('load',injectTasksSettings);
setTimeout(injectTasksSettings,0);
})();
