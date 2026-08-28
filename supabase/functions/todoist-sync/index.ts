const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const TODOIST_TOKEN=Deno.env.get('TODOIST_API_TOKEN')||'';
const API='https://api.todoist.com/api/v1';
const APP_URL='https://meuplannerdigital.vercel.app/';

function cors(req:Request){const o=req.headers.get('origin')||'',app=new URL(APP_URL).origin,allowed=o===app||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);return {'Access-Control-Allow-Origin':allowed?o:app,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
async function parse(r:Response){const text=await r.text();let value:any=null;try{value=text?JSON.parse(text):null}catch{value=text}if(!r.ok){const e:any=new Error(typeof value==='string'?value:(value?.error||value?.message||`Erro ${r.status}`));e.status=r.status;throw e}return value}
async function admin(path:string,init:RequestInit={}){return parse(await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',...(init.headers||{})}}))}
async function authUser(req:Request){const a=req.headers.get('authorization')||'';if(!a.toLowerCase().startsWith('bearer '))return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:a}});return r.ok?await r.json():null}
async function todoist(path:string,init:RequestInit={}){if(!TODOIST_TOKEN){const e:any=new Error('Integração Todoist ainda precisa da chave de API.');e.code='setup_required';throw e}return parse(await fetch(`${API}${path}`,{...init,headers:{Authorization:`Bearer ${TODOIST_TOKEN}`,'Content-Type':'application/json',...(init.headers||{})}}))}
async function getConnection(userId:string){const rows:any=await admin(`todoist_connections?user_id=eq.${encodeURIComponent(userId)}&select=*`);return Array.isArray(rows)?rows[0]||null:null}
async function listActive(projectId:string){const all:any[]=[];let cursor='';for(;;){const q=new URLSearchParams({project_id:projectId,limit:'200'});if(cursor)q.set('cursor',cursor);const r:any=await todoist(`/tasks?${q}`);all.push(...(r?.results||[]));cursor=r?.next_cursor||'';if(!cursor)break}return all}
async function listActivities(projectId:string,fromIso:string){const all:any[]=[];let cursor='';for(let page=0;page<5;page++){const q=new URLSearchParams({parent_project_id:projectId,object_type:'item',date_from:fromIso,limit:'200'});if(cursor)q.set('cursor',cursor);const r:any=await todoist(`/activities?${q}`);all.push(...(r?.results||[]));cursor=r?.next_cursor||'';if(!cursor)break}return all}
function dateOnly(v:any){const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function priority(t:any){const p=String(t?.priority||'').toLowerCase();if(p==='urgent'||p==='p1')return 4;if(p==='high'||p==='alta'||p==='p2')return 3;if(p==='normal'||p==='p3')return 2;return 1}
function taskPayload(t:any,c:any){return {content:t.name||'Tarefa',description:`Meu Planner Digital\nTYPE:TASK\nID:${t.id}`,project_id:c.project_id,section_id:c.tasks_section_id||undefined,labels:['planner-tarefa'],priority:priority(t),due_date:dateOnly(t.date)}}
function eventDate(e:any){return String(e?.event_date||e?.eventDate||e?.created_at||'')}
function latestCompletionEvents(events:any[]){const map=new Map<string,any>();for(const e of events){const type=String(e?.event_type||e?.eventType||'');if(type!=='completed'&&type!=='uncompleted')continue;const id=String(e?.object_id||e?.objectId||'');if(!id)continue;const prev=map.get(id);if(!prev||eventDate(e)>eventDate(prev))map.set(id,e)}return map}

async function syncUser(userId:string){
 const c:any=await getConnection(userId);if(!c||!c.enabled){const e:any=new Error('Todoist ainda não está ativado para esta conta.');e.code='not_connected';throw e}
 if(!TODOIST_TOKEN){const e:any=new Error('Integração Todoist ainda precisa da chave de API.');e.code='setup_required';throw e}
 const rows:any=await admin(`planner_state?user_id=eq.${encodeURIComponent(userId)}&select=state,schema_version`),state=rows?.[0]?.state||{};state.tasks=Array.isArray(state.tasks)?state.tasks:[];
 const active=await listActive(c.project_id),activeById=new Map(active.map((x:any)=>[String(x.id),x]));
 const activities=await listActivities(c.project_id,new Date(Date.now()-14*24*60*60*1000).toISOString()),completion=latestCompletionEvents(activities);
 let created=0,updated=0,pulled=0,closed=0,reopened=0;const now=new Date().toISOString();
 for(let i=0;i<state.tasks.length;i++){const t=state.tasks[i];if(!t?.id||t.todoistSync===false)continue;const rid=String(t.todoistTaskId||'');if(!rid)continue;const ev:any=completion.get(rid);if(!ev)continue;const when=eventDate(ev)||now;if(t.todoistSyncedAt&&new Date(when)<=new Date(t.todoistSyncedAt))continue;const desired=String(ev.event_type||ev.eventType)==='completed'?'done':'todo';if(t.status!==desired){state.tasks[i]={...t,status:desired,completedAt:desired==='done'?(t.completedAt||String(when).slice(0,10)):null,updatedAt:when,todoistSyncedAt:when};pulled++}else state.tasks[i]={...t,todoistSyncedAt:when}}
 for(let i=0;i<state.tasks.length;i++){
   let t=state.tasks[i];if(!t?.id||t.todoistSync===false)continue;let rid=String(t.todoistTaskId||''),remote=rid?activeById.get(rid):null;const ev:any=rid?completion.get(rid):null,remoteDone=ev&&String(ev.event_type||ev.eventType)==='completed';
   if(rid&&!remote&&t.status!=='done'&&remoteDone){try{await todoist(`/tasks/${encodeURIComponent(rid)}/reopen`,{method:'POST'});reopened++;remote={id:rid}}catch(e){if((e as any).status!==404)throw e;rid=''}}
   if(!rid||(!remote&&!remoteDone&&t.status!=='done')){const saved:any=await todoist('/tasks',{method:'POST',body:JSON.stringify(taskPayload(t,c))});rid=String(saved.id);remote=saved;created++}
   else if(remote){await todoist(`/tasks/${encodeURIComponent(rid)}`,{method:'POST',body:JSON.stringify(taskPayload(t,c))});updated++}
   if(t.status==='done'&&rid&&remote){await todoist(`/tasks/${encodeURIComponent(rid)}/close`,{method:'POST'});closed++;remote=null}
   state.tasks[i]={...t,todoistTaskId:rid,todoistSyncedAt:now};
 }
 await admin('planner_state?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,schema_version:8,state,updated_at:now})});
 await admin(`todoist_connections?user_id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_synced_at:now,updated_at:now})});
 return {tasks:state.tasks,created,updated,pulled,closed,reopened,lastSyncedAt:now};
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});if(req.method!=='POST')return json(req,{error:'Método não permitido'},405);let body:any={};try{body=await req.json()}catch{}
 const u=await authUser(req);if(!u?.id)return json(req,{error:'Entre no Planner para sincronizar'},401);
 try{const c:any=await getConnection(u.id);if(body.action==='status')return json(req,{ok:true,connected:Boolean(c?.enabled),configured:Boolean(TODOIST_TOKEN),projectId:c?.project_id||null,lastSyncedAt:c?.last_synced_at||null});if(body.action==='sync')return json(req,{ok:true,...await syncUser(u.id)});return json(req,{error:'Ação desconhecida'},400)}catch(e){console.error(e);return json(req,{error:e instanceof Error?e.message:'Falha na sincronização',code:(e as any)?.code||null},500)}
});