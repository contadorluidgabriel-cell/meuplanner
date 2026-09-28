const LIFE_KEY = "minha_vida_v1_data";
const SESSION_KEY = "planner_v7_supabase_session";
const SUPABASE_URL = "https://witwoqilxjnviqcxjlwl.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ht7BPNKlWhgSAYjd2LKUEQ_zMYqNXVu";
const CLOUD_SCHEMA = 8;
const APP_VERSION = "1.0.0";

let currentPage = "home";
let activePillarId = null;
let currentSession = null;
let currentUser = null;
let cloudTimer = null;
let modalResolver = null;

const NAV = [
  ["home", "Visão geral", "⌂"],
  ["pillars", "Pilares", "◫"],
  ["planning", "Planejamento", "◇"],
  ["objectives", "Objetivos e metas", "◎"],
  ["projects", "Projetos", "▣"],
  ["reviews", "Revisões", "↻"],
  ["timeline", "Linha do tempo", "⌁"],
  ["inbox", "Inbox", "+"],
  ["export", "Resumo TXT", "↗"]
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

function seed(){
  const createdAt=nowISO();
  return {
    schema:1,
    settings:{theme:"system"},
    pillars:[
      {id:uid("pil"),name:"Saúde",icon:"♥",description:"Condição física, bem-estar e saúde.",archived:false,createdAt},
      {id:uid("pil"),name:"Desenvolvimento / Estudos",icon:"▤",description:"Aprendizado, leitura, estudos e desenvolvimento pessoal.",archived:false,createdAt},
      {id:uid("pil"),name:"Espiritualidade / Fé",icon:"✦",description:"Fé, espiritualidade, práticas e crescimento pessoal.",archived:false,createdAt}
    ],
    objectives:[], goals:[], projects:[], indicators:[], habits:[], actions:[], reviews:[], timeline:[], inbox:[], plans:{}, updatedAt:createdAt
  };
}

function normalize(d){
  const s=seed(), x=d&&typeof d==="object"?d:{};
  return {
    schema:1,
    settings:Object.assign({},s.settings,x.settings||{}),
    pillars:Array.isArray(x.pillars)?x.pillars:s.pillars,
    objectives:Array.isArray(x.objectives)?x.objectives:[],
    goals:Array.isArray(x.goals)?x.goals:[],
    projects:Array.isArray(x.projects)?x.projects:[],
    indicators:Array.isArray(x.indicators)?x.indicators:[],
    habits:Array.isArray(x.habits)?x.habits:[],
    actions:Array.isArray(x.actions)?x.actions:[],
    reviews:Array.isArray(x.reviews)?x.reviews:[],
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
function latestReview(pillarId){ return [...data.reviews].filter(r=>(r.pillarId||null)===(pillarId||null)).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]; }
function latestIndicatorValue(i){ const h=Array.isArray(i.history)?i.history:[]; return h.length?h[h.length-1].value:(i.value??""); }
function trendLabel(v){ return v==="improving"?"Melhorando":v==="attention"?"Atenção":v==="stable"?"Estável":"Sem revisão"; }
function trendClass(v){ return v==="improving"?"good":v==="attention"?"warn":"neutral"; }
function goalProgress(g){
  const start=Number(g.startValue)||0, cur=Number(g.currentValue)||0, target=Number(g.targetValue)||0;
  if(target===start)return cur===target?100:0;
  return clamp(((cur-start)/(target-start))*100,0,100);
}
function projectProgress(p){ return clamp(p.progress||0,0,100); }
function planKey(type,date=today()){
  const d=new Date(`${date}T12:00:00`), y=d.getFullYear(), m=d.getMonth()+1;
  if(type==="year")return `year:${y}`;
  if(type==="quarter")return `quarter:${y}-Q${Math.floor((m-1)/3)+1}`;
  if(type==="month")return `month:${y}-${String(m).padStart(2,"0")}`;
  const t=new Date(d); const day=t.getDay()||7; t.setDate(t.getDate()-day+1); const iso=t.toISOString().slice(0,10); return `week:${iso}`;
}
function periodLabel(type,date=today()){
  const d=new Date(`${date}T12:00:00`), y=d.getFullYear(), m=d.getMonth()+1;
  if(type==="year")return String(y);
  if(type==="quarter")return `${Math.floor((m-1)/3)+1}º trimestre de ${y}`;
  if(type==="month")return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(d);
  const k=planKey("week",date).split(":")[1]; const e=new Date(`${k}T12:00:00`); e.setDate(e.getDate()+6); return `${fmtShort(k)} — ${fmtShort(e.toISOString().slice(0,10))}`;
}

function applyTheme(){
  const theme=data.settings.theme||"system";
  const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme=dark?"dark":"light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",dark?"#111827":"#f6f7f9");
}

function setSync(kind,label){
  const dot=document.getElementById("syncDot"), txt=document.getElementById("syncText");
  if(dot)dot.className=`sync-dot ${kind||""}`;
  if(txt)txt.textContent=label;
}
function toast(msg){ const el=document.getElementById("toast"); if(!el)return; el.textContent=msg; el.classList.add("show"); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),2200); }
function openModal(title,html){ document.getElementById("modalTitle").textContent=title; document.getElementById("modalBody").innerHTML=html; document.getElementById("modal").classList.add("open"); }
function closeModal(){ document.getElementById("modal").classList.remove("open"); document.getElementById("modalBody").innerHTML=""; }
function confirmAction(message){ return confirm(message); }

function renderNav(){
  const nav=document.getElementById("nav");
  nav.innerHTML=NAV.map(([id,label,icon])=>`<button class="nav-item ${currentPage===id?"active":""}" onclick="showPage('${id}')"><span>${icon}</span><b>${label}</b>${id==="inbox"&&data.inbox.length?`<em>${data.inbox.length}</em>`:""}</button>`).join("");
}
function setHeader(title,subtitle="",actions=""){
  document.getElementById("pageTitle").textContent=title;
  document.getElementById("pageSub").textContent=subtitle;
  document.getElementById("topActions").innerHTML=actions;
}
function showPage(page,id=null){
  currentPage=page; if(id)activePillarId=id; render();
  if(innerWidth<900)document.body.classList.remove("menu-open");
  window.scrollTo({top:0,behavior:"smooth"});
}
function render(){
  applyTheme(); renderNav(); updateAccountUI();
  if(currentPage==="home")renderHome();
  else if(currentPage==="pillars")activePillarId?renderPillar(activePillarId):renderPillars();
  else if(currentPage==="planning")renderPlanning();
  else if(currentPage==="objectives")renderObjectives();
  else if(currentPage==="projects")renderProjects();
  else if(currentPage==="reviews")renderReviews();
  else if(currentPage==="timeline")renderTimeline();
  else if(currentPage==="inbox")renderInbox();
  else if(currentPage==="export")renderExport();
}
