/* V8 Microsoft To Do — tarefas e hábitos */
(function(){
'use strict';
const ENDPOINT='/functions/v1/microsoft-todo';
let status={connected:false,ready:false,email:'',lastSyncedAt:null};
let syncing=false;

async function request(action,payload={}){
 const session=await ensureSession();
 if(!session?.access_token)throw new Error('Entre novamente no Planner.');
 const response=await fetch(`${SUPABASE_URL}${ENDPOINT}`,{
  method:'POST',
  headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
  body:JSON.stringify({action,...payload})
 });
 const text=await response.text();let result={};
 try{result=text?JSON.parse(text):{}}catch{result={error:text}}
 if(!response.ok)throw new Error(result.error||'Não foi possível acessar o Microsoft To Do.');
 return result;
}

window.refreshMicrosoftTodoStatus=async function(){
 if(!currentUser){status={connected:false,ready:false,email:'',lastSyncedAt:null};return status}
 try{const r=await request('status');status={...status,...r};return status}catch(e){console.warn('Microsoft To Do status:',e);return status}
};

window.connectMicrosoftTodo=async function(){
 if(!currentUser){toast('Entre no Planner primeiro');openAccount();return}
 try{
  const r=await request('connect',{returnTo:PRODUCTION_URL});
  if(r.url)location.href=r.url;else throw new Error(r.error||'A autorização da Microsoft não foi iniciada.');
 }catch(e){alert('Não foi possível conectar o Microsoft To Do: '+e.message)}
};

window.manualMicrosoftTodoSync=async function(options={}){
 if(syncing||!currentUser||!navigator.onLine)return false;
 syncing=true;
 if(!options.silent)toast('Sincronizando tarefas e hábitos com o Microsoft To Do…');
 try{
  const r=await request('sync');
  // A integração Microsoft nunca deve substituir domínios alheios.
  // Só aplica tarefas, hábitos e registros de hábitos retornados pelo backend.
  if(r.state){
   if(Array.isArray(r.state.tasks))data.tasks=r.state.tasks;
   if(Array.isArray(r.state.habits))data.habits=r.state.habits;
   if(r.state.habitLogs&&typeof r.state.habitLogs==='object')data.habitLogs=r.state.habitLogs;
   save();render();
  }
  status={...status,connected:true,ready:true,lastSyncedAt:r.lastSyncedAt||new Date().toISOString()};
  if(!options.silent)toast('Microsoft To Do sincronizado');
  return true;
 }catch(e){console.error('Microsoft To Do sync:',e);if(!options.silent)alert('Falha na sincronização com o Microsoft To Do: '+e.message);return false}
 finally{syncing=false}
};

function injectCard(){
 if(typeof page!=='undefined'&&page!=='settings')return;
 const grid=document.querySelector('#content .grid.g2');
 if(!grid||document.getElementById('v8-microsoft-todo-card'))return;
 const card=document.createElement('div');card.className='card form';card.id='v8-microsoft-todo-card';
 let body='';
 if(!status.ready)body='<div class="small muted">Integração para tarefas e hábitos. O Planner continua sendo a fonte principal.</div><button class="btn primary" onclick="connectMicrosoftTodo()">Conectar Microsoft To Do</button>';
 else if(!status.connected)body='<div class="small muted">Conecte sua conta Microsoft para marcar tarefas e hábitos pelo celular.</div><button class="btn primary" onclick="connectMicrosoftTodo()">Conectar Microsoft To Do</button>';
 else body=`<div class="sync-meta"><span><strong>Ativo</strong></span><span class="small muted">${esc(status.email||'Microsoft To Do')} · Tarefas e hábitos</span></div><button class="btn primary" onclick="manualMicrosoftTodoSync()">Sincronizar agora</button>`;
 card.innerHTML=`<strong>☑ Microsoft To Do</strong>${body}`;
 grid.appendChild(card);
}

const base=window.renderSettings;
if(typeof base==='function')window.renderSettings=function(){base();setTimeout(async()=>{await window.refreshMicrosoftTodoStatus();injectCard()},0)};
window.addEventListener('load',async()=>{await window.refreshMicrosoftTodoStatus();injectCard()});
})();
