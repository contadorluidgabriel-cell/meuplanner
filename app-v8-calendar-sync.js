/* V8 Calendar Sync — commitments only + server automation */
(function(){
'use strict';

const V8_CALENDAR_ENDPOINT='/functions/v1/calendar-v8-sync';

async function v8CalendarSyncRequest(){
 const session=await ensureSession();
 if(!session?.access_token)throw new Error('Entre novamente no Planner.');
 const response=await fetch(`${SUPABASE_URL}${V8_CALENDAR_ENDPOINT}`,{
  method:'POST',
  headers:{
   apikey:SUPABASE_PUBLISHABLE_KEY,
   Authorization:`Bearer ${session.access_token}`,
   'Content-Type':'application/json'
  },
  body:JSON.stringify({action:'sync'})
 });
 const text=await response.text();let result={};
 try{result=text?JSON.parse(text):{}}catch{result={error:text}}
 if(!response.ok)throw new Error(result.error||'Não foi possível sincronizar o Google Agenda.');
 return result;
}

window.manualGoogleCalendarSync=async function(options={}){
 if(calendarSyncing||!currentUser||!navigator.onLine)return;
 calendarSyncing=true;clearTimeout(calendarSyncTimer);
 if(!options.silent&&typeof toast==='function')toast('Sincronizando compromissos com o Google Agenda…');
 try{
  const result=await v8CalendarSyncRequest();
  if(result.state)applyCloudState(result.state);
  googleCalendarStatus.lastSyncedAt=result.lastSyncedAt||new Date().toISOString();
  const meta=readSyncMeta();meta.lastSyncedAt=new Date().toISOString();meta.pending[currentUser.id]=false;writeSyncMeta(meta);
  if(page==='settings')renderSettings();
  if(!options.silent&&typeof toast==='function')toast('Compromissos sincronizados com o Google Agenda');
 }catch(error){
  console.error('V8 Calendar Sync:',error);
  if(!options.silent)alert('Não foi possível sincronizar: '+error.message);
 }finally{calendarSyncing=false}
};

// While the Planner is open, keep a lightweight fallback sync every 3 hours.
// The authoritative schedule runs server-side, so it also works with the app closed.
let v8CalendarInterval=null;
function startV8CalendarFallback(){
 clearInterval(v8CalendarInterval);
 v8CalendarInterval=setInterval(()=>{
  if(currentUser&&navigator.onLine&&googleCalendarStatus.connected&&!calendarSyncing){
   window.manualGoogleCalendarSync({silent:true});
  }
 },3*60*60*1000);
}
window.addEventListener('load',startV8CalendarFallback);
startV8CalendarFallback();
})();
