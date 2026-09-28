
function currentMonthStart(){ return today().slice(0,7)+"-01"; }
function homeSummary(){
  const month=currentMonthStart();
  const recentReviews=data.reviews.filter(r=>r.date>=month);
  const improving=recentReviews.filter(r=>r.trend==="improving").length;
  const attention=recentReviews.filter(r=>r.trend==="attention").length;
  const activeGoals=data.goals.filter(g=>g.status!=="done");
  const advanced=activeGoals.filter(g=>goalProgress(g)>0).length;
  const staleProjects=data.projects.filter(p=>p.status==="active"&&daysBetween((p.updatedAt||p.createdAt||"").slice(0,10))>21);
  const events=data.timeline.filter(e=>e.date>=month).length;
  return {improving,attention,advanced,activeGoals:activeGoals.length,staleProjects,events};
}
function renderHome(){
  const s=homeSummary(), monthPlan=data.plans[planKey("month")]||{}, weekPlan=data.plans[planKey("week")]||{};
  const pillarCards=activePillars().map(p=>{ const r=latestReview(p.id); const inds=data.indicators.filter(i=>i.pillarId===p.id); const goals=data.goals.filter(g=>g.pillarId===p.id&&g.status!=="done"); return `<button class="pillar-card" onclick="showPage('pillars','${p.id}')"><div class="pillar-head"><span class="pillar-icon">${esc(p.icon||"•")}</span><div><b>${esc(p.name)}</b><small>${trendLabel(r?.trend)}</small></div><span class="status-dot ${trendClass(r?.trend)}"></span></div><div class="pillar-stats"><span><b>${goals.length}</b> metas ativas</span><span><b>${inds.length}</b> indicadores</span></div>${r?.adjust?`<p>${esc(r.adjust).slice(0,120)}</p>`:`<p class="muted">Faça uma revisão para começar a acompanhar este pilar.</p>`}</button>`; }).join("");
  const stalled=s.staleProjects.slice(0,3);
  setHeader("Minha Vida",new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long"}).format(new Date()),`<button class="btn" onclick="openQuickCapture()">＋ Capturar</button><button class="btn primary" onclick="openReviewForm()">Fazer revisão</button>`);
  document.getElementById("content").innerHTML=`
    <section class="hero-card"><div><span class="eyebrow">RESUMO DO PERÍODO</span><h2>${s.attention?"Há pontos que merecem atenção.":s.improving?"Há sinais de avanço no período.":"Construa o retrato deste período."}</h2><p>${s.improving} pilar(es) melhorando · ${s.attention} em atenção · ${s.advanced}/${s.activeGoals} metas com progresso · ${s.events} acontecimento(s) neste mês.</p></div><div class="hero-actions"><button class="btn primary" onclick="showPage('reviews')">Ver revisões</button><button class="btn" onclick="showPage('export')">Gerar resumo TXT</button></div></section>
    <div class="section-title"><div><span class="eyebrow">AGORA</span><h2>Foco e direção</h2></div><button class="text-btn" onclick="showPage('planning')">Abrir planejamento →</button></div>
    <div class="grid two"><div class="card focus-card"><span class="label">Foco do mês</span><h3>${esc(monthPlan.focus||"Ainda não definido")}</h3><p>${esc(monthPlan.priorities||"Defina o que realmente importa neste mês.")}</p></div><div class="card focus-card"><span class="label">Foco da semana</span><h3>${esc(weekPlan.focus||"Ainda não definido")}</h3><p>${esc(weekPlan.priorities||"Revise a semana anterior e escolha o foco da próxima.")}</p></div></div>
    <div class="section-title"><div><span class="eyebrow">PILARES</span><h2>Como sua vida está</h2></div><button class="text-btn" onclick="showPage('pillars')">Ver todos →</button></div>
    <div class="pillar-grid">${pillarCards||'<div class="empty">Crie seu primeiro pilar.</div>'}</div>
    <div class="section-title"><div><span class="eyebrow">AÇÕES</span><h2>O que merece movimento</h2></div></div>
    <div class="grid three">
      <button class="action-card" onclick="openReviewForm()"><b>Revisar um pilar</b><span>Atualize percepção, avanços e ajustes.</span></button>
      <button class="action-card" onclick="showPage('planning')"><b>Planejar o período</b><span>Defina foco, prioridades e check-ins.</span></button>
      <button class="action-card" onclick="openQuickCapture()"><b>Registrar algo</b><span>Capture uma ideia, acontecimento ou decisão.</span></button>
    </div>
    ${stalled.length?`<div class="section-title"><div><span class="eyebrow">ATENÇÃO</span><h2>Projetos sem atualização</h2></div></div><div class="card list">${stalled.map(p=>`<div class="list-row"><div><b>${esc(p.title)}</b><small>${esc(pillarName(p.pillarId))} · ${daysBetween((p.updatedAt||p.createdAt).slice(0,10))} dias sem atualização</small></div><button class="btn small" onclick="openProjectForm('${p.id}')">Atualizar</button></div>`).join("")}</div>`:""}
  `;
}

function renderPillars(){
  setHeader("Pilares","As áreas que você decidiu acompanhar na sua vida.",`<button class="btn primary" onclick="openPillarForm()">＋ Novo pilar</button>`);
  const cards=activePillars().map(p=>{const r=latestReview(p.id), obj=data.objectives.filter(o=>o.pillarId===p.id&&o.status!=="done").length, ind=data.indicators.filter(i=>i.pillarId===p.id).length;return `<button class="pillar-card large" onclick="showPage('pillars','${p.id}')"><div class="pillar-head"><span class="pillar-icon">${esc(p.icon||"•")}</span><div><b>${esc(p.name)}</b><small>${esc(p.description||"")}</small></div><span class="status-chip ${trendClass(r?.trend)}">${trendLabel(r?.trend)}</span></div><div class="pillar-stats"><span><b>${obj}</b> objetivos</span><span><b>${ind}</b> indicadores</span><span><b>${data.projects.filter(x=>x.pillarId===p.id&&x.status==="active").length}</b> projetos</span></div></button>`}).join("");
  document.getElementById("content").innerHTML=`<div class="pillar-grid">${cards}</div>${data.pillars.some(p=>p.archived)?`<div class="section-title"><h2>Arquivados</h2></div><div class="card list">${data.pillars.filter(p=>p.archived).map(p=>`<div class="list-row"><b>${esc(p.name)}</b><button class="btn small" onclick="restorePillar('${p.id}')">Restaurar</button></div>`).join("")}</div>`:""}`;
}

function renderPillar(id){
  const p=pillar(id); if(!p){activePillarId=null;return renderPillars()}
  const r=latestReview(id), objs=data.objectives.filter(o=>o.pillarId===id&&o.status!=="done"), inds=data.indicators.filter(i=>i.pillarId===id), projects=data.projects.filter(x=>x.pillarId===id&&x.status!=="done"), habits=data.habits.filter(x=>x.pillarId===id), actions=data.actions.filter(x=>x.pillarId===id);
  setHeader(p.name,p.description||"Painel do pilar",`<button class="btn" onclick="activePillarId=null;showPage('pillars')">← Pilares</button><button class="btn" onclick="openPillarForm('${id}')">Editar</button><button class="btn primary" onclick="openReviewForm('${id}')">Revisar</button>`);
  document.getElementById("content").innerHTML=`
    <div class="pillar-overview"><div class="card"><span class="label">Situação</span><div class="big-status ${trendClass(r?.trend)}">${trendLabel(r?.trend)}</div><p>${r?.adjust?esc(r.adjust):"Ainda sem revisão registrada."}</p></div><div class="card"><span class="label">Última revisão</span><div class="metric-sm">${r?fmtDate(r.date):"—"}</div><p>${r?.better?`Melhorou: ${esc(r.better)}`:"Faça uma revisão para criar histórico."}</p></div><div class="card"><span class="label">Percepção</span><div class="metric-sm">${r?.perception?`${r.perception}/10`:"—"}</div><p>Percepção registrada por você na última revisão.</p></div></div>
    ${blockHeader("Objetivos",`${objs.length} ativo(s)`,`openObjectiveForm(null,'${id}')`)}<div class="card list">${objs.length?objs.map(o=>`<div class="list-row"><div><b>${esc(o.title)}</b><small>${data.goals.filter(g=>g.objectiveId===o.id&&g.status!=="done").length} meta(s) vinculada(s)</small></div><button class="btn small" onclick="openObjectiveForm('${o.id}')">Abrir</button></div>`).join(""):'<div class="empty">Nenhum objetivo ativo.</div>'}</div>
    ${blockHeader("Indicadores",`${inds.length} acompanhado(s)`,`openIndicatorForm(null,'${id}')`)}<div class="indicator-grid">${inds.length?inds.map(renderIndicatorCard).join(""):'<div class="empty card">Nenhum indicador neste pilar.</div>'}</div>
    ${blockHeader("Projetos",`${projects.length} em andamento`,`openProjectForm(null,'${id}')`)}<div class="grid two">${projects.length?projects.map(renderProjectCard).join(""):'<div class="empty card">Nenhum projeto em andamento.</div>'}</div>
    ${blockHeader("Hábitos acompanhados",`${habits.length} hábito(s)`,`openTrackingForm('habit',null,'${id}')`)}<div class="card list">${habits.length?habits.map(x=>trackingRow("habit",x)).join(""):'<div class="empty">Nenhum hábito acompanhado aqui.</div>'}</div>
    ${blockHeader("Ações acompanhadas",`${actions.length} conjunto(s)`,`openTrackingForm('action',null,'${id}')`)}<div class="card list">${actions.length?actions.map(x=>trackingRow("action",x)).join(""):'<div class="empty">Nenhuma ação acompanhada aqui.</div>'}</div>
  `;
}
function blockHeader(title,sub,action){ return `<div class="section-title"><div><h2>${title}</h2><span>${sub}</span></div><button class="text-btn" onclick="${action}">＋ Adicionar</button></div>`; }

function openPillarForm(id=null){
  const p=id?pillar(id):null;
  openModal(p?"Editar pilar":"Novo pilar",`<form class="form" onsubmit="savePillar(event,'${id||""}')"><div class="form-grid two"><label>Nome<input name="name" required value="${esc(p?.name||"")}" placeholder="Ex.: Financeiro"></label><label>Ícone / símbolo<input name="icon" maxlength="3" value="${esc(p?.icon||"•")}"></label></div><label>Descrição<textarea name="description" rows="3" placeholder="O que este pilar representa?">${esc(p?.description||"")}</textarea></label><div class="modal-actions">${p?'<button type="button" class="btn danger" onclick="archivePillar(\''+p.id+'\')">Arquivar</button>':''}<button class="btn primary">Salvar pilar</button></div></form>`);
}
function savePillar(e,id){e.preventDefault();const f=new FormData(e.target), obj={name:String(f.get("name")||"").trim(),icon:String(f.get("icon")||"•").trim()||"•",description:String(f.get("description")||"").trim()}; if(id)Object.assign(pillar(id),obj,{updatedAt:nowISO()});else data.pillars.push(Object.assign({id:uid("pil"),archived:false,createdAt:nowISO()},obj));persist();closeModal();render();toast("Pilar salvo");}
function archivePillar(id){if(!confirmAction("Arquivar este pilar? Os dados vinculados serão preservados."))return;pillar(id).archived=true;activePillarId=null;persist();closeModal();showPage("pillars");}
function restorePillar(id){pillar(id).archived=false;persist();render();}

function pillarOptions(selected="",allowEmpty=true){ return `${allowEmpty?`<option value="">Sem pilar</option>`:""}${activePillars().map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`).join("")}`; }
function objectiveOptions(selected="",pillarId=""){ const arr=data.objectives.filter(o=>!pillarId||o.pillarId===pillarId||!o.pillarId); return `<option value="">Sem objetivo</option>${arr.map(o=>`<option value="${o.id}" ${o.id===selected?"selected":""}>${esc(o.title)}</option>`).join("")}`; }
function goalOptions(selected="",objectiveId=""){ const arr=data.goals.filter(g=>!objectiveId||g.objectiveId===objectiveId); return `<option value="">Sem meta</option>${arr.map(g=>`<option value="${g.id}" ${g.id===selected?"selected":""}>${esc(g.title)}</option>`).join("")}`; }

