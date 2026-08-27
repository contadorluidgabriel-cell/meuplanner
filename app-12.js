function addQuickCategory(selectName){
 const name=prompt("Nome da nova categoria:","");if(name==null)return;const clean=name.trim().slice(0,40);if(!clean){toast("Informe um nome para a categoria");return}
 data.settings.categories=normalizeCategories([...categories(),clean]);save();
 const select=document.querySelector(`#modal select[name="${selectName}"]`);if(select){if(![...select.options].some(o=>o.value===clean))select.insertAdjacentHTML("beforeend",`<option value="${esc(clean)}">${esc(clean)}</option>`);select.value=clean}
 toast("Categoria adicionada")
}
function openCategoryManager(){
 openModal("🏷️ Gerenciar categorias",`<form class="form" onsubmit="saveCategories(event)"><div class="auth-note">Escreva uma categoria por linha. Ao remover uma categoria, os itens antigos continuam preservados com o nome que já tinham.</div><label>Categorias<textarea name="categories" rows="9" placeholder="Trabalho&#10;Saúde&#10;Estudos">${esc(categories().join("\n"))}</textarea></label><button class="btn primary">Salvar categorias</button></form>`)
}
function saveCategories(e){
 e.preventDefault();let raw=new FormData(e.target).get("categories")||"",next=normalizeCategories(String(raw).split("\n"));
 data.settings.categories=next;save();closeModal();renderSettings();toast("Categorias atualizadas")
}
function exportBackup(){let blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`meu-planner-digital-backup-${today()}.json`;a.click();URL.revokeObjectURL(u);toast("Backup exportado")}
function importBackup(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{data=repairDataShape(normalize(JSON.parse(r.result)));save();render();toast("Backup importado")}catch{alert("Arquivo inválido.")}};r.readAsText(f)}
function resetAll(){if(confirm("Apagar todos os dados do Planner?")){data=seed();save();showPage("today");toast("Dados apagados")}}

document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openQuick()}if(e.key==="Escape")closeModal()});
window.addEventListener("offline",()=>setSyncStatus(currentUser?"busy":"",currentUser?"Offline · alterações na fila":"Offline · salvo neste dispositivo"));
window.addEventListener("online",async()=>{if(currentUser){await reconcileCloud();await loadGoogleCalendarStatus();await loadBackgroundPushStatus();scheduleGoogleCalendarSync();scheduleBackgroundPushSync()}else updateAccountUI()});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){checkPlannerNotifications();if(currentUser&&navigator.onLine)reconcileCloud()}});
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(data.settings.theme==="system")applyPreferences()});
applyPreferences();render();updateAccountUI();consumeGoogleCalendarResult();registerPlannerServiceWorker();initCloud();startNotificationChecks();
