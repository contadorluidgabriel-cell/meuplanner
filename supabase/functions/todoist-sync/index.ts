const SUPABASE_URL=Deno.env.get('SUPABASE_URL')||'';
const SUPABASE_ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')||'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const TODOIST_TOKEN=Deno.env.get('TODOIST_API_TOKEN')||'';
const API='https://api.todoist.com/api/v1';
const APP_URL='https://meuplannerdigital.vercel.app/';

function cors(req:Request){const o=req.headers.get('origin')||'',app=new URL(APP_URL).origin,allowed=o===app||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);return {'Access-Control-Allow-Origin':allowed?o:app,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-planner-cron','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
async function parse(r:Response){const text=await r.text();let value:any=null;try{value=text?JSON.parse(text):null}catch{value=text}if(!r.ok){const e:any=new Error(typeof value==='string'?value:(value?.error||value?.message||`Erro ${r.status}`));e.status=r.status;throw e}return value}
async function admin(path:string,init:RequestInit={}){return parse(await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',...(init.headers||{})}}))}
async function rpc(name:string,b:Record<string,unknown>={}){return admin(`rpc/${name}`,{method:'POST',body:JSON.stringify(b)})}
async function authUser(req:Request){const a=req.headers.get('authorization')||'';if(!a.toLowerCase().startsWith('bearer '))return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:a}});return r.ok?await r.json():null}
async function todoist(path:string,init:RequestInit={}){if(!TODOIST_TOKEN){const e:any=new Error('Integração Todoist ainda precisa da chave de API.');e.code='setup_required';throw e}return parse(await fetch(`${API}${path}`,{...init,headers:{Authorization:`Bearer ${TODOIST_TOKEN}`,'Content-Type':'application/json',...(init.headers||{})}}))}
async function getConnection(userId:string){const rows:any=await admin(`todoist_connections?user_id=eq.${encodeURIComponent(userId)}&select=*`);return Array.isArray(rows)?rows[0]||null:null}
async function listActive(projectId:string){const all:any[]=[];let cursor='';for(;;){const q=new URLSearchParams({project_id:projectId,limit:'200'});if(cursor)q.set('cursor',cursor);const r:any=await todoist(`/tasks?${q}`);all.push(...(r?.results||[]));cursor=r?.next_cursor||'';if(!cursor)break}return all}
async function listCompleted(projectId:string,lastSyncedAt?:string|null){const all:any[]=[];let cursor='';const until=new Date().toISOString();const base=lastSyncedAt?new Date(lastSyncedAt).getTime()-24*60*60*1000:Date.now()-30*24*60*60*1000;const since=new Date(base).toISOString();for(;;){const q=new URLSearchParams({since,until,project_id:projectId,limit:'200'});if(cursor)q.set('cursor',cursor);const r:any=await todoist(`/tasks/completed/by_completion_date?${q}`);all.push(...(r?.items||r?.results||[]));cursor=r?.next_cursor||'';if(!cursor)break}return all}
function dateOnly(v:any){const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function priority(t:any){const p=String(t?.priority||'').toLowerCase();if(p==='urgent'||p==='p1')return 4;if(p==='high'||p==='alta'||p==='p2')return 3;if(p==='normal'||p==='p3')return 2;return 1}
function taskPayload(t:any,c:any){const payload:any={content:t.name||'Tarefa',description:`Meu Planner Digital\nTYPE:TASK\nID:${t.id}`,project_id:c.project_id,section_id:c.tasks_section_id||undefined,labels:['planner-tarefa'],priority:priority(t)};const due=dateOnly(t.date);if(due)payload.due_date=due;return payload}
function plannerId(remote:any){const d=String(remote?.description||'');const m=d.match(/(?:^|\n)TYPE:TASK\s*\nID:([^\n]+)/i)||d.match(/(?:^|\n)ID:([^\n]+)/i);return m?String(m[1]).trim():''}
function mapByPlannerId(items:any[]){const m=new Map<string,any>();for(const item of items){const id=plannerId(item);if(id&&!m.has(id))m.set(id,item)}return m}

async function syncUser(userId:string){
 const c:any=await getConnection(userId);if(!c||!c.enabled){const e:any=new Error('Todoist ainda não está ativado para esta conta.');e.code='not_connected';throw e}
 if(!TODOIST_TOKEN){const e:any=new Error('Integração Todoist ainda precisa da chave de API.');e.code='setup_required';throw e}
 const rows:any=await admin(`planner_state?user_id=eq.${encodeURIComponent(userId)}&select=state,schema_version`),state=rows?.[0]?.state||{};state.tasks=Array.isArray(state.tasks)?state.tasks:[];
 const active=await listActive(c.project_id),activeById=new Map(active.map((x:any)=>[String(x.id),x])),activeByPlanner=mapByPlannerId(active);
 const completed=await listCompleted(c.project_id,c.last_synced_at),completedById=new Map(completed.map((x:any)=>[String(x.id),x])),completedByPlanner=mapByPlannerId(completed);
 let created=0,updated=0,pulled=0,closed=0,reopened=0,adopted=0;const now=new Date().toISOString();

 for(let i=0;i<state.tasks.length;i++){
   let t=state.tasks[i];if(!t?.id||t.todoistSync===false)continue;
   let rid=String(t.todoistTaskId||''),remote=rid?activeById.get(rid):null,done=rid?completedById.get(rid):null;
   if((!rid||(!remote&&!done))&&t.id){
     const foundActive=activeByPlanner.get(String(t.id)),foundDone=completedByPlanner.get(String(t.id));
     if(foundActive){rid=String(foundActive.id);remote=foundActive;done=null;adopted++}
     else if(foundDone){rid=String(foundDone.id);done=foundDone;remote=null;adopted++}
     if(rid)state.tasks[i]={...t,todoistTaskId:rid,todoistSyncedAt:t.todoistSyncedAt||now};
   }
 }

 for(let i=0;i<state.tasks.length;i++){
   const t=state.tasks[i];if(!t?.id||t.todoistSync===false||!t.todoistTaskId)continue;
   const rid=String(t.todoistTaskId),remote=activeById.get(rid)||activeByPlanner.get(String(t.id)),done:any=completedById.get(rid)||completedByPlanner.get(String(t.id));
   if(done&&!remote){const when=String(done.completed_at||done.updated_at||now);if(t.status!=='done'){state.tasks[i]={...t,status:'done',completedAt:String(when).slice(0,10),updatedAt:when,todoistSyncedAt:when};pulled++}}
   else if(remote&&t.status==='done'&&t.todoistSyncedAt&&new Date(remote.updated_at||remote.updatedAt||0)>new Date(t.todoistSyncedAt)){const when=String(remote.updated_at||remote.updatedAt||now);state.tasks[i]={...t,status:'todo',completedAt:null,updatedAt:when,todoistSyncedAt:when};pulled++}
 }

 for(let i=0;i<state.tasks.length;i++){
   let t=state.tasks[i];if(!t?.id||t.todoistSync===false)continue;
   let rid=String(t.todoistTaskId||''),remote=rid?activeById.get(rid):null,done=rid?completedById.get(rid):null;
   if(!remote&&!done){const foundActive=activeByPlanner.get(String(t.id)),foundDone=completedByPlanner.get(String(t.id));if(foundActive){rid=String(foundActive.id);remote=foundActive}else if(foundDone){rid=String(foundDone.id);done=foundDone}}
   if(!rid){const saved:any=await todoist('/tasks',{method:'POST',body:JSON.stringify(taskPayload(t,c))});rid=String(saved.id);remote=saved;created++}
   else if(!remote&&!done&&t.status!=='done'){const saved:any=await todoist('/tasks',{method:'POST',body:JSON.stringify(taskPayload(t,c))});rid=String(saved.id);remote=saved;created++}
   else if(remote){await todoist(`/tasks/${encodeURIComponent(rid)}`,{method:'POST',body:JSON.stringify(taskPayload(t,c))});updated++}
   if(t.status==='done'&&rid&&remote){await todoist(`/tasks/${encodeURIComponent(rid)}/close`,{method:'POST'});closed++;remote=null}
   else if(t.status!=='done'&&rid&&!remote&&done){await todoist(`/tasks/${encodeURIComponent(rid)}/reopen`,{method:'POST'});reopened++}
   state.tasks[i]={...state.tasks[i],todoistTaskId:rid,todoistSyncedAt:now};
 }
 await admin('planner_state?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,schema_version:8,state,updated_at:now})});
 await admin(`todoist_connections?user_id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_synced_at:now,updated_at:now})});
 return {tasks:state.tasks,created,updated,pulled,closed,reopened,adopted,lastSyncedAt:now};
}

async function cronOk(req:Request){const provided=req.headers.get('x-planner-cron')||'',expected=String(await rpc('get_push_cron_secret')||'');return Boolean(expected&&provided===expected)}
async function syncAll(req:Request){if(!await cronOk(req))return json(req,{error:'Não autorizado'},401);const rows:any=await admin('todoist_connections?enabled=eq.true&select=user_id');let synced=0,failed=0;const errors:any[]=[];for(const r of Array.isArray(rows)?rows:[]){try{await syncUser(r.user_id);synced++}catch(e){failed++;errors.push({userId:r.user_id,error:e instanceof Error?e.message:'Falha'})}}return json(req,{ok:true,synced,failed,errors:errors.slice(0,10)})}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});if(req.method!=='POST')return json(req,{error:'Método não permitido'},405);let body:any={};try{body=await req.json()}catch{}
 try{
  if(body.action==='cron')return await syncAll(req);
  const u=await authUser(req);if(!u?.id)return json(req,{error:'Entre no Planner para sincronizar'},401);
  const c:any=await getConnection(u.id);
  if(body.action==='status')return json(req,{ok:true,connected:Boolean(c?.enabled),configured:Boolean(TODOIST_TOKEN),projectId:c?.project_id||null,lastSyncedAt:c?.last_synced_at||null});
  if(body.action==='sync')return json(req,{ok:true,...await syncUser(u.id)});
  return json(req,{error:'Ação desconhecida'},400)
 }catch(e){console.error(e);return json(req,{error:e instanceof Error?e.message:'Falha na sincronização',code:(e as any)?.code||null},500)}
});
