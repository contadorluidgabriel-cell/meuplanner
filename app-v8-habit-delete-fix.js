/* V8 — exclusão de hábito com persistência imediata */
(function(){
'use strict';
window.deleteHabit=async function(id){
 const h=(data.habits||[]).find(x=>x.id===id);if(!h)return;
 const ok=confirm(`Excluir o hábito “${h.name}”?\n\nO hábito e todo o histórico de registros dele serão apagados. Esta ação não pode ser desfeita.`);
 if(!ok)return;
 try{
  clearTimeout(syncTimer);clearTimeout(calendarSyncTimer);clearTimeout(pushSyncTimer);
 }catch{}
 data.habits=(data.habits||[]).filter(x=>x.id!==id);
 Object.keys(data.habitLogs||{}).forEach(k=>{if(k.startsWith(id+'_'))delete data.habitLogs[k]});
 try{save()}catch{}
 try{closeModal()}catch{}
 try{render()}catch{}
 try{
  if(currentUser&&navigator.onLine){
   const snapshot=repairDataShape(normalize(JSON.parse(JSON.stringify(data))));
   await cloudUpsertState(snapshot);
   const meta=readSyncMeta();
   meta.pending[currentUser.id]=false;meta.imported[currentUser.id]=true;meta.everAuthenticated=true;meta.lastSyncedAt=new Date().toISOString();writeSyncMeta(meta);
   storageSet(userCacheKey(currentUser.id),JSON.stringify(snapshot));
   lastSavedState=JSON.stringify(data);
   setSyncStatus('online',syncedLabel('Sincronizado'));
  }
 }catch(error){
  console.error('Habit delete sync:',error);
  try{const meta=readSyncMeta();if(currentUser)meta.pending[currentUser.id]=true;writeSyncMeta(meta);scheduleCloudSave()}catch{}
 }
 try{scheduleBackgroundPushSync()}catch{}
 try{toast('Hábito excluído')}catch{}
};
})();
