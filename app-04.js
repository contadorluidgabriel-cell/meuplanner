async function syncToCloud(options={}){
 if(!currentUser)return false;
 if(!navigator.onLine){setSyncStatus("busy","Offline · alterações na fila");return false}
 clearTimeout(syncTimer);
 const snapshot=repairDataShape(normalize(JSON.parse(JSON.stringify(data))));
 setSyncStatus("busy","Sincronizando…");
 try{await cloudUpsertState(snapshot)}catch(error){console.error(error);setSyncStatus("error","Falha ao sincronizar");if(!options.silent)toast("Não foi possível sincronizar. Seus dados continuam salvos neste dispositivo.");return false}
 const meta=readSyncMeta();meta.pending[currentUser.id]=false;meta.imported[currentUser.id]=true;meta.everAuthenticated=true;meta.lastSyncedAt=new Date().toISOString();writeSyncMeta(meta);
 storageSet(userCacheKey(currentUser.id),JSON.stringify(snapshot));
  setSyncStatus("online",syncedLabel("Sincronizado"));
  if(googleCalendarStatus.connected&&!options.skipCalendar)scheduleGoogleCalendarSync();
  scheduleBackgroundPushSync();
 if(!options.silent)toast("Dados sincronizados");
 return true
}
function mergeStateArrays(remote=[],local=[]){
 const merged=new Map();
 [...ensureArray(remote),...ensureArray(local)].forEach((item,index)=>merged.set(item?.id||`json:${JSON.stringify(item)}:${index}`,item));
 return [...merged.values()]
}
function mergePlannerStates(remote,local){
 const r=repairDataShape(normalize(remote||{})),l=repairDataShape(normalize(local||{}));
 return repairDataShape(normalize(Object.assign({},r,l,{
   tasks:mergeStateArrays(r.tasks,l.tasks),habits:mergeStateArrays(r.habits,l.habits),inbox:mergeStateArrays(r.inbox,l.inbox),history:mergeStateArrays(r.history,l.history),
   habitLogs:Object.assign({},r.habitLogs,l.habitLogs),dailyPlans:Object.assign({},r.dailyPlans,l.dailyPlans),weeklyPlans:Object.assign({},r.weeklyPlans,l.weeklyPlans),settings:Object.assign({},r.settings,l.settings)
 })))
}
function applyCloudState(cloudState){
 if(!cloudState||typeof cloudState!=="object")return;
 applyingRemote=true;data=repairDataShape(normalize(cloudState));lastSavedState=JSON.stringify(data);
 storageSet(KEY,lastSavedState);if(currentUser)storageSet(userCacheKey(currentUser.id),lastSavedState);
 render();applyingRemote=false
}
async function reconcileCloud({firstAuth=false}={}){
 if(!currentUser||!navigator.onLine){setSyncStatus("busy","Offline · usando cache local");return}
 const meta=readSyncMeta(),cached=safeParse(storageGet(userCacheKey(currentUser.id)));
 if(meta.pending[currentUser.id]){if(cached)applyCloudState(cached);await syncToCloud({silent:true});return}
 setSyncStatus("busy","Buscando dados…");
 let row;try{row=await cloudReadState()}catch(error){console.error(error);setSyncStatus("error","Nuvem indisponível · usando cache");return}
 const canImportGuest=firstAuth&&!meta.everAuthenticated&&!meta.imported[currentUser.id]&&HAD_LOCAL_STATE;
 const localCandidate=cached||(canImportGuest?data:null);
 if(!row){
   if(cached)applyCloudState(cached);
   await syncToCloud({silent:true});
   if(canImportGuest)toast("Seus dados locais foram importados para a nuvem.")
 }else if(localCandidate&&!meta.imported[currentUser.id]&&stateFingerprint(localCandidate)!==stateFingerprint(row.state)){
   applyCloudState(mergePlannerStates(row.state,localCandidate));
   await syncToCloud({silent:true});toast("Dados locais e da nuvem foram reunidos com segurança.")
 }else{
   applyCloudState(row.state);meta.imported[currentUser.id]=true;meta.everAuthenticated=true;meta.lastSyncedAt=new Date().toISOString();writeSyncMeta(meta);setSyncStatus("online",syncedLabel())
 }
}
function subscribeToCloud(){
 clearInterval(cloudPollTimer);if(!currentUser)return;
 cloudPollTimer=setInterval(async()=>{
   if(document.visibilityState!=="visible"||!navigator.onLine||readSyncMeta().pending[currentUser.id])return;
   try{const row=await cloudReadState(),incoming=row?.state;if(incoming&&stateFingerprint(incoming)!==stateFingerprint(data)){applyCloudState(incoming);const meta=readSyncMeta();meta.lastSyncedAt=new Date().toISOString();writeSyncMeta(meta);setSyncStatus("online",syncedLabel("Atualizado"));toast("Alterações de outro dispositivo recebidas")}}catch{}
 },30000)
}
async function handleSession(session,{firstAuth=false}={}){
 storeSession(session);updateAccountUI();
 if(!currentUser)return;
 const cached=safeParse(storageGet(userCacheKey(currentUser.id)));if(cached)applyCloudState(cached);
  subscribeToCloud();await reconcileCloud({firstAuth});await loadGoogleCalendarStatus();await initBackgroundPush()
}
async function initCloud(){
 try{
   const redirected=consumeAuthRedirect(),session=redirected||await ensureSession();await handleSession(session,{firstAuth:Boolean(session)});if(pendingPasswordRecovery)openPasswordRecoveryModal()
 }catch(error){console.error(error);setSyncStatus("error","Nuvem indisponível · modo local")}
}
function authRedirectUrl(){return PRODUCTION_URL}
function openAccount(){
 if(currentUser){
   openModal("☁ Conta e sincronização",`<div class="form"><div class="auth-note"><strong>${esc(currentUser.email||"")}</strong><br>Seus dados ficam neste dispositivo e também na nuvem.</div><button class="btn primary" onclick="manualSync()">Sincronizar agora</button><button class="btn" onclick="logoutPlanner()">Sair da conta</button></div>`);return
 }
 openModal("☁ Entrar ou criar conta",`<div class="form"><label>E-mail<input id="authEmail" type="email" autocomplete="email" placeholder="voce@exemplo.com"></label><label>Senha<input id="authPassword" type="password" minlength="6" autocomplete="current-password" placeholder="Mínimo de 6 caracteres"></label><div class="formgrid"><button class="btn primary" onclick="signInPlanner()">Entrar</button><button class="btn" onclick="signUpPlanner()">Criar conta</button></div><button class="btn" onclick="requestPasswordRecovery()">Esqueci minha senha</button><div class="auth-note">Sem conta, o Planner continua funcionando normalmente neste dispositivo. Ao entrar pela primeira vez, seus dados locais são enviados automaticamente para sua conta.</div></div>`)
}
function authCredentials(){return {email:document.getElementById("authEmail")?.value.trim(),password:document.getElementById("authPassword")?.value||""}}
async function signInPlanner(){
 const {email,password}=authCredentials();if(!email||password.length<6){toast("Informe e-mail e senha com pelo menos 6 caracteres");return}
 setSyncStatus("busy","Entrando…");try{const session=await cloudRequest("/auth/v1/token?grant_type=password",{method:"POST",body:{email,password},auth:false});session.expires_at=session.expires_at||Math.floor(Date.now()/1000)+(session.expires_in||3600);storeSession(session);await handleSession(session,{firstAuth:true});closeModal();toast("Conta conectada")}catch(error){setSyncStatus("error","Não foi possível entrar");alert("Não foi possível entrar: "+error.message)}
}
async function signUpPlanner(){
 const {email,password}=authCredentials();if(!email||password.length<6){toast("Informe e-mail e senha com pelo menos 6 caracteres");return}
 setSyncStatus("busy","Criando conta…");try{const result=await cloudRequest(`/auth/v1/signup?redirect_to=${encodeURIComponent(authRedirectUrl())}`,{method:"POST",body:{email,password},auth:false});closeModal();if(result.access_token){result.expires_at=result.expires_at||Math.floor(Date.now()/1000)+(result.expires_in||3600);storeSession(result);await handleSession(result,{firstAuth:true});toast("Conta criada e conectada")}else alert("Conta criada. Verifique seu e-mail para confirmar o cadastro e depois clique em Entrar.")}catch(error){setSyncStatus("error","Não foi possível criar a conta");alert("Não foi possível criar a conta: "+error.message)}
}
async function requestPasswordRecovery(){
 const email=document.getElementById("authEmail")?.value.trim();if(!email){toast("Informe seu e-mail primeiro");return}
 setSyncStatus("busy","Enviando recuperação…");
 try{await cloudRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(authRedirectUrl())}`,{method:"POST",body:{email},auth:false});closeModal();setSyncStatus("online","E-mail de recuperação enviado");alert("Enviamos um link para "+email+". Abra o e-mail e clique em Redefinir senha.")}
 catch(error){setSyncStatus("error","Falha na recuperação");alert("Não foi possível enviar o link: "+error.message)}
}
function openPasswordRecoveryModal(){
 pendingPasswordRecovery=false;
 openModal("🔐 Criar nova senha",`<div class="form"><div class="auth-note">Digite uma nova senha para sua conta do Meu Planner Digital.</div><label>Nova senha<input id="newAuthPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Mínimo de 6 caracteres"></label><label>Confirmar nova senha<input id="confirmAuthPassword" type="password" minlength="6" autocomplete="new-password" placeholder="Repita a nova senha"></label><button class="btn primary" onclick="updatePlannerPassword()">Salvar nova senha</button></div>`)
}
async function updatePlannerPassword(){
 const password=document.getElementById("newAuthPassword")?.value||"",confirmation=document.getElementById("confirmAuthPassword")?.value||"";
 if(password.length<6){toast("A senha precisa ter pelo menos 6 caracteres");return}if(password!==confirmation){toast("As senhas não coincidem");return}
 setSyncStatus("busy","Atualizando senha…");
 try{await cloudRequest("/auth/v1/user",{method:"PUT",body:{password}});closeModal();setSyncStatus("online","Senha atualizada");toast("Senha atualizada com sucesso")}
 catch(error){setSyncStatus("error","Falha ao atualizar senha");alert("Não foi possível atualizar a senha: "+error.message)}
}
async function logoutPlanner(){
 if(readSyncMeta().pending[currentUser?.id])await syncToCloud({silent:true});
 if(devicePushSubscribed)await disableBackgroundPush({silent:true});
 try{await cloudRequest("/auth/v1/logout",{method:"POST"})}catch{}storeSession(null);clearInterval(cloudPollTimer);clearTimeout(calendarSyncTimer);googleCalendarStatus={configured:false,connected:false,email:null,calendarName:"Meu Planner Digital",lastSyncedAt:null};closeModal();updateAccountUI();toast("Você saiu da conta. O cache local foi mantido.")
}
async function manualSync(){await reconcileCloud();closeModal()}
async function googleCalendarRequest(action,extra={}){
 const session=await ensureSession();if(!session?.access_token)throw new Error("Entre novamente no Planner.");
 const response=await fetch(`${SUPABASE_URL}/functions/v1/google-calendar`,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(Object.assign({action},extra))});
 const text=await response.text();let result={};try{result=text?JSON.parse(text):{}}catch{result={error:text}}
 if(!response.ok)throw new Error(result.error||"Não foi possível acessar o Google Agenda.");return result
}
