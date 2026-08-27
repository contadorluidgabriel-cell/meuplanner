
const KEY="planner_v6_data";
const PREVKEY="planner_v5_data";
const V4KEY="planner_v4_data";
const SYNC_META_KEY="planner_v7_sync_meta";
const SESSION_KEY="planner_v7_supabase_session";
const NOTIFICATION_LOG_KEY="meu_planner_digital_notification_log";
const VAPID_PUBLIC_KEY="BL7G4d9sDl3kyClfo6mZi-YP_RYMVIpq0-n7kgsHzgECa0VxP5Fsz3HtLl-gDK75RQZz3VF7iL88q3y1BvHdgG0";
const PUSH_HORIZON_DAYS=30;
const SCHEMA=6;
const CLOUD_SCHEMA=7;
const SUPABASE_URL="https://witwoqilxjnviqcxjlwl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_Ht7BPNKlWhgSAYjd2LKUEQ_zMYqNXVu";
const PRODUCTION_URL="https://meuplannerdigital.vercel.app/";
const memoryStorage={};
function storageGet(k){try{return localStorage.getItem(k)}catch(e){return memoryStorage[k]??null}}
function storageSet(k,v){try{localStorage.setItem(k,v)}catch(e){memoryStorage[k]=v}}
function storageRemove(k){try{localStorage.removeItem(k)}catch(e){delete memoryStorage[k]}}
const HAD_LOCAL_STATE=Boolean(storageGet(KEY)||storageGet(PREVKEY)||storageGet(V4KEY));
const DEFAULT_CATEGORIES=["Pessoal","Trabalho","Estudos","Saúde","Casa","Financeiro"];
const NAV=[
 ["today","☀️ Hoje"],["tasks","📋 Tarefas"],["habits","🔄 Hábitos"],["week","📅 Semana"],
 ["progress","📈 Progresso"],["inbox","⚡ Inbox"],["settings","⚙ Ajustes"]
];
let page="today";
let data=load();
let lastSavedState=JSON.stringify(data);
let currentUser=null,currentSession=null,syncTimer=null,cloudPollTimer=null,calendarSyncTimer=null,notificationTimer=null,pushSyncTimer=null,applyingRemote=false,calendarSyncing=false;
let devicePushSubscribed=false,pushServerStatus={configured:false,subscriptionCount:0,lastError:""};
let googleCalendarStatus={configured:false,connected:false,email:null,calendarName:"Meu Planner Digital",lastSyncedAt:null};
let taskSearch="",taskStatusFilter="all",taskPriorityFilter="all",taskProjectFilter="all",taskCategoryFilter="all";

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function iso(d=new Date()){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function today(){return iso(new Date())}
function dateObj(s){return new Date(s+"T12:00:00")}
function addDays(s,n){let d=dateObj(s);d.setDate(d.getDate()+n);return iso(d)}
function monday(s=today()){let d=dateObj(s),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return iso(d)}
function weekKey(s=today()){return monday(s)}
function fmt(s,opt={day:"2-digit",month:"2-digit"}){return new Intl.DateTimeFormat("pt-BR",opt).format(dateObj(s))}
function mins(n){n=Number(n)||0;return n<60?`${n} min`:`${Math.floor(n/60)}h${n%60?` ${n%60}min`:""}`}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function normalizeCategories(value){
 let list=Array.isArray(value)?value:DEFAULT_CATEGORIES;
 list=list.map(x=>String(x||"").trim()).filter(Boolean);
 return [...new Set(list.map(x=>x.slice(0,40)))].slice(0,30).length?[...new Set(list.map(x=>x.slice(0,40)))]:[...DEFAULT_CATEGORIES]
}
function categories(){return normalizeCategories(data?.settings?.categories)}
function categoryOptions(selected="Pessoal"){
 const all=categories();if(selected&&!all.includes(selected))all.push(selected);
 return all.map(c=>`<option value="${esc(c)}" ${c===selected?"selected":""}>${esc(c)}</option>`).join("")
}
function defaultNotifications(){return {enabled:false,tasks:true,habits:true,planning:false,review:false,motivation:true,sound:true,vibration:true,leadMinutes:10,repeatCount:3,repeatInterval:10,planningTime:"07:00",reviewTime:"21:00",motivationTime:"07:00"}}
function notificationSettings(){return Object.assign(defaultNotifications(),data?.settings?.notifications||{})}
function seed(){return {
 schema:SCHEMA,settings:{dailyCapacity:360,theme:"system",accent:"blue",density:"comfortable",categories:[...DEFAULT_CATEGORIES],notifications:defaultNotifications()},
 tasks:[],habits:[],habitLogs:{},dailyPlans:{},weeklyPlans:{},inbox:[],history:[]
}}
function normalize(d){
 let x=seed();Object.assign(x,d);x.schema=SCHEMA;x.settings=Object.assign({dailyCapacity:360,theme:"system",accent:"blue",density:"comfortable",categories:[...DEFAULT_CATEGORIES],notifications:defaultNotifications()},d.settings||{});x.settings.categories=normalizeCategories(x.settings.categories);x.settings.notifications=Object.assign(defaultNotifications(),x.settings.notifications||{});
 x.tasks=d.tasks||[];x.habits=(d.habits||[]).map((h,i)=>normalizeHabit(h,i));x.habitLogs=d.habitLogs||{};
 x.dailyPlans=d.dailyPlans||{};x.weeklyPlans=d.weeklyPlans||{};x.inbox=d.inbox||[];x.history=d.history||[];
 return x
}
const ACCENT_COLORS={
 blue:{main:"#2563eb",soft:"#eef4ff"},violet:{main:"#7c3aed",soft:"#f3efff"},green:{main:"#15803d",soft:"#ecfdf3"},rose:{main:"#e11d48",soft:"#fff1f4"},orange:{main:"#ea580c",soft:"#fff4ed"}
};
function applyPreferences(){
 const settings=data.settings||{},systemDark=window.matchMedia?.("(prefers-color-scheme: dark)").matches;
 const theme=settings.theme==="system"?(systemDark?"dark":"light"):(settings.theme||"light");
 const accent=ACCENT_COLORS[settings.accent]||ACCENT_COLORS.blue,root=document.documentElement;
 root.dataset.theme=theme;root.style.setProperty("--blue",accent.main);root.style.setProperty("--blue-soft",theme==="dark"?`color-mix(in srgb, ${accent.main} 18%, transparent)`:accent.soft);
 document.body.classList.toggle("compact",settings.density==="compact");
 const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.content=theme==="dark"?"#0f1115":accent.main
}
function normalizeHabit(h,i=0){
 let target=Math.max(1,Number(h.target)||1);
 let base=Object.assign({
   id:h.id||uid(),name:h.name||"Hábito",type:"quantity",target,minTarget:Math.max(1,Math.round(target*.5)),checklistItems:[],
   unit:h.unit||"vez",freqType:"daily",specificDays:[1,2,3,4,5,6,7],weeklyGoal:Number(h.weeklyGoal)||5,
   category:"Pessoal",period:"any",time:"",routine:"",trigger:"",reason:"",favorite:false,order:i,
   paused:false,pauseUntil:"",archived:false,configHistory:[],pauseHistory:[]
 },h,{target,minTarget:Math.min(target,Math.max(1,Number(h.minTarget)||Math.round(target*.5))),order:Number.isFinite(Number(h.order))?Number(h.order):i});
 if(!Array.isArray(base.configHistory))base.configHistory=[];
 if(!Array.isArray(base.pauseHistory))base.pauseHistory=[];
 if(!base.configHistory.length){
   base.configHistory=[{from:base.createdAt||today(),type:base.type,target:base.target,minTarget:base.minTarget,unit:base.unit,freqType:base.freqType,specificDays:[...(base.specificDays||[])],weeklyGoal:base.weeklyGoal}]
 }
 return base
}
function migrateV4(o){
 let d=seed();
 d.settings.dailyCapacity=o.settings?.dailyCapacity||360;
 d.tasks=(o.tasks||[]).map(t=>({id:t.id||uid(),name:t.name||"",date:t.date||today(),estimate:Number(t.estimate)||30,actual:Number(t.real)||0,priority:t.priority==="med"?"normal":t.priority||"normal",status:t.status||"todo",project:t.project||"Geral",reschedules:0,completedAt:t.status==="done"?today():null,createdAt:today()}));
 d.habits=(o.habits||[]).map(h=>({id:h.id||uid(),name:h.name||"",target:Number(h.target)||1,unit:h.unit||"vez",weeklyGoal:h.goal&&String(h.goal).match(/\d+/)?Number(String(h.goal).match(/\d+/)[0]):7}));
 return d
}

function safeParse(raw){
 try{return raw?JSON.parse(raw):null}catch{return null}
}
function makeMigrationBackup(raw,key){
 try{
   if(!raw)return;
   const stamp=new Date().toISOString().replace(/[:.]/g,"-");
   localStorage.setItem(`${key}_migration_backup_${stamp}`,raw)
 }catch{}
}
function ensureArray(v){return Array.isArray(v)?v:[]}
function ensureObject(v){return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}
function repairDataShape(d){
 if(!d||typeof d!=="object")return seed();
 d.tasks=ensureArray(d.tasks);
 d.habits=ensureArray(d.habits);
 d.habitLogs=ensureObject(d.habitLogs);
 d.dailyPlans=ensureObject(d.dailyPlans);
 d.weeklyPlans=ensureObject(d.weeklyPlans);
 d.inbox=ensureArray(d.inbox);
 d.history=ensureArray(d.history);
 d.settings=Object.assign({dailyCapacity:360,theme:"system",accent:"blue",density:"comfortable",categories:[...DEFAULT_CATEGORIES],notifications:defaultNotifications()},ensureObject(d.settings));d.settings.categories=normalizeCategories(d.settings.categories);d.settings.notifications=Object.assign(defaultNotifications(),d.settings.notifications||{});
  d.tasks=d.tasks.map(t=>Object.assign({
    id:uid(),name:"Tarefa",date:today(),startTime:"",estimate:30,actual:0,priority:"normal",
    status:"todo",project:"Geral",category:"Pessoal",nextAction:"",notes:"",taskType:"single",recurrence:"none",recurrenceDays:[],reschedules:0,createdAt:today(),updatedAt:new Date().toISOString(),calendarSync:true
  },t||{}));
 d.habits=d.habits.map((h,i)=>normalizeHabit(h||{},i));
 return d
}
function integritySummary(){
 const issues=[];
 if(!Array.isArray(data.tasks))issues.push("tasks");
 if(!Array.isArray(data.habits))issues.push("habits");
 if(!data.habitLogs||typeof data.habitLogs!=="object")issues.push("habitLogs");
 if(!data.dailyPlans||typeof data.dailyPlans!=="object")issues.push("dailyPlans");
 return issues
}

function load(){
 try{let d=JSON.parse(storageGet(KEY)||"null");if(d)return normalize(d)}catch{}
 try{let prev=JSON.parse(storageGet(PREVKEY)||"null");if(prev){let d=normalize(prev);storageSet(KEY,JSON.stringify(d));return d}}catch{}
 try{let v4=JSON.parse(storageGet(V4KEY)||"null");if(v4){let d=migrateV4(v4);storageSet(KEY,JSON.stringify(d));return d}}catch{}
 return seed()
}
function readSyncMeta(){return safeParse(storageGet(SYNC_META_KEY))||{imported:{},pending:{},everAuthenticated:false}}
function writeSyncMeta(meta){storageSet(SYNC_META_KEY,JSON.stringify(meta))}
function userCacheKey(userId){return `planner_v7_user_${userId}`}
function stateFingerprint(value=data){return JSON.stringify(value)}
function formatSyncTime(value){
 if(!value)return "";const date=new Date(value);if(Number.isNaN(date.getTime()))return "";
 return date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})
}
function syncedLabel(prefix="Sincronizado"){const time=formatSyncTime(readSyncMeta().lastSyncedAt);return time?`${prefix} às ${time}`:prefix}
function setSyncStatus(kind,label){
 const dot=document.getElementById("syncDot"),text=document.getElementById("syncLabel");
 if(dot)dot.className=`sync-dot ${kind||""}`;
 if(text)text.textContent=label
}
function updateAccountUI(){
 const email=document.getElementById("accountEmail"),button=document.getElementById("accountButton");
 if(email)email.textContent=currentUser?.email||"Modo visitante";
 if(button){button.textContent=currentUser?"✓ Conta conectada":"☁ Entrar para sincronizar"}
 if(!currentUser)setSyncStatus("",navigator.onLine?"Somente neste dispositivo":"Offline · salvo neste dispositivo");
 else if(navigator.onLine&&!readSyncMeta().pending[currentUser.id])setSyncStatus("online",syncedLabel())
}
