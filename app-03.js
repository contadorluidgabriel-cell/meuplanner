async function enableBackgroundPush(){
 if(!currentUser){toast("Entre na sua conta primeiro");openAccount();return false}
 let support=backgroundPushSupport();if(!support.ok){alert(support.label);return false}
 if(Notification.permission!=="granted"){let granted=await requestPlannerNotifications();if(!granted)return false}
 let registration=await registerPlannerServiceWorker();if(!registration){toast("Não foi possível preparar as notificações em segundo plano");return false}
 try{
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
   await pushRequest("register",{subscription:subscription.toJSON(),userAgent:navigator.userAgent});
   devicePushSubscribed=true;await loadBackgroundPushStatus();await syncBackgroundNotificationJobs({force:true});startNotificationChecks();renderSettings();toast("Notificações em segundo plano ativadas");return true
 }catch(error){console.error(error);devicePushSubscribed=false;pushServerStatus.lastError=error.message||"Falha ao ativar Web Push";renderSettings();alert("Não foi possível ativar as notificações em segundo plano: "+pushServerStatus.lastError);return false}
}
async function disableBackgroundPush({silent=false}={}){
 let subscription=await currentPushSubscription(),endpoint=subscription?.endpoint||"";
 try{if(subscription)await subscription.unsubscribe()}catch{}
 devicePushSubscribed=false;
 if(currentUser&&navigator.onLine&&endpoint){try{await pushRequest("unregister",{endpoint})}catch(error){console.error(error)}}
 await loadBackgroundPushStatus();startNotificationChecks();if(page==="settings")renderSettings();if(!silent)toast("Notificações em segundo plano desativadas")
}
async function testBackgroundNotification(){
 if(!devicePushSubscribed){let ok=await enableBackgroundPush();if(!ok)return}
 try{let result=await pushRequest("test");toast(result.sent?`Teste enviado para ${result.sent} dispositivo(s)`:"O servidor não conseguiu enviar o teste")}
 catch(error){alert("Falha no teste em segundo plano: "+error.message)}
}
function isHabitScheduledForNotification(h,d=today()){
 if(h.archived||habitPausedOn(h,d))return false;
 let cfg=configForDate(h,d),wd=weekDayNum(d);
 if(cfg.freqType==="daily")return true;
 if(cfg.freqType==="weekdays")return wd<=5;
 if(cfg.freqType==="specific")return (cfg.specificDays||[]).map(Number).includes(wd);
 if(cfg.freqType==="weekly")return true;
 return true
}
function pushJobKey(kind,id,date,phase,when){return `${kind}:${id}:${date}:${phase}:${when.toISOString().slice(0,16)}`.slice(0,240)}
function addBackgroundJob(map,{kind,id,name,date,time,phase,offsetMinutes=0,body}){
 let base=notificationDateTime(date,time);if(!base)return;let when=new Date(base.getTime()+offsetMinutes*60000),now=Date.now();if(when.getTime()<now-NOTIFICATION_GRACE_MINUTES*60000)return;
 let title=name?`${kind}: ${name}`:kind,key=pushJobKey(kind,id,date,phase,when);map.set(key,{jobKey:key,kind,title,body:body||name||kind,scheduledFor:when.toISOString()})
}
function buildBackgroundNotificationJobs(){
 let n=notificationSettings(),map=new Map();if(!n.enabled)return [];
 let dates=[];for(let i=0;i<=PUSH_HORIZON_DAYS;i++)dates.push(addDays(today(),i));let maxDate=dates[dates.length-1];
 if(n.tasks)data.tasks.filter(t=>t.status!=="done"&&t.date>=today()&&t.date<=maxDate&&t.startTime&&t.reminderEnabled!==false).forEach(t=>{
   let lead=Number.isFinite(Number(t.reminderLead))?Number(t.reminderLead):Number(n.leadMinutes)||0;if(lead>0)addBackgroundJob(map,{kind:"Tarefa",id:t.id,name:t.name,date:t.date,time:t.startTime,phase:`lead-${lead}`,offsetMinutes:-lead,body:`${t.name} em ${lead} min.`});
   addBackgroundJob(map,{kind:"Tarefa",id:t.id,name:t.name,date:t.date,time:t.startTime,phase:"due",body:`${t.name} agora.`});
   for(let repeat=1;repeat<=Math.max(0,Number(n.repeatCount)||0);repeat++)addBackgroundJob(map,{kind:"Tarefa",id:t.id,name:t.name,date:t.date,time:t.startTime,phase:`repeat-${repeat}`,offsetMinutes:repeat*(Number(n.repeatInterval)||10),body:`${t.name} · lembrete ${repeat}/${n.repeatCount}`})
 });
 if(n.habits)activeHabits().filter(h=>h.time&&h.reminderEnabled!==false).forEach(h=>dates.forEach(d=>{
   if(!isHabitScheduledForNotification(h,d)||habitState(h,d)==="complete")return;let lead=Number.isFinite(Number(h.reminderLead))?Number(h.reminderLead):Number(n.leadMinutes)||0;
   if(lead>0)addBackgroundJob(map,{kind:"Hábito",id:h.id,name:h.name,date:d,time:h.time,phase:`lead-${lead}`,offsetMinutes:-lead,body:`${h.name} em ${lead} min.`});
   addBackgroundJob(map,{kind:"Hábito",id:h.id,name:h.name,date:d,time:h.time,phase:"due",body:`${h.name} agora.`});
   for(let repeat=1;repeat<=Math.max(0,Number(n.repeatCount)||0);repeat++)addBackgroundJob(map,{kind:"Hábito",id:h.id,name:h.name,date:d,time:h.time,phase:`repeat-${repeat}`,offsetMinutes:repeat*(Number(n.repeatInterval)||10),body:`${h.name} · lembrete ${repeat}/${n.repeatCount}`})
 }));
 dates.forEach(d=>{
   if(n.planning)addBackgroundJob(map,{kind:"Planejamento",id:"daily",name:"Planeje seu dia",date:d,time:n.planningTime,phase:"due",body:"Escolha o que realmente importa hoje."});
   if(n.review)addBackgroundJob(map,{kind:"Revisão",id:"daily",name:"Feche o seu dia",date:d,time:n.reviewTime,phase:"due",body:"Revise o que avançou e prepare o amanhã."});
   if(n.motivation){let msg=MOTIVATIONAL_MESSAGES[dateObj(d).getDate()%MOTIVATIONAL_MESSAGES.length];addBackgroundJob(map,{kind:"Mensagem do dia",id:"motivation",name:"",date:d,time:n.motivationTime,phase:"due",body:msg})}
 });
 return [...map.values()].slice(0,3000)
}
async function syncBackgroundNotificationJobs({force=false}={}){
 if(!currentUser||!navigator.onLine)return false;
 if(!force&&pushServerStatus.subscriptionCount<=0&&!devicePushSubscribed)return false;
 try{let jobs=buildBackgroundNotificationJobs(),result=await pushRequest("sync-jobs",{jobs});return Boolean(result.ok)}catch(error){console.error("Push jobs:",error);pushServerStatus.lastError=error.message||"Falha ao sincronizar lembretes";return false}
}
function scheduleBackgroundPushSync(){clearTimeout(pushSyncTimer);if(!currentUser||!navigator.onLine)return;pushSyncTimer=setTimeout(()=>syncBackgroundNotificationJobs(),1300)}
async function initBackgroundPush(){
 await registerPlannerServiceWorker();
 let subscription=await currentPushSubscription();devicePushSubscribed=Boolean(subscription&&Notification.permission==="granted");
 if(currentUser&&subscription&&navigator.onLine){try{await pushRequest("register",{subscription:subscription.toJSON(),userAgent:navigator.userAgent})}catch(error){console.error(error)}}
 await loadBackgroundPushStatus();if(pushServerStatus.subscriptionCount>0)await syncBackgroundNotificationJobs({force:true});startNotificationChecks()
}
function scheduleCloudSave(){
 if(!currentUser)return;
 const meta=readSyncMeta();meta.pending[currentUser.id]=true;writeSyncMeta(meta);
 clearTimeout(syncTimer);
 if(!navigator.onLine){setSyncStatus("busy","Offline · alterações na fila");return}
 setSyncStatus("busy","Salvando…");
 syncTimer=setTimeout(()=>syncToCloud(),700)
}
function readSession(){return safeParse(storageGet(SESSION_KEY))}
let pendingPasswordRecovery=false;
function consumeAuthRedirect(){
 const params=new URLSearchParams(location.hash.replace(/^#/,""));
 const access_token=params.get("access_token"),refresh_token=params.get("refresh_token");
 if(!access_token||!refresh_token)return null;
 try{
   const encoded=access_token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
   const claims=JSON.parse(decodeURIComponent(escape(atob(encoded))));
   pendingPasswordRecovery=params.get("type")==="recovery";
   const session={access_token,refresh_token,token_type:params.get("token_type")||"bearer",expires_in:Number(params.get("expires_in"))||3600,expires_at:claims.exp||Math.floor(Date.now()/1000)+3600,user:{id:claims.sub,email:claims.email}};
   history.replaceState({},document.title,location.pathname+location.search);storeSession(session);return session
 }catch{return null}
}
function storeSession(session){
 currentSession=session||null;currentUser=session?.user||null;
 if(session)storageSet(SESSION_KEY,JSON.stringify(session));else storageRemove(SESSION_KEY)
}
async function cloudRequest(path,{method="GET",body,auth=true,headers={}}={}){
 const requestHeaders=Object.assign({apikey:SUPABASE_PUBLISHABLE_KEY},headers);
 if(body!==undefined)requestHeaders["Content-Type"]="application/json";
 if(auth){
   const session=await ensureSession();
   if(!session?.access_token)throw new Error("Sessão expirada. Entre novamente.");
   requestHeaders.Authorization=`Bearer ${session.access_token}`
 }
 const response=await fetch(`${SUPABASE_URL}${path}`,{method,headers:requestHeaders,body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();let payload=null;try{payload=text?JSON.parse(text):null}catch{payload=text}
 if(!response.ok)throw new Error(payload?.msg||payload?.message||payload?.error_description||payload?.error||`Erro ${response.status}`);
 return payload
}
async function ensureSession(){
 let session=currentSession||readSession();if(!session)return null;
 if(session.expires_at&&session.expires_at>Date.now()/1000+60){storeSession(session);return session}
 if(!session.refresh_token){storeSession(null);return null}
 try{
   const refreshed=await cloudRequest("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:session.refresh_token},auth:false});
   refreshed.expires_at=refreshed.expires_at||Math.floor(Date.now()/1000)+(refreshed.expires_in||3600);storeSession(refreshed);return refreshed
 }catch{storeSession(null);return null}
}
async function cloudUpsertState(snapshot){
 return cloudRequest("/rest/v1/planner_state?on_conflict=user_id",{method:"POST",body:{user_id:currentUser.id,schema_version:CLOUD_SCHEMA,state:snapshot,updated_at:new Date().toISOString()},headers:{Prefer:"resolution=merge-duplicates,return=minimal"}})
}
async function cloudReadState(){
 const rows=await cloudRequest(`/rest/v1/planner_state?user_id=eq.${encodeURIComponent(currentUser.id)}&select=state,updated_at`,{headers:{Accept:"application/json"}});
 return Array.isArray(rows)?rows[0]||null:null
}
