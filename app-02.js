function save(){
 const serialized=JSON.stringify(data),changed=serialized!==lastSavedState;
 storageSet(KEY,serialized);
 if(currentUser)storageSet(userCacheKey(currentUser.id),serialized);
 lastSavedState=serialized;
 if(changed&&!applyingRemote)scheduleCloudSave()
}
const NOTIFICATION_GRACE_MINUTES=3;
function notificationLog(){return safeParse(storageGet(NOTIFICATION_LOG_KEY))||{}}
function wasNotified(key){return Boolean(notificationLog()[key])}
function markNotified(key){let log=notificationLog();log[key]=Date.now();let cutoff=Date.now()-7*864e5;Object.keys(log).forEach(k=>{if(log[k]<cutoff)delete log[k]});storageSet(NOTIFICATION_LOG_KEY,JSON.stringify(log))}
function notificationSupport(){
 if(!("Notification" in window))return {ok:false,state:"unsupported",label:"Não suportado",detail:"Este navegador não oferece notificações do sistema."};
 if(!window.isSecureContext&&location.hostname!=="localhost")return {ok:false,state:"insecure",label:"Conexão não segura",detail:"Abra o Planner por HTTPS para usar notificações."};
 if(Notification.permission==="granted")return {ok:true,state:"granted",label:"Permissão liberada",detail:"Este dispositivo pode exibir lembretes."};
 if(Notification.permission==="denied")return {ok:false,state:"denied",label:"Permissão bloqueada",detail:"Libere as notificações nas configurações do navegador para este site."};
 return {ok:true,state:"default",label:"Permissão pendente",detail:"Clique em ativar para autorizar este dispositivo."};
}
async function requestPlannerNotifications(){
 let support=notificationSupport();
 if(support.state==="unsupported"||support.state==="insecure"){alert(support.detail);return false}
 if(Notification.permission==="denied"){toast("Notificações estão bloqueadas no navegador. Libere a permissão do site e tente novamente.");renderSettings();return false}
 let permission=Notification.permission;
 try{if(permission!=="granted")permission=await Notification.requestPermission()}catch{toast("Não foi possível solicitar a permissão de notificações.");return false}
 if(permission==="granted"){
   data.settings.notifications.enabled=true;save();renderSettings();toast("Notificações ativadas neste dispositivo");return true
 }
 toast("Permissão não concedida. Você pode ativá-la nas configurações do navegador.");renderSettings();return false
}
function playNotificationCue(){let n=notificationSettings();if(!n.sound)return;try{let C=window.AudioContext||window.webkitAudioContext,ctx=new C(),o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.setValueAtTime(.05,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22);o.start();o.stop(ctx.currentTime+.22)}catch{}}
function showPlannerNotification(title,body,key){
 let n=notificationSettings();if(!n.enabled||!("Notification" in window)||Notification.permission!=="granted"||wasNotified(key))return false;
 try{
   let note=new Notification(title,{body,icon:"/favicon.ico",tag:key,renotify:true});
   note.onclick=()=>{try{window.focus()}catch{}note.close()};
   if(n.vibration&&navigator.vibrate)navigator.vibrate([150,80,150]);playNotificationCue();markNotified(key);return true
 }catch{toast("O navegador não conseguiu exibir a notificação.");return false}
}
async function testPlannerNotification(){
 if(!("Notification" in window)||Notification.permission!=="granted"){
   let granted=await requestPlannerNotifications();if(!granted)return
 }
 data.settings.notifications.enabled=true;save();
 let sent=showPlannerNotification("🔔 Teste do Meu Planner Digital","Perfeito. As notificações deste dispositivo estão funcionando.",`planner-test-${Date.now()}`);
 if(sent)toast("Notificação de teste enviada")
}
function timeToMinutes(value){if(!/^\d\d:\d\d$/.test(value||""))return null;let [h,m]=value.split(":").map(Number);return h*60+m}
function notificationDateTime(date,time){
 let minutes=timeToMinutes(time);if(minutes===null)return null;let d=dateObj(date||today());d.setHours(Math.floor(minutes/60),minutes%60,0,0);return d
}
function dueNotificationAt(kind,id,name,when,body="",suffix=""){
 if(!(when instanceof Date)||Number.isNaN(when.getTime()))return false;
 let delta=(Date.now()-when.getTime())/60000;if(delta<0||delta>NOTIFICATION_GRACE_MINUTES)return false;
 let title=name?`${kind}: ${name}`:kind,key=`${iso(when)}-${kind}-${id}${suffix?`-${suffix}`:""}`;
 return showPlannerNotification(title,body||name,key)
}
function dueNotification(kind,id,name,time,leadMinutes=0,body="",date=today()){
 let base=notificationDateTime(date,time);if(!base)return false;let when=new Date(base.getTime()-Math.max(0,Number(leadMinutes)||0)*60000),suffix=leadMinutes?` em ${leadMinutes} min`:" agora";
 return dueNotificationAt(kind,id,name,when,body||`${name}${suffix}.`,`lead-${Math.max(0,Number(leadMinutes)||0)}`)
}
function remindItem(kind,id,name,time,lead,body="",date=today()){
 let n=notificationSettings(),base=notificationDateTime(date,time);if(!base)return;
 let leadValue=Math.max(0,Number(lead)||0);
 if(leadValue>0){let leadWhen=new Date(base.getTime()-leadValue*60000);dueNotificationAt(kind,id,name,leadWhen,body||`${name} em ${leadValue} min.`,`lead-${leadValue}`)}
 dueNotificationAt(kind,id,name,base,body||`${name} agora.`,"due");
 for(let repeat=1;repeat<=Math.max(0,Number(n.repeatCount)||0);repeat++){
   let when=new Date(base.getTime()+repeat*(Number(n.repeatInterval)||10)*60000);
   dueNotificationAt(kind,id,name,when,`${body||name} · lembrete ${repeat}/${n.repeatCount}`,`repeat-${repeat}`)
 }
}
const MOTIVATIONAL_MESSAGES=["Um passo de cada vez.","Comece pequeno e continue.","Hoje já é uma boa oportunidade.","Constância vale mais que perfeição.","Faça o que está ao seu alcance agora."];
function checkPlannerNotifications(){
 if(devicePushSubscribed)return;
 if(!("Notification" in window)||Notification.permission!=="granted")return;
 let n=notificationSettings();if(!n.enabled)return;
 let dates=[today(),addDays(today(),1)];
 if(n.tasks)data.tasks.filter(t=>t.status!=="done"&&dates.includes(t.date)&&t.startTime&&t.reminderEnabled!==false).forEach(t=>{let lead=Number.isFinite(Number(t.reminderLead))?Number(t.reminderLead):Number(n.leadMinutes)||0;remindItem("Tarefa",t.id,t.name,t.startTime,lead,"",t.date)});
 if(n.habits)activeHabits().filter(h=>h.time&&h.reminderEnabled!==false).forEach(h=>{let lead=Number.isFinite(Number(h.reminderLead))?Number(h.reminderLead):Number(n.leadMinutes)||0;dates.forEach(d=>{if(isHabitScheduledForNotification(h,d)&&habitState(h,d)!=="complete")remindItem("Hábito",h.id,h.name,h.time,lead,"",d)})});
 if(n.planning)dueNotification("Planejamento", "daily", "Planeje seu dia", n.planningTime, 0, "Escolha o que realmente importa hoje.");
 if(n.review)dueNotification("Revisão", "daily", "Feche o seu dia", n.reviewTime, 0, "Revise o que avançou e prepare o amanhã.");
 if(n.motivation){let msg=MOTIVATIONAL_MESSAGES[new Date().getDate()%MOTIVATIONAL_MESSAGES.length];dueNotification("Mensagem do dia", "motivation", "", n.motivationTime, 0, msg)}
}
function startNotificationChecks(){clearInterval(notificationTimer);checkPlannerNotifications();notificationTimer=setInterval(checkPlannerNotifications,30000)}
function urlBase64ToUint8Array(value){let padding="=".repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/"),raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
function backgroundPushSupport(){
 if(!window.isSecureContext&&location.hostname!=="localhost")return {ok:false,label:"Requer HTTPS"};
 if(!("serviceWorker" in navigator))return {ok:false,label:"Service Worker não suportado"};
 if(!("PushManager" in window))return {ok:false,label:"Web Push não suportado"};
 if(!("Notification" in window))return {ok:false,label:"Notificações não suportadas"};
 return {ok:true,label:"Compatível"}
}
async function registerPlannerServiceWorker(){
 let support=backgroundPushSupport();if(!support.ok)return null;
 try{return await navigator.serviceWorker.register("/sw.js",{scope:"/"})}catch(error){console.error("Service Worker:",error);pushServerStatus.lastError="Não foi possível registrar o Service Worker.";return null}
}
async function currentPushSubscription(){
 let registration=await registerPlannerServiceWorker();if(!registration)return null;
 try{return await registration.pushManager.getSubscription()}catch{return null}
}
async function pushRequest(action,extra={}){
 const session=await ensureSession();if(!session?.access_token)throw new Error("Entre na sua conta para usar notificações em segundo plano.");
 const response=await fetch(`${SUPABASE_URL}/functions/v1/push-dispatch`,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(Object.assign({action},extra))});
 const text=await response.text();let result={};try{result=text?JSON.parse(text):{}}catch{result={error:text}}
 if(!response.ok)throw new Error(result.error||"Não foi possível acessar o serviço de notificações.");return result
}
async function loadBackgroundPushStatus(){
 let support=backgroundPushSupport();if(!support.ok){devicePushSubscribed=false;pushServerStatus={configured:false,subscriptionCount:0,lastError:support.label};if(page==="settings")renderSettings();return pushServerStatus}
 let subscription=await currentPushSubscription();devicePushSubscribed=Boolean(subscription&&Notification.permission==="granted");
 if(!currentUser||!navigator.onLine){if(page==="settings")renderSettings();return pushServerStatus}
 try{let result=await pushRequest("status");pushServerStatus={configured:Boolean(result.configured),subscriptionCount:Number(result.subscriptionCount)||0,lastError:""}}
 catch(error){pushServerStatus.lastError=error.message||"Servidor indisponível"}
 if(page==="settings")renderSettings();return pushServerStatus
}
function backgroundPushLabel(){
 let support=backgroundPushSupport();if(!support.ok)return {state:"off",title:"Segundo plano indisponível",detail:support.label};
 if(!currentUser)return {state:"off",title:"Segundo plano requer conta",detail:"Entre na conta do Planner para receber alertas com o Planner fechado."};
 if(devicePushSubscribed)return {state:"on",title:"Segundo plano ativo neste dispositivo",detail:"Os lembretes podem chegar mesmo com o Planner fechado."};
 if(pushServerStatus.subscriptionCount>0)return {state:"other",title:`Ativo em ${pushServerStatus.subscriptionCount} dispositivo(s)`,detail:"Este navegador ainda não está inscrito para Web Push."};
 return {state:"off",title:"Segundo plano desativado",detail:pushServerStatus.lastError||"Ative para receber lembretes sem manter o Planner aberto."}
}
