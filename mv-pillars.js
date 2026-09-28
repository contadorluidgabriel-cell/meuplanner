function currentMonthStart(){ return today().slice(0,7)+"-01"; }
function pillarDerivedStatus(id){
  const statuses=data.goals.filter(g=>g.pillarId===id&&g.status!=="done").map(g=>g.qualitativeStatus).filter(Boolean);
  if(statuses.includes("regressing"))return {trend:"attention",label:"Atenção"};
  if(statuses.includes("evolving"))return {trend:"improving",label:"Evoluindo"};
  if(statuses.length&&statuses.every(s=>s==="stagnant"||s==="paused"))return {trend:"stable",label:"Estagnado"};
  const r=latestReview(id,"pillar");
  return {trend:r?.trend||"",label:trendLabel(r?.trend)};
}
function homeSummary(){
  const month=currentMonthStart(), monthReviews=data.reviews.filter(r=>r.date>=month), activeGoals=data.goals.filter(g=>g.status!=="done");
  return {
    improving:activeGoals.filter(g=>g.qualitativeStatus==="evolving").length,
    attention:activeGoals.filter(g=>g.qualitativeStatus==="regressing").length,
    activeGoals:activeGoals.length,
    checkins:data.weeklyCheckins.filter(x=>x.date>=month).length,
    events:data.timeline.filter(e=>e.date>=month).length
  };
}
function onboardingHTML(){
  const hasGoal=data.goals.length>0,hasIndicator=data.indicators.length>0,hasWeekly=data.weeklyCheckins.length>0;
  if(hasGoal&&hasIndicator&&hasWeekly)return "";
  return `<section class="onboarding card"><div class="section-title compact"><div><span class="eyebrow">COMECE AQUI</span><h2>Monte seu primeiro ciclo de acompanhamento</h2></div></div><div class="onboarding-steps">
    <button class="onboard-step ${hasGoal?"done":""}" onclick="showPage('objectives')"><span>${hasGoal?"✓":"1"}</span><div><b>Defina uma meta</b><small>Escolha algo concreto que você quer acompanhar.</small></div></button>
    <button class="onboard-step ${hasIndicator?"done":""}" onclick="showPage('pillars')"><span>${hasIndicator?"✓":"2"}</span><div><b>Adicione um indicador</b><small>Peso, renda, clientes ou outro número importante.</small></div></button>
    <button class="onboard-step ${hasWeekly?"done":""}" onclick="showPage('weekly')"><span>${hasWeekly?"✓":"3"}</span><div><b>Faça o primeiro check-in</b><small>Registre a semana e crie seu histórico.</small></div></button>
  </div></section>`;
}

