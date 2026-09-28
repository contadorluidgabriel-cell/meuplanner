const LIFE_KEY = "minha_vida_v1_data";
const SESSION_KEY = "planner_v7_supabase_session";
const SUPABASE_URL = "https://witwoqilxjnviqcxjlwl.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ht7BPNKlWhgSAYjd2LKUEQ_zMYqNXVu";
const CLOUD_SCHEMA = 8;
const APP_VERSION = "2.0.0";

let currentPage = "home";
let activePillarId = null;
let currentSession = null;
let currentUser = null;
let cloudTimer = null;

const NAV = [
  ["home", "Visão Geral", "⌂"],
  ["pillars", "Pilares", "◫"],
  ["objectives", "Objetivos e Metas", "◎"],
  ["planning", "Planejamento", "◇"],
  ["reviews", "Revisões", "↻"],
  ["inbox", "Inbox", "+"]
];
const MOBILE_NAV = [
  ["home","Início","⌂"],
  ["pillars","Pilares","◫"],
  ["weekly","Check-in","✓"],
  ["reviews","Revisões","↻"],
  ["inbox","Inbox","+"]
];

function uid(prefix="id"){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`; }
function today(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function nowISO(){ return new Date().toISOString(); }
function esc(v=""){ return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function fmtDate(v){ if(!v)return "—"; const d=new Date(`${v}T12:00:00`); return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).format(d); }
function fmtShort(v){ if(!v)return "—"; const d=new Date(`${v}T12:00:00`); return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short"}).format(d); }
function daysBetween(a,b=today()){ if(!a)return 0; return Math.floor((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,Number(n)||0)); }
function parseJSON(raw,fallback=null){ try{return raw?JSON.parse(raw):fallback}catch{return fallback} }
function num(v,fallback=0){ const n=Number(v); return Number.isFinite(n)?n:fallback; }
function weekStart(date=today()){ const d=new Date(`${date}T12:00:00`); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return d.toISOString().slice(0,10); }
function monthKey(date=today()){ return String(date).slice(0,7); }

function seed(){
  const createdAt=nowISO();
  return {
    schema:2,
    settings:{theme:"dark"},
    pillars:[
      {id:uid("pil"),name:"Saúde",icon:"♥",description:"Condição física, bem-estar e saúde.",archived:false,createdAt},
      {id:uid("pil"),name:"Desenvolvimento / Estudos",icon:"▤",description:"Aprendizado, leitura, estudos e desenvolvimento pessoal.",archived:false,createdAt},
      {id:uid("pil"),name:"Espiritualidade / Fé",icon:"✦",description:"Fé, espiritualidade, práticas e crescimento pessoal.",archived:false,createdAt}
    ],
    objectives:[], goals:[], projects:[], indicators:[], habits:[], actions:[],
    reviews:[], weeklyCheckins:[], timeline:[], inbox:[], plans:{}, updatedAt:createdAt
  };
}

function normalize(d){
  const s=seed(), x=d&&typeof d==="object"?d:{};
  const goals=(Array.isArray(x.goals)?x.goals:[]).map(g=>Object.assign({history:[],qualitativeStatus:g.status==="paused"?"paused":""},g,{history:Array.isArray(g.history)?g.history:[]}));
  const reviews=(Array.isArray(x.reviews)?x.reviews:[]).map(r=>Object.assign({kind:r.pillarId?"pillar":"general",closed:true},r));
  return {
    schema:2,
    settings:Object.assign({},s.settings,x.settings||{}),
    pillars:Array.isArray(x.pillars)?x.pillars:s.pillars,
    objectives:Array.isArray(x.objectives)?x.objectives:[],
    goals,
    projects:Array.isArray(x.projects)?x.projects:[],
    indicators:(Array.isArray(x.indicators)?x.indicators:[]).map(i=>Object.assign({},i,{history:Array.isArray(i.history)?i.history:[]})),
    habits:Array.isArray(x.habits)?x.habits:[],
    actions:Array.isArray(x.actions)?x.actions:[],
    reviews,
    weeklyCheckins:Array.isArray(x.weeklyCheckins)?x.weeklyCheckins:[],
    timeline:Array.isArray(x.timeline)?x.timeline:[],
    inbox:Array.isArray(x.inbox)?x.inbox:[],
    plans:x.plans&&typeof x.plans==="object"?x.plans:{},
    updatedAt:x.updatedAt||nowISO()
  };
}

let data = normalize(parseJSON(localStorage.getItem(LIFE_KEY),null));
function persist({cloud=true}={}){
  data.updatedAt=nowISO();
  localStorage.setItem(LIFE_KEY,JSON.stringify(data));
  if(cloud&&currentUser){ clearTimeout(cloudTimer); cloudTimer=setTimeout(()=>saveLifeToCloud(true),700); setSync("saving","Salvando…"); }
}

function pillar(id){ return data.pillars.find(x=>x.id===id); }
function pillarName(id){ return pillar(id)?.name||"Sem pilar"; }
function activePillars(){ return data.pillars.filter(x=>!x.archived); }
function objective(id){ return data.objectives.find(x=>x.id===id); }
function goal(id){ return data.goals.find(x=>x.id===id); }
function latestReview(pillarId,kind="pillar"){
  return [...data.reviews].filter(r=>kind==="monthly"?r.kind==="monthly":r.kind==="pillar"&&r.pillarId===pillarId).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
}
function latestIndicatorValue(i){ const h=Array.isArray(i.history)?i.history:[]; return h.length?h[h.length-1].value:(i.value??""); }
function trendLabel(v){ return v==="improving"?"Evoluindo":v==="attention"?"Atenção":v==="stable"?"Estável":"Sem revisão"; }
function trendClass(v){ return v==="improving"?"good":v==="attention"?"danger":v==="stable"?"warn":"neutral"; }
function goalStatusLabel(v){ return ({evolving:"Evoluindo",stagnant:"Estagnado",regressing:"Regredindo",paused:"Pausado"})[v]||"Sem status"; }
function goalStatusClass(v){ return ({evolving:"good",stagnant:"warn",regressing:"danger",paused:"neutral"})[v]||"neutral"; }
function goalCurrent(g){ const h=Array.isArray(g.history)?g.history:[]; return h.length?num(h[h.length-1].value,num(g.currentValue)):num(g.currentValue); }
function projectProgress(p){ return clamp(p.progress||0,0,100); }
function planKey(type,date=today()){
  const d=new Date(`${date}T12:00:00`), y=d.getFullYear(), m=d.getMonth()+1;
  if(type==="year")return `year:${y}`;
  if(type==="quarter")return `quarter:${y}-Q${Math.floor((m-1)/3)+1}`;
  if(type==="month")return `month:${y}-${String(m).padStart(2,"0")}`;
  return `week:${weekStart(date)}`;
}
function periodLabel(type,date=today()){
  const d=new Date(`${date}T12:00:00`), y=d.getFullYear(), m=d.getMonth()+1;
  if(type==="year")return String(y);
  if(type==="quarter")return `${Math.floor((m-1)/3)+1}º trimestre de ${y}`;
  if(type==="month")return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(d);
  const k=weekStart(date), e=new Date(`${k}T12:00:00`); e.setDate(e.getDate()+6);
  return `${fmtShort(k)} — ${fmtShort(e.toISOString().slice(0,10))}`;
}

function applyTheme(){
  const theme=data.settings.theme||"dark";
  const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme=dark?"dark":"light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",dark?"#0f1217":"#f6f7f9");
}
function setSync(kind,label){ const dot=document.getElementById("syncDot"),txt=document.getElementById("syncText");if(dot)dot.className=`sync-dot ${kind||""}`;if(txt)txt.textContent=label; }
function toast(msg){ const el=document.getElementById("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),2200); }
function openModal(title,html){ document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=html;document.getElementById("modal").classList.add("open"); }
function closeModal(){ document.getElementById("modal").classList.remove("open");document.getElementById("modalBody").innerHTML=""; }
function confirmAction(message){ return confirm(message); }

function renderNav(){
  document.getElementById("nav").innerHTML=NAV.map(([id,label,icon])=>`<button class="nav-item ${currentPage===id?"active":""}" onclick="showPage('${id}')"><span>${icon}</span><b>${label}</b>${id==="inbox"&&data.inbox.length?`<em>${data.inbox.length}</em>`:""}</button>`).join("");
  const mobile=document.getElementById("mobileNav");
  if(mobile)mobile.innerHTML=MOBILE_NAV.map(([id,label,icon])=>`<button class="mobile-nav-item ${currentPage===id?"active":""} ${id==="weekly"?"checkin":""}" onclick="showPage('${id}')"><span>${icon}</span><small>${label}</small></button>`).join("");
}
function setHeader(title,subtitle="",actions=""){ document.getElementById("pageTitle").textContent=title;document.getElementById("pageSub").textContent=subtitle;document.getElementById("topActions").innerHTML=actions; }
function showPage(page,id=null){
  currentPage=page;if(id)activePillarId=id;else if(page!=="pillars")activePillarId=null;
  const content=document.getElementById("content");content?.classList.remove("page-fade");void content?.offsetWidth;content?.classList.add("page-fade");
  render();document.body.classList.remove("menu-open");window.scrollTo({top:0,behavior:"smooth"});
}
function render(){
  applyTheme();renderNav();updateAccountUI();
  if(currentPage==="home")renderHome();
  else if(currentPage==="pillars")activePillarId?renderPillar(activePillarId):renderPillars();
  else if(currentPage==="planning")renderPlanning();
  else if(currentPage==="objectives")renderObjectives();
  else if(currentPage==="projects")renderProjects();
  else if(currentPage==="reviews")renderReviews();
  else if(currentPage==="weekly")renderWeeklyCheckin();
  else if(currentPage==="inbox")renderInbox();
  else if(currentPage==="timeline")renderTimeline();
  else if(currentPage==="export")renderExport();
  else renderHome();
}