function renderHome(){
  const s=homeSummary(),monthPlan=data.plans[planKey("month")]||{},weekPlan=data.plans[planKey("week")]||{};
  const goalTargets=Object.entries(monthPlan.goalTargets||{}).filter(([,v])=>v!==""&&v!==null&&v!==undefined);
  const trackedCount=(monthPlan.trackedGoalIds?.length||0)+(monthPlan.trackedIndicatorIds?.length||0)+(monthPlan.trackedHabitIds?.length||0);
  const pillarCards=activePillars().map(p=>{
    const st=pillarDerivedStatus(p.id),goals=data.goals.filter(g=>g.pillarId===p.id&&g.status!=="done"),inds=data.indicators.filter(i=>i.pillarId===p.id);
    return `<div class="pillar-card"><button class="pillar-card-main" onclick="showPage('pillars','${p.id}')"><div class="pillar-head"><span class="pillar-icon">${esc(p.icon||"•")}</span><div><b>${esc(p.name)}</b><small>${esc(st.label)}</small></div><span class="status-dot ${trendClass(st.trend)}"></span></div><div class="pillar-stats"><span><b>${goals.length}</b> metas</span><span><b>${inds.length}</b> indicadores</span></div></button><button class="pillar-quick" onclick="openGoalForm(null,'','${p.id}')">＋ Adicionar meta</button></div>`;
  }).join("");
  setHeader("Minha Vida",new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long"}).format(new Date()),`<button class="btn ghost" onclick="openQuickCapture()">＋ Inbox</button><button class="btn primary" onclick="showPage('weekly')">✓ Check-in semanal</button>`);
  document.getElementById("content").innerHTML=`
    <section class="life-hero">
      <div class="life-hero-glow"></div>
      <div class="life-hero-main">
        <div class="hero-topline"><span class="eyebrow">FOCO DO MÊS · ${esc(periodLabel("month").toUpperCase())}</span><button class="hero-edit" onclick="showPage('planning')">Planejamento ↗</button></div>
        <h2>${esc(monthPlan.focus||"Defina a direção deste mês")}</h2>
        <p>${esc(monthPlan.successDefinition||"O mês ganha sentido quando você define onde quer chegar e o que vale acompanhar.")}</p>
        <div class="hero-signals"><span><b>${goalTargets.length}</b> marcos do mês</span><span><b>${trackedCount}</b> acompanhamentos</span><span><b>${s.checkins}</b> check-ins</span></div>
      </div>
      <div class="life-hero-week"><span class="eyebrow">AGORA · FOCO DA SEMANA</span><h3>${esc(weekPlan.focus||"Ainda não definido")}</h3><p>${esc(weekPlan.priorities||"Seu próximo check-in define a direção da semana seguinte.")}</p><button class="btn primary" onclick="showPage('weekly')">Registrar semana</button></div>
    </section>
    <div class="mobile-focus-actions"><button class="btn primary" onclick="showPage('weekly')">✓ Registrar semana</button><button class="btn" onclick="openQuickCapture()">＋ Inbox</button></div>
    <div class="desktop-home-extra">
      ${onboardingHTML()}
      <div class="section-title"><div><span class="eyebrow">RESUMO DO PERÍODO</span><h2>O que os registros mostram</h2></div><button class="text-btn" onclick="showPage('reviews')">Ver histórico →</button></div>
      <div class="insight-grid"><div class="insight-card"><span class="insight-icon good">↗</span><div><b>${s.improving}</b><span>metas evoluindo</span></div></div><div class="insight-card"><span class="insight-icon danger">!</span><div><b>${s.attention}</b><span>pedem atenção</span></div></div><div class="insight-card"><span class="insight-icon neutral">✓</span><div><b>${s.checkins}</b><span>check-ins no mês</span></div></div><div class="insight-card"><span class="insight-icon neutral">◇</span><div><b>${s.events}</b><span>registros no histórico</span></div></div></div>
      <div class="section-title"><div><span class="eyebrow">PILARES</span><h2>Como sua vida está</h2></div><button class="text-btn" onclick="showPage('pillars')">Ver todos →</button></div>
      <div class="pillar-grid">${pillarCards||'<div class="empty card">Crie seu primeiro pilar.</div>'}</div>
      <div class="section-title"><div><span class="eyebrow">AÇÕES</span><h2>Registrar e ajustar</h2></div></div>
      <div class="grid three"><button class="action-card primary-action" onclick="showPage('weekly')"><span class="action-glyph">✓</span><b>Check-in semanal</b><span>Atualize os registros escolhidos para este mês.</span></button><button class="action-card" onclick="openMonthlyReviewForm()"><span class="action-glyph">↻</span><b>Fechar o mês</b><span>Entenda o que aconteceu, o impacto e o próximo ajuste.</span></button><button class="action-card" onclick="openQuickCapture()"><span class="action-glyph">＋</span><b>Registrar algo</b><span>Guarde uma ideia, acontecimento ou decisão.</span></button></div>
    </div>`;
}
function renderPillars(){
  setHeader("Pilares","As áreas que você decidiu acompanhar na sua vida.",`<button class="btn primary" onclick="openPillarForm()">＋ Novo pilar</button>`);
  const cards=activePillars().map(p=>{
    const st=pillarDerivedStatus(p.id),goals=data.goals.filter(g=>g.pillarId===p.id&&g.status!=="done").length,ind=data.indicators.filter(i=>i.pillarId===p.id).length;
    return `<div class="pillar-card large"><button class="pillar-card-main" onclick="showPage('pillars','${p.id}')"><div class="pillar-head"><span class="pillar-icon">${esc(p.icon||"•")}</span><div><b>${esc(p.name)}</b><small>${esc(p.description||"")}</small></div><span class="status-chip ${trendClass(st.trend)}">● ${esc(st.label)}</span></div><div class="pillar-stats"><span><b>${goals}</b> metas</span><span><b>${ind}</b> indicadores</span><span><b>${data.projects.filter(x=>x.pillarId===p.id&&x.status==="active").length}</b> projetos</span></div></button><button class="pillar-quick" onclick="openGoalForm(null,'','${p.id}')">＋ Adicionar meta</button></div>`;
  }).join("");
  document.getElementById("content").innerHTML=`<div class="pillar-grid">${cards}</div>${data.pillars.some(p=>p.archived)?`<div class="section-title"><h2>Arquivados</h2></div><div class="card list">${data.pillars.filter(p=>p.archived).map(p=>`<div class="list-row"><b>${esc(p.name)}</b><button class="btn small" onclick="restorePillar('${p.id}')">Restaurar</button></div>`).join("")}</div>`:""}`;
}
function renderPillar(id){
  const p=pillar(id);if(!p){activePillarId=null;return renderPillars()}
  const st=pillarDerivedStatus(id),r=latestReview(id,"pillar"),objs=data.objectives.filter(o=>o.pillarId===id&&o.status!=="done"),goals=data.goals.filter(g=>g.pillarId===id&&g.status!=="done"),inds=data.indicators.filter(i=>i.pillarId===id),projects=data.projects.filter(x=>x.pillarId===id&&x.status!=="done"),habits=data.habits.filter(x=>x.pillarId===id);
  setHeader(p.name,p.description||"Painel do pilar",`<button class="btn" onclick="activePillarId=null;showPage('pillars')">← Pilares</button><button class="btn" onclick="openPillarForm('${id}')">Editar</button><button class="btn primary" onclick="openPillarReviewForm('${id}')">Revisar pilar</button>`);
  document.getElementById("content").innerHTML=`
    <div class="pillar-overview"><div class="card"><span class="label">STATUS</span><div class="big-status ${trendClass(st.trend)}">● ${esc(st.label)}</div><p>Status baseado nos seus check-ins e revisões.</p></div><div class="card"><span class="label">ÚLTIMA REVISÃO</span><div class="metric-sm">${r?fmtDate(r.date):"—"}</div><p>${r?.adjust?esc(r.adjust):"Faça uma revisão específica deste pilar quando precisar de contexto."}</p></div><div class="card"><span class="label">METAS ATIVAS</span><div class="metric-sm">${goals.length}</div><p>${goals.filter(g=>g.qualitativeStatus==="evolving").length} evoluindo · ${goals.filter(g=>g.qualitativeStatus==="regressing").length} em atenção</p></div></div>
    ${blockHeader("Metas",`${goals.length} ativa(s)`,`openGoalForm(null,'','${id}')`)}<div class="card list">${goals.length?goals.map(renderGoalRow).join(""):'<div class="empty">Nenhuma meta neste pilar.</div>'}</div>
    ${blockHeader("Objetivos",`${objs.length} ativo(s)`,`openObjectiveForm(null,'${id}')`)}<div class="card list">${objs.length?objs.map(o=>`<div class="list-row"><div><b>${esc(o.title)}</b><small>${data.goals.filter(g=>g.objectiveId===o.id&&g.status!=="done").length} meta(s)</small></div><button class="btn small" onclick="openObjectiveForm('${o.id}')">Editar</button></div>`).join(""):'<div class="empty">Nenhum objetivo ativo.</div>'}</div>
    ${blockHeader("Indicadores",`${inds.length} acompanhado(s)`,`openIndicatorForm(null,'${id}')`)}<div class="indicator-grid">${inds.length?inds.map(renderIndicatorCard).join(""):'<div class="empty card">Nenhum indicador neste pilar.</div>'}</div>
    ${blockHeader("Hábitos acompanhados",`${habits.length} hábito(s)`,`openTrackingForm('habit',null,'${id}')`)}<div class="card list">${habits.length?habits.map(x=>trackingRow("habit",x)).join(""):'<div class="empty">Nenhum hábito acompanhado aqui.</div>'}</div>
    ${projects.length?`${blockHeader("Projetos",`${projects.length} em andamento`,`openProjectForm(null,'${id}')`)}<div class="grid two">${projects.map(renderProjectCard).join("")}</div>`:""}`;
}
function blockHeader(title,sub,action){return `<div class="section-title"><div><h2>${title}</h2><span>${sub}</span></div><button class="text-btn" onclick="${action}">＋ Adicionar</button></div>`;}
function openPillarForm(id=null){
  const p=id?pillar(id):null;
  openModal(p?"Editar pilar":"Novo pilar",`<form class="form" onsubmit="savePillar(event,'${id||""}')"><div class="form-grid two"><label>Nome<input name="name" required value="${esc(p?.name||"")}" placeholder="Ex.: Finanças"></label><label>Ícone / símbolo<input name="icon" maxlength="3" value="${esc(p?.icon||"•")}"></label></div><label>Descrição<textarea name="description" rows="3">${esc(p?.description||"")}</textarea></label><div class="modal-actions">${p?`<button type="button" class="btn danger" onclick="archivePillar('${p.id}')">Arquivar</button>`:""}<button class="btn primary">Salvar pilar</button></div></form>`);
}
function savePillar(e,id){e.preventDefault();const f=new FormData(e.target),obj={name:String(f.get("name")||"").trim(),icon:String(f.get("icon")||"•").trim()||"•",description:String(f.get("description")||"").trim()};if(id)Object.assign(pillar(id),obj,{updatedAt:nowISO()});else data.pillars.push(Object.assign({id:uid("pil"),archived:false,createdAt:nowISO()},obj));persist();closeModal();render();toast("Pilar salvo");}
function archivePillar(id){if(!confirmAction("Arquivar este pilar? Os dados vinculados serão preservados."))return;pillar(id).archived=true;activePillarId=null;persist();closeModal();showPage("pillars");}
function restorePillar(id){pillar(id).archived=false;persist();render();}
function pillarOptions(selected="",allowEmpty=true){return `${allowEmpty?'<option value="">Sem pilar</option>':""}${activePillars().map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`).join("")}`;}
function objectiveOptions(selected="",pillarId=""){const arr=data.objectives.filter(o=>!pillarId||o.pillarId===pillarId||!o.pillarId);return `<option value="">Sem objetivo</option>${arr.map(o=>`<option value="${o.id}" ${o.id===selected?"selected":""}>${esc(o.title)}</option>`).join("")}`;}
function goalOptions(selected="",objectiveId=""){const arr=data.goals.filter(g=>!objectiveId||g.objectiveId===objectiveId);return `<option value="">Sem meta</option>${arr.map(g=>`<option value="${g.id}" ${g.id===selected?"selected":""}>${esc(g.title)}</option>`).join("")}`;}
