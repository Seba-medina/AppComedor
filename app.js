import {validateTemplate,applyWeekTemplate} from './week-template.mjs';
import {RECAPTCHA_ENTERPRISE_SITE_KEY} from './app-check-config.js';
import {filterUsers,shiftWeek,monthBounds,monthlyReport,reportCsv} from './management.mjs';
import {BACKUP_COLLECTIONS,buildBackup,downloadBackup} from './backup.mjs';
import {dailyTableReport,downloadPdf} from './daily-pdf.mjs';
import {auth,db} from './firebase.js';
import {GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {collection,doc,query,where,orderBy,limit,onSnapshot,getDoc,getDocs,getDocsFromServer,setDoc,deleteDoc,writeBatch,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {ADMIN_EMAILS,SHIFTS,shiftLabel,monday,argentinaToday,weekDays,deadline,reservationId,reservationStatus,validateSelections} from './domain.mjs';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,isAdmin=false,profile=null,week=monday(),days={},reservations=[],modalities=[],users=[];
let weekTemplate=null;
let adminWeek=week,adminDays={},adminReservations=[],adminUnsubs=[],adminVersion=0,adminReady=false,adminRecordsReady=false,monthResult=null;
let adminDate=week,attendance=[],activity={},attendanceReady=false,activityReady=false;
const lastAccess=uid=>{const value=activity[uid]?.lastSeen;if(!activityReady)return 'Cargando…';if(!value?.toDate)return 'Sin registro';return new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(value.toDate());};
const attended=(uid,date)=>attendance.some(a=>a.uid===uid&&a.dateKey===date&&a.present);
const attendanceCount=uid=>new Set(attendance.filter(a=>a.uid===uid&&a.present).map(a=>a.dateKey)).size;
let dataReady=false,reservationsReady=false,busy=false,epoch=0,unsubs=[],menuUnsub;
const selected=new Map(),dirty=new Set(),collapsedDays=new Set();
const dates=()=>weekDays(week);
const adminDates=()=>weekDays(adminWeek);
const adminActive=r=>reservationStatus(r,adminDays[r.dateKey])==='Confirmada';
const isActive=r=>reservationStatus(r,days[r.dateKey])==='Confirmada';
const current=()=>reservations.filter(r=>r.week===week);
const label=key=>new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(key+'T00:00:00Z'));
function error(e,target='#app-status'){
  const messages={'permission-denied':'Firebase rechazó el acceso. Revisá que las reglas de firestore.rules estén publicadas.','auth/unauthorized-domain':'Agregá appomedoruner.vercel.app en los dominios autorizados de Authentication.','auth/operation-not-allowed':'Habilitá Google en Authentication.','auth/popup-blocked':'El navegador bloqueó el acceso con Google. Permití la ventana emergente.','auth/popup-closed-by-user':'Se cerró el acceso con Google. Podés volver a intentarlo.','unavailable':'No hay conexión con Firebase. Volvé a intentar cuando tengas internet.'};
  $(target).textContent=messages[e.code]||e.message||'No se pudo completar la operación.';
}
async function action(fn){
  if(busy)return;busy=true;$('#save-button').disabled=true;
  try{await fn();}catch(e){error(e);}finally{busy=false;renderDays();renderAdmin();}
}
function hydrate(){
  for(const date of dates()){
    if(dirty.has(date))continue;
    const records=current().filter(r=>r.uid===user?.uid&&r.dateKey===date&&isActive(r));
    if(records.length)selected.set(date,Object.fromEntries(records.map(r=>[r.shift,{...r}])));
    else selected.delete(date);
  }
}
function renderFirstUse(){
  const confirmed=current().some(r=>r.uid===user?.uid&&isActive(r));
  $('#first-use').hidden=confirmed;
  const loading=!!user&&(!dataReady||!reservationsReady);
  const stage=!user?'login':!profile?'profile':'reserve';
  document.querySelectorAll('[data-setup]').forEach(el=>{const done=el.dataset.setup==='login'?!!user:el.dataset.setup==='profile'?!!profile:confirmed;el.classList.toggle('done',done);el.classList.toggle('current',el.dataset.setup===stage);});
  $('#first-use-title').textContent=!user?'Reservá tu comida en tres pasos':!profile?'Completá tu perfil una sola vez':'Ya podés elegir tus días';
  $('#first-use-message').textContent=loading?'Estamos cargando tus datos…':!user?'Ingresá con tu cuenta de Google para empezar.':!profile?'Guardá tu nombre, condición y preferencias. Después se completan automáticamente.':'Marcá un día, elegí al menos un horario y guardá. Podés repetirlo para varios días.';
  const button=$('#first-use-action');button.disabled=loading;button.textContent=loading?'Cargando…':!user?'Ingresar con Google':!profile?'Completar mi perfil':'Elegir días';
  $('#pending-reservation').hidden=!dirty.size;
}
$('#first-use-action').addEventListener('click',()=>{
  if(!user){$('#login-button').click();return;}
  if(!profile){$('#profile-panel').hidden=false;$('#profile-toggle').setAttribute('aria-expanded','true');$('#profile-panel').scrollIntoView({behavior:'smooth',block:'center'});$('#profile-name').focus({preventScroll:true});return;}
  $('#day-list').scrollIntoView({behavior:'smooth',block:'start'});
  $('#day-list input:not(:disabled)')?.focus({preventScroll:true});
});
function renderDays(){
  renderFirstUse();

  const ready=user&&profile&&dataReady&&reservationsReady;
  $('#configure-template').disabled=!user||!profile||busy;
  $('#apply-template').disabled=!ready||!weekTemplate||busy;
  $('#template-summary').textContent=weekTemplate?Object.entries(weekTemplate.schedule).map(([i,d])=>['Lun','Mar','Mié','Jue','Vie'][i]+': '+[d.mediodia?d.mediodia+' al mediodía':'',d.noche?d.noche+' a la noche':''].filter(Boolean).join(' y ')).join(' · '):'Configurá tus días y porciones habituales para reservar más rápido.';
  if(user&&dataReady&&reservationsReady&&$('#app-status').textContent.includes('Cargando datos'))$('#app-status').textContent=profile?'Datos del comedor actualizados.':'Completá y guardá tu perfil para reservar.';
  $('#save-button').disabled=!ready||busy;
  $('#save-button').textContent=current().some(r=>r.uid===user?.uid&&isActive(r))?'Guardar cambios de mi reserva':'Guardar reserva semanal';
  $('#day-list').innerHTML=dates().map(date=>{
    const day=days[date],closed=Date.now()>=deadline(date),disabled=!ready||!day||day.blocked||closed,picked=selected.get(date);
    const total=picked?Object.values(picked).reduce((n,r)=>n+r.portions,0):0;
    const explanation=!user?'Iniciá sesión':!dataReady?'Cargando':!day?'Semana sin habilitar':day.blocked?'Día bloqueado':closed?'Plazo cerrado':!profile?'Completá tu perfil':picked?(total>2?'Supera el máximo: reducí a 2 porciones':total?total+' / 2 porciones':'Elegí un horario'):'Tocá para elegir';
    const reserved=current().some(r=>r.uid===user?.uid&&r.dateKey===date&&isActive(r));
    const collapsed=reserved&&collapsedDays.has(date)&&!dirty.has(date);
    const options=modalities.filter(c=>c.active&&c.dates.includes(date));
    return '<div class="day-row '+(disabled?'blocked':'')+(picked?' selected':'')+(total>2?' exceeds-limit':'')+'"><div class="day-top"><label><input type="checkbox" data-day="'+date+'" '+(picked?'checked ':'')+(disabled?'disabled':'')+'><span class="day-name">'+esc(label(date))+'</span></label><span>'+esc(explanation)+'</span>'+(reserved?'<button type="button" class="day-collapse" data-toggle-day="'+date+'" aria-expanded="'+!collapsed+'" aria-controls="details-'+date+'">'+(collapsed?'Ver detalles':'Minimizar')+'</button>':'')+'</div>'+(picked?'<div id="details-'+date+'" '+(collapsed?'hidden':'')+'><p>'+ (current().some(r=>r.uid===user?.uid&&r.dateKey===date&&isActive(r))?'Editá tu reserva':'Elegí los horarios')+' · Máximo 2 porciones por día.</p>'+SHIFTS.map(shift=>{
      const r=picked[shift];
      return '<div class="turn-card"><label><input type="checkbox" data-date="'+date+'" data-shift="'+shift+'" '+(r?'checked ':'')+(disabled?'disabled':'')+'> '+shiftLabel(shift)+'</label>'+(r?'<div class="day-details"><div class="field"><label>Porciones<select data-date="'+date+'" data-shift-field="'+shift+'" data-field="portions" '+(disabled?'disabled':'')+'>'+[1,2].map(n=>'<option '+(r.portions===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div><div class="field"><label>Restricciones<input maxlength="100" data-date="'+date+'" data-shift-field="'+shift+'" data-field="diet" value="'+esc(r.diet)+'" '+(disabled?'disabled':'')+'></label></div><div class="field"><label>Modalidad especial<select data-date="'+date+'" data-shift-field="'+shift+'" data-field="modalityId" '+(disabled?'disabled':'')+'>'+(r.modalityId&&!options.some(c=>c.id===r.modalityId)?'<option selected disabled>Modalidad no disponible: elegí otra</option>':'')+'<option value="">Condición habitual</option>'+options.map(c=>'<option value="'+esc(c.id)+'" '+(r.modalityId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label></div></div>':'')+'</div>';
    }).join('')+'</div>':'')+'</div>';
  }).join('');
  $('#selected-count').textContent=selected.size+' días elegidos';
  const mine=current().filter(r=>r.uid===user?.uid&&r.portions>0);
  $('#my-history').innerHTML=mine.length?'<h3>Mis reservas</h3>'+mine.map(r=>'<p>'+esc(label(r.dateKey))+' · '+shiftLabel(r.shift)+' · '+r.portions+' porciones · <strong>'+esc(reservationStatus(r,days[r.dateKey]))+'</strong>'+ (isActive(r)&&Date.now()<deadline(r.dateKey)?' <button type="button" data-cancel-own="'+esc(r.id)+'" '+(busy?'disabled':'')+'>Cancelar reserva</button>':'')+'</p>').join(''):'';
}
function renderAdmin(){
  if(!isAdmin)return;
  const live=adminReservations.filter(adminActive);
  $('#total-stat').textContent=live.length;$('#portions-stat').textContent=live.reduce((sum,r)=>sum+r.portions,0);$('#blocked-stat').textContent=Object.values(adminDays).filter(d=>d.blocked).length;
  const day=adminDate;
  $('#admin-days').innerHTML=adminDates().map((date,i)=>'<button type="button" data-admin-date="'+date+'" aria-pressed="'+(date===day)+'"><strong>'+['Lunes','Martes','Miércoles','Jueves','Viernes'][i]+'</strong><small>'+date.slice(8,10)+'/'+date.slice(5,7)+'</small></button>').join('');
  $('#admin-day-title').textContent=label(day)+(adminDays[day]?.blocked?' · Día bloqueado':'');
  $('#download-day-pdf').disabled=!adminReady||!adminRecordsReady;
  $('#admin-results').innerHTML=SHIFTS.map(shift=>{
    const rows=live.filter(r=>r.dateKey===day&&r.shift===shift);
    return '<div class="shift"><h3>'+shiftLabel(shift)+'<span>'+rows.length+' reservas · '+rows.reduce((sum,r)=>sum+r.portions,0)+' porciones</span></h3>'+(rows.map(r=>'<div class="person"><strong>'+esc(r.name)+'</strong><span>'+esc(r.condition)+' · '+r.portions+' porciones'+(r.modalityId?' · '+esc(modalities.find(c=>c.id===r.modalityId)?.name||'Modalidad especial'):'')+'</span><span>'+esc(r.diet||'—')+'</span><label class="attendance-control"><input type="checkbox" data-attendance="'+esc(r.uid)+'" '+(attended(r.uid,day)?'checked ':'')+(!attendanceReady||busy||day>argentinaToday()?'disabled':'')+'> Asistió este día</label><button data-cancel="'+esc(r.id)+'">Dar de baja</button></div>').join('')||'<p>Sin reservas activas.</p>')+'</div>';
  }).join('');
  $('#admin-results').innerHTML+='<h3>Cancelaciones</h3>'+(adminReservations.filter(r=>r.dateKey===day&&!adminActive(r)).map(r=>'<p>'+esc(r.name)+' · '+shiftLabel(r.shift)+' · '+esc(reservationStatus(r,adminDays[r.dateKey]))+'</p>').join('')||'<p>Sin cancelaciones.</p>');
  $('#block-controls').innerHTML=adminDates().map(date=>'<div class="block-row"><span>'+esc(label(date))+'</span><button data-block="'+date+'" '+(!adminDays[date]?'disabled':'')+'>'+(adminDays[date]?.blocked?'Desbloquear':'Bloquear')+'</button></div>').join('');
  $('#condition-list').innerHTML=modalities.filter(c=>c.dates.some(d=>adminDates().includes(d))).map(c=>'<li><span>'+esc(c.name)+'<small>'+c.dates.map(esc).join(', ')+'</small></span><button data-modality="'+esc(c.id)+'">'+(c.active?'Desactivar':'Activar')+'</button><button class="danger-button" data-delete-modality="'+esc(c.id)+'">Eliminar</button></li>').join('');
  const visibleUsers=filterUsers(users,$('#user-search').value,$('#user-condition-filter').value,$('#user-role-filter').value,ADMIN_EMAILS);
  $('#user-count').textContent=visibleUsers.length+' de '+users.length+' usuarios';
  $('#users-list').innerHTML=visibleUsers.length?'<div class="users-table-wrap"><table class="users-table"><thead><tr><th>Usuario</th><th>Condición / preferencias</th><th>Última conexión</th><th>Días asistidos</th><th>Acciones</th></tr></thead><tbody>'+visibleUsers.map(p=>'<tr><td><strong>'+esc(p.name)+'</strong><br><small>'+esc(p.email)+'</small></td><td>'+esc(p.condition)+'<br><small>'+esc(p.diet||'Sin preferencias')+'</small></td><td>'+esc(lastAccess(p.id))+'</td><td>'+(attendanceReady?attendanceCount(p.id):'—')+'</td><td>'+(ADMIN_EMAILS.includes(p.email)?'<span class="admin-protected">Administrador · protegido</span>':'<button class="danger-button" data-delete-user="'+esc(p.id)+'">Eliminar cuenta</button>')+'</td></tr>').join('')+'</tbody></table></div>':'<p>No hay usuarios que coincidan con los filtros.</p>';
  $('#delete-all-users').disabled=busy||!users.some(p=>!ADMIN_EMAILS.includes(p.email)&&p.id!==user.uid);
}
function rebuildAdminControls(){
  if(!adminDates().includes(adminDate))adminDate=adminWeek;
  $('#admin-week-date').value=adminWeek;
  $('.week-badge').textContent=label(adminWeek)+' — '+label(adminDates()[4]);
  $('#modality-days').innerHTML=adminDates().map((date,i)=>'<label class="modality-date"><input type="checkbox" name="modality-day" value="'+date+'" aria-label="'+esc(label(date))+'"><span><strong>'+['Lun','Mar','Mié','Jue','Vie'][i]+'</strong><small>'+date.slice(8)+'/'+date.slice(5,7)+'</small></span></label>').join('');
}
function rebuildWeekControls(){
  $('#week-caption').textContent='ESTA SEMANA · '+label(dates()[0])+' al '+label(dates()[4]);
  rebuildAdminControls();
}
function subscribeAdminWeek(){
  adminUnsubs.forEach(fn=>fn());adminUnsubs=[];adminDays={};adminReservations=[];adminReady=false;adminRecordsReady=false;
  const version=++adminVersion,session=epoch,guard=fn=>snapshot=>{if(isAdmin&&session===epoch&&version===adminVersion)fn(snapshot);};
  adminUnsubs.push(onSnapshot(query(collection(db,'days'),where('week','==',adminWeek)),guard(s=>{adminDays=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));adminReady=true;renderAdmin();}),e=>error(e)));
  adminUnsubs.push(onSnapshot(query(collection(db,'reservations'),where('week','==',adminWeek)),guard(s=>{adminReservations=s.docs.map(d=>({id:d.id,...d.data()}));adminRecordsReady=true;renderAdmin();}),e=>error(e)));
  adminUnsubs.push(onSnapshot(doc(db,'menus',adminWeek),guard(s=>{const img=$('#admin-menu-preview');img.hidden=!s.exists();if(s.exists())img.src=s.data().image;else img.removeAttribute('src');$('#admin-menu-note').textContent=s.exists()?'Menú de la semana seleccionada.':'Esta semana todavía no tiene menú.';}),e=>error(e)));
  renderAdmin();
}
function changeAdminWeek(value){
  if(!isAdmin||busy){$('#admin-week-date').value=adminWeek;return;}
  try{weekDays(value);}catch(e){error(e);return;}
  adminWeek=value;adminDate=value;rebuildAdminControls();subscribeAdminWeek();
}
function watchMenu(){
  menuUnsub?.();
  menuUnsub=onSnapshot(doc(db,'menus',week),snapshot=>{
    $('.menu-card img').hidden=!snapshot.exists();
    if(snapshot.exists())$('.menu-card img').src=snapshot.data().image;
    $('#menu-note').textContent=snapshot.exists()?'Menú publicado por el comedor.':'El comedor todavía no publicó el menú de esta semana.';
  },e=>error(e));
}
function resetData(){
  weekTemplate=null;if($('#week-template-dialog').open)$('#week-template-dialog').close();
  adminUnsubs.forEach(fn=>fn());adminUnsubs=[];adminVersion++;adminDays={};adminReservations=[];adminReady=false;adminRecordsReady=false;monthResult=null;$('#monthly-results').replaceChildren();$('#audit-list').replaceChildren();$('#monthly-csv').disabled=true;$('#admin-menu-preview').hidden=true;$('#admin-menu-preview').removeAttribute('src');
  for(const selector of ['#users-list','#admin-results','#my-history','#condition-list','#block-controls','#admin-days'])$(selector).replaceChildren();
  for(const selector of ['#total-stat','#portions-stat','#blocked-stat'])$(selector).textContent='—';
  $('#profile-form').reset();$('#profile-message').textContent='';$('#save-message').textContent='';

  unsubs.forEach(fn=>fn());unsubs=[];selected.clear();dirty.clear();collapsedDays.clear();days={};reservations=[];modalities=[];users=[];attendance=[];activity={};attendanceReady=false;activityReady=false;profile=null;dataReady=false;reservationsReady=false;
}
function subscribeData(){
  const session=epoch;
  const guard=fn=>snapshot=>{if(session===epoch)fn(snapshot);};
  unsubs.push(onSnapshot(doc(db,'reservationPreferences',user.uid),guard(s=>{try{weekTemplate=s.exists()?validateTemplate(s.data()):null;}catch(e){weekTemplate=null;error(e);}renderDays();}),e=>error(e)));
  unsubs.push(onSnapshot(doc(db,'users',user.uid),guard(s=>{
    profile=s.exists()?s.data():null;
    if(document.activeElement?.closest('#profile-form')===null){
      $('#profile-name').value=profile?.name||user.displayName||'';$('#profile-condition').value=profile?.condition||'Alumno regular';$('#profile-diet').value=profile?.diet||'';
    }
    renderDays();
  }),e=>error(e)));
  unsubs.push(onSnapshot(query(collection(db,'days'),where('week','==',week)),guard(s=>{
    const previous=days;days=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));dataReady=true;
    for(const key of [...selected.keys()])if(days[key]?.blocked||(previous[key]&&previous[key].generation!==days[key]?.generation)){selected.delete(key);dirty.delete(key);}
    hydrate();renderDays();renderAdmin();
  }),e=>error(e)));
  const q=query(collection(db,'reservations'),where('uid','==',user.uid));
  unsubs.push(onSnapshot(q,guard(s=>{reservations=s.docs.map(d=>({id:d.id,...d.data()}));reservationsReady=true;hydrate();renderDays();renderAdmin();}),e=>error(e)));
  unsubs.push(onSnapshot(collection(db,'modalities'),guard(s=>{modalities=s.docs.map(d=>({id:d.id,...d.data()}));if(!document.activeElement?.closest('#day-list'))renderDays();renderAdmin();}),e=>error(e)));
  if(isAdmin)unsubs.push(onSnapshot(collection(db,'users'),guard(s=>{users=s.docs.map(d=>({id:d.id,...d.data()}));renderAdmin();}),e=>error(e)));
  if(isAdmin){
    subscribeAdminWeek();
    unsubs.push(onSnapshot(query(collection(db,'auditLogs'),orderBy('createdAt','desc'),limit(100)),guard(s=>{renderAudit(s.docs.map(d=>d.data()));}),e=>{if(session===epoch)$('#audit-list').textContent='No se pudo cargar el historial. Revisá las reglas de Firebase.';}));
    unsubs.push(onSnapshot(collection(db,'attendance'),guard(s=>{attendance=s.docs.map(d=>({id:d.id,...d.data()}));attendanceReady=true;renderAdmin();}),e=>error(e)));
    unsubs.push(onSnapshot(collection(db,'userActivity'),guard(s=>{activity=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));activityReady=true;renderAdmin();}),e=>error(e)));
  }
}
$('#login-button').addEventListener('click',async()=>{
  $('#login-button').disabled=true;
  try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch(e){error(e);}finally{$('#login-button').disabled=false;}
});
$('#logout-button').addEventListener('click',()=>action(()=>signOut(auth)));
onAuthStateChanged(auth,u=>{
  epoch++;resetData();adminWeek=monday();adminDate=adminWeek;rebuildAdminControls();user=u;isAdmin=!!u?.emailVerified&&ADMIN_EMAILS.includes(u.email);
  $('#login-button').hidden=!!u;$('#logout-button').hidden=!u;
  $('#admin-nav').hidden=!isAdmin;$('#profile-form').hidden=!u;
  if(!u){$('#profile-panel').hidden=true;$('#profile-toggle').setAttribute('aria-expanded','false');}
  $('#profile-intro').textContent=u?'Guardá tus datos y preferencias para completar tus reservas.':'Iniciá sesión con Google para completar tu perfil.';
  $('.user-chip').textContent=u?.displayName||u?.email||'Sin sesión';
  $('#admin-view').hidden=true;$('#student-view').hidden=false;
  document.querySelectorAll('.nav-button').forEach(b=>{const active=b.dataset.view==='student';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('#app-status').textContent=u?'Sesión iniciada. Cargando datos…':'Iniciá sesión para reservar.';
  if(u){subscribeData();if(u.emailVerified)setDoc(doc(db,'userActivity',u.uid),{lastSeen:serverTimestamp()}).catch(()=>console.warn('No se pudo registrar el acceso. Revisá las reglas de Firestore.'));}renderDays();
});
$('#profile-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{
  if(!user)throw new Error('Iniciá sesión.');
  const name=$('#profile-name').value.trim();if(!name)throw new Error('Ingresá tu nombre y apellido.');
  await setDoc(doc(db,'users',user.uid),{name,condition:$('#profile-condition').value,diet:$('#profile-diet').value.trim(),email:user.email,updatedAt:serverTimestamp()});
  $('#profile-message').textContent='Perfil guardado. Las nuevas selecciones usarán estas preferencias.';$('#app-status').textContent='Perfil actualizado.';
});});
$('#day-list').addEventListener('click',e=>{
  const button=e.target.closest('[data-toggle-day]');if(!button)return;
  const date=button.dataset.toggleDay;
  if(collapsedDays.has(date))collapsedDays.delete(date);else collapsedDays.add(date);
  renderDays();$('#day-list [data-toggle-day="'+date+'"]').focus();
});
$('#day-list').addEventListener('change',e=>{
  const t=e.target,key=t.dataset.day||t.dataset.date;
  if(!key||!profile||!days[key]||days[key].blocked||Date.now()>=deadline(key))return;
  const existing=shift=>current().some(r=>r.uid===user.uid&&r.dateKey===key&&(!shift||r.shift===shift)&&isActive(r));
  if(t.dataset.day){if(t.checked)selected.set(key,{});else if(existing()){t.checked=true;$('#save-message').textContent='Para cancelar, usá el botón Cancelar reserva en Mis reservas.';return;}else selected.delete(key);}
  else if(t.dataset.shift){const shift=t.dataset.shift;if(t.checked)selected.get(key)[shift]={portions:1,diet:profile.diet,modalityId:''};else delete selected.get(key)[shift];}
  else if(t.dataset.field){selected.get(key)[t.dataset.shiftField][t.dataset.field]=t.dataset.field==='portions'?Number(t.value):t.value;dirty.add(key);renderDays();return;}
  dirty.add(key);renderDays();
});
$('#day-list').addEventListener('input',e=>{const t=e.target;if(t.dataset.field==='diet'){selected.get(t.dataset.date)[t.dataset.shiftField].diet=t.value;dirty.add(t.dataset.date);renderFirstUse();}});
$('#save-button').addEventListener('click',()=>action(async()=>{
  const entries=validateSelections(selected,days,profile),batch=writeBatch(db);
  for(const [dateKey,turns]of entries)for(const shift of SHIFTS){
    const generation=days[dateKey].generation,id=reservationId(user.uid,dateKey,shift,generation),old=reservations.find(x=>x.id===id);
    const r=turns[shift]||{portions:0,diet:profile.diet,modalityId:''};
    if(old?.cancelled){if(turns[shift])throw new Error('Este turno fue cancelado. Contactá al administrador si necesitás recuperarlo.');continue;}
    if(r.modalityId&&!modalities.some(c=>c.id===r.modalityId&&c.active&&c.dates.includes(dateKey)))throw new Error('Revisá las modalidades: una opción dejó de estar habilitada.');
    batch.set(doc(db,'reservations',id),{uid:user.uid,dateKey,week,shift,generation,portions:r.portions,diet:r.diet.trim(),modalityId:r.modalityId,name:profile.name,condition:profile.condition,cancelled:false,createdAt:old?.createdAt||serverTimestamp(),updatedAt:serverTimestamp()});
  }
  await batch.commit();dirty.clear();$('#save-message').textContent='✓ Tu reserva quedó confirmada. Revisá el detalle en Mis reservas.';$('#app-status').textContent='Reservas confirmadas.';
}));
$('#my-history').addEventListener('click',e=>{const id=e.target.dataset.cancelOwn;if(!id||!user||!dataReady||!reservationsReady)return;action(async()=>{
  const r=reservations.find(x=>x.id===id&&x.uid===user.uid);
  if(!r||!isActive(r))throw new Error('Esta reserva ya no está activa.');
  if(Date.now()>=deadline(r.dateKey))throw new Error('Solo podés cancelar antes de las 10:00 del día reservado.');
  if(!confirm('¿Cancelar '+r.portions+' porciones del '+label(r.dateKey)+' en el turno '+shiftLabel(r.shift)+'? Para recuperar una reserva cancelada deberás contactar al comedor.'))return;
  await setDoc(doc(db,'reservations',id),{cancelled:true,updatedAt:serverTimestamp()},{merge:true});
  dirty.delete(r.dateKey);hydrate();$('#app-status').textContent='Reserva cancelada. El contador de porciones se actualizó.';
});});
function logData(event,target,detail=''){return {actorUid:user.uid,actorEmail:user.email,event,target,detail,createdAt:serverTimestamp()};}
function addAudit(batch,event,target,detail=''){batch.set(doc(collection(db,'auditLogs')),logData(event,target,detail));}
async function adminSet(ref,data,event,target,options){if(!isAdmin)throw new Error('Acceso reservado al administrador.');const batch=writeBatch(db);if(options)batch.set(ref,data,options);else batch.set(ref,data);addAudit(batch,event,target);await batch.commit();}
async function adminDelete(ref,event,target){if(!isAdmin)throw new Error('Acceso reservado al administrador.');const batch=writeBatch(db);batch.delete(ref);addAudit(batch,event,target);await batch.commit();}
$('#activate-week').addEventListener('click',()=>action(async()=>{
  if(!isAdmin)throw new Error('Acceso reservado al administrador.');
  const batch=writeBatch(db),targetWeek=adminWeek;
  for(const key of weekDays(targetWeek)){const ref=doc(db,'days',key),s=await getDoc(ref);if(!s.exists())batch.set(ref,{week:targetWeek,blocked:false,generation:0,cutoff:Timestamp.fromDate(deadline(key)),reason:'',updatedBy:user.uid,updatedAt:serverTimestamp()});}
  addAudit(batch,'Habilitar semana',targetWeek);
  await batch.commit();$('#app-status').textContent='Semana habilitada. Los bloqueos existentes se conservaron.';
}));
$('#block-controls').addEventListener('click',e=>{const key=e.target.dataset.block;if(!key||!isAdmin)return;action(async()=>{
  const day=adminDays[key],count=adminReservations.filter(r=>r.dateKey===key&&adminActive(r)).length;
  if(!day.blocked&&!confirm('Bloquear '+label(key)+' cancela todas las reservas de ambos turnos (actualmente '+count+'). ¿Confirmar?'))return;
  const reason=day.blocked?'':prompt('Motivo del bloqueo (opcional):','')??null;if(reason===null)return;
  await runTransaction(db,async tx=>{const ref=doc(db,'days',key),s=await tx.get(ref),d=s.data();if(d.blocked!==day.blocked)throw new Error('El estado cambió. Revisá el día y volvé a intentar.');tx.update(ref,{blocked:!d.blocked,generation:d.generation+(d.blocked?0:1),reason:reason.slice(0,160),updatedBy:user.uid,updatedAt:serverTimestamp()});tx.set(doc(collection(db,'auditLogs')),logData(d.blocked?'Desbloquear día':'Bloquear día',key,reason.slice(0,160)));});
  $('#app-status').textContent=day.blocked?'Día desbloqueado. Las reservas canceladas no se restauran.':'Día bloqueado y reservas canceladas.';
});});
$('#admin-results').addEventListener('change',e=>{const uid=e.target.dataset.attendance;if(!uid||!isAdmin||!attendanceReady||busy){renderAdmin();return;}const present=e.target.checked,dateKey=adminDate;action(async()=>{
  if(dateKey>argentinaToday())throw new Error('No se puede marcar asistencia para un día futuro.');
  await adminSet(doc(db,'attendance',uid+'_'+dateKey),{uid,dateKey,present,updatedBy:user.uid,updatedAt:serverTimestamp()},present?'Marcar asistencia':'Quitar asistencia',uid+'_'+dateKey);
  $('#app-status').textContent=present?'Asistencia registrada: suma un día aunque venga a ambos turnos.':'Se quitó la asistencia de este día.';
});});
$('#admin-results').addEventListener('click',e=>{const id=e.target.dataset.cancel;if(!id||!isAdmin)return;action(async()=>{if(!confirm('¿Dar de baja esta reserva solicitada por WhatsApp?'))return;await adminSet(doc(db,'reservations',id),{cancelled:true,updatedAt:serverTimestamp()},'Cancelar reserva',id,{merge:true});});});
$('#condition-form').addEventListener('submit',e=>{e.preventDefault();action(async()=>{
  const name=$('#new-condition').value.trim(),chosen=[...document.querySelectorAll('[name="modality-day"]:checked')].map(e=>e.value);
  if(!name||!chosen.length)throw new Error('Indicá nombre y al menos un día.');
  await adminSet(doc(collection(db,'modalities')),{name,dates:chosen,active:true,updatedAt:serverTimestamp()},'Crear modalidad',name);e.target.reset();
});});
$('#condition-list').addEventListener('click',e=>{const id=e.target.dataset.deleteModality;if(!id||!isAdmin)return;action(async()=>{const item=modalities.find(x=>x.id===id);if(!confirm('¿Eliminar la modalidad "'+item.name+'"? Ya no se podrá seleccionar. Las reservas existentes se conservan.'))return;await adminDelete(doc(db,'modalities',id),'Eliminar modalidad',id);$('#app-status').textContent='Modalidad eliminada.';});});
async function removeComedorAccount(uid){
  if(!isAdmin||uid===user.uid)throw new Error('No se puede eliminar una cuenta administradora.');
  const p=await getDoc(doc(db,'users',uid));
  if(p.exists()&&ADMIN_EMAILS.includes(p.data().email))throw new Error('Esta cuenta administradora está protegida.');
  const lock=doc(db,'accountDeletionLocks',uid);
  if(!(await getDoc(lock)).exists())await setDoc(lock,{createdAt:serverTimestamp()});
  try{
    for(const name of ['reservations','attendance']){
      const snapshot=await getDocs(query(collection(db,name),where('uid','==',uid)));
      for(let i=0;i<snapshot.docs.length;i+=450){const batch=writeBatch(db);for(const item of snapshot.docs.slice(i,i+450))batch.delete(doc(db,name,item.id));await batch.commit();}
    }
    await deleteDoc(doc(db,'userActivity',uid));
    await deleteDoc(doc(db,'reservationPreferences',uid));
    await adminDelete(doc(db,'users',uid),'Eliminar usuario',uid);
  }finally{await deleteDoc(lock);}
}
$('#users-list').addEventListener('click',e=>{const uid=e.target.dataset.deleteUser;if(!uid||!isAdmin||busy)return;action(async()=>{const p=users.find(x=>x.id===uid);if(!p||ADMIN_EMAILS.includes(p.email))return;if(!confirm('¿Eliminar el perfil y TODAS las reservas de '+p.name+'? Esta acción no se puede deshacer. Podrá volver a registrarse.'))return;await removeComedorAccount(uid);$('#user-delete-message').textContent='Perfil y reservas eliminados.';});});
$('#delete-all-users').addEventListener('click',()=>{if(!isAdmin||busy)return;action(async()=>{const snapshot=await getDocs(collection(db,'users'));const targets=snapshot.docs.filter(p=>p.id!==user.uid&&!ADMIN_EMAILS.includes(p.data().email));if(!targets.length)return;if(!confirm('¿Eliminar '+targets.length+' perfiles y TODAS sus reservas? Los administradores se conservan. Esta acción no se puede deshacer.'))return;let done=0;try{for(const p of targets){$('#user-delete-message').textContent='Eliminando '+(done+1)+' de '+targets.length+'…';await removeComedorAccount(p.id);done++;}$('#user-delete-message').textContent=done+' perfiles eliminados. Se conservaron los administradores.';}catch(err){$('#user-delete-message').textContent='Se eliminaron '+done+' de '+targets.length+'. La operación se detuvo; podés volver a intentarlo.';throw err;}});});
$('#condition-list').addEventListener('click',e=>{const id=e.target.dataset.modality;if(!id||!isAdmin)return;action(async()=>{const c=modalities.find(x=>x.id===id);await adminSet(doc(db,'modalities',id),{name:c.name,dates:c.dates,active:!c.active,updatedAt:serverTimestamp()},c.active?'Desactivar modalidad':'Activar modalidad',id);});});
$('#menu-upload').addEventListener('change',e=>{const targetWeek=adminWeek,file=e.target.files[0];if(!file)return;action(async()=>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>500000)throw new Error('Usá JPG, PNG o WebP de hasta 500 KB.');
  const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('No se pudo leer la imagen.'));reader.readAsDataURL(file);});
  await adminSet(doc(db,'menus',targetWeek),{image,updatedAt:serverTimestamp()},'Publicar menú',targetWeek);$('#app-status').textContent='Menú publicado para la semana seleccionada.';e.target.value='';
});});
document.querySelectorAll('.nav-button').forEach(b=>b.addEventListener('click',()=>{
  const admin=b.dataset.view==='admin';if(admin&&!isAdmin)return;$('#admin-view').hidden=!admin;$('#student-view').hidden=admin;document.querySelectorAll('.nav-button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderAdmin();
}));
$('#admin-days').addEventListener('click',e=>{const button=e.target.closest('[data-admin-date]');if(!isAdmin||!button)return;adminDate=button.dataset.adminDate;renderAdmin();});
$('#download-day-pdf').addEventListener('click',()=>{if(!isAdmin||!adminReady||!adminRecordsReady)return;downloadPdf(dailyTableReport(adminDate,adminReservations,adminDays[adminDate],modalities), 'reservas-'+adminDate+'.pdf');});
$('#profile-toggle').addEventListener('click',()=>{const open=$('#profile-panel').hidden;$('#profile-panel').hidden=!open;$('#profile-toggle').setAttribute('aria-expanded',String(open));});
$('.menu-card img').addEventListener('click',e=>e.target.classList.toggle('expanded'));
rebuildWeekControls();watchMenu();renderDays();
// Actualizar el corte sin reconstruir inputs mientras se escribe.
setInterval(()=>{const nowWeek=monday();if(nowWeek!==week){if(adminWeek===week){adminWeek=nowWeek;adminDate=nowWeek;}week=nowWeek;epoch++;resetData();rebuildWeekControls();watchMenu();if(user)subscribeData();renderAdmin();}if(!document.activeElement?.closest('#day-list'))renderDays();},30000);

$('#download-backup').addEventListener('click',()=>{if(!isAdmin||busy)return;action(async()=>{
  const button=$('#download-backup'),message=$('#backup-message');button.disabled=true;message.textContent='Preparando copia de todas las semanas…';
  try{
    const snapshots=Object.fromEntries(await Promise.all(BACKUP_COLLECTIONS.map(async name=>[name,await getDocsFromServer(collection(db,name))])));
    if(!isAdmin)throw new Error('La sesión administradora terminó. Volvé a ingresar.');
    const backup=buildBackup(snapshots);downloadBackup(backup);
    const count=BACKUP_COLLECTIONS.reduce((n,name)=>n+backup.collections[name].length,0);
    message.textContent='Copia preparada: '+count+' registros. Guardá el archivo descargado en un lugar privado.';
  }catch(err){message.textContent='No se pudo completar la copia. No se descargó un respaldo parcial.';throw err;}
  finally{button.disabled=false;}
});});

$('#admin-week-prev').addEventListener('click',()=>changeAdminWeek(shiftWeek(adminWeek,-1)));
$('#admin-week-next').addEventListener('click',()=>changeAdminWeek(shiftWeek(adminWeek,1)));
$('#admin-week-current').addEventListener('click',()=>changeAdminWeek(monday()));
$('#admin-week-date').addEventListener('change',e=>{if(e.target.value)changeAdminWeek(monday(new Date(e.target.value+'T12:00:00-03:00')));});
for(const id of ['#user-search','#user-condition-filter','#user-role-filter'])$(id).addEventListener('input',renderAdmin);
function renderAudit(rows){$('#audit-list').innerHTML=rows.length?'<div class="users-table-wrap"><table class="users-table"><thead><tr><th>Fecha</th><th>Administrador</th><th>Acción</th><th>Referencia</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.createdAt?.toDate?new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(r.createdAt.toDate()):'Guardando…')+'</td><td>'+esc(r.actorEmail)+'</td><td>'+esc(r.event)+'</td><td>'+esc(r.target)+(r.detail?'<br>'+esc(r.detail):'')+'</td></tr>').join('')+'</tbody></table></div>':'<p>Todavía no hay acciones registradas.</p>';}
$('#report-month').value=argentinaToday().slice(0,7);
$('#report-month').addEventListener('change',()=>{monthResult=null;$('#monthly-results').textContent='Seleccioná Generar resumen para consultar este mes.';$('#monthly-csv').disabled=true;});
$('#monthly-generate').addEventListener('click',()=>{if(!isAdmin)return;action(async()=>{
 const month=$('#report-month').value,session=epoch,[start,end]=monthBounds(month);$('#monthly-results').textContent='Consultando el mes…';monthResult=null;$('#monthly-csv').disabled=true;
 try{
 const [rs,ds,ats,us]=await Promise.all([getDocsFromServer(query(collection(db,'reservations'),where('dateKey','>=',start),where('dateKey','<',end))),getDocsFromServer(collection(db,'days')),getDocsFromServer(query(collection(db,'attendance'),where('dateKey','>=',start),where('dateKey','<',end))),getDocsFromServer(collection(db,'users'))]);
 if(session!==epoch||!isAdmin||month!==$('#report-month').value)return;
 monthResult=monthlyReport(month,rs.docs.map(d=>d.data()),Object.fromEntries(ds.docs.map(d=>[d.id,d.data()])),ats.docs.map(d=>d.data()),us.docs.map(d=>({id:d.id,...d.data()})));
 const r=monthResult;$('#monthly-results').innerHTML='<p><strong>'+r.reservations+' reservas · '+r.portions+' porciones solicitadas · '+r.attendance+' asistencias por día · '+r.people+' personas con asistencia</strong></p><div class="users-table-wrap"><table class="users-table"><thead><tr><th>Usuario</th><th>Reservas</th><th>Porciones</th><th>Días reservados</th><th>Días asistidos</th></tr></thead><tbody>'+r.rows.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+p.reservations+'</td><td>'+p.portions+'</td><td>'+p.reservedDays+'</td><td>'+p.attendedDays+'</td></tr>').join('')+'</tbody></table></div>'+(r.rows.length?'':'<p>Sin registros para este mes.</p>');$('#monthly-csv').disabled=false;
 }catch(e){if(session===epoch)$('#monthly-results').textContent='No se pudo consultar el mes. Volvé a intentarlo.';throw e;}
});});
$('#monthly-csv').addEventListener('click',()=>{if(!isAdmin||!monthResult)return;const url=URL.createObjectURL(new Blob([reportCsv(monthResult)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='resumen-comedor-'+monthResult.month+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);});

$('#app-check-status').textContent=RECAPTCHA_ENTERPRISE_SITE_KEY?'App Check: clave del sitio configurada. La exigencia de validación se verifica en Firebase.':'App Check: falta registrar el sitio y configurar la clave pública para activarlo.';

const templateDayNames=['Lunes','Martes','Miércoles','Jueves','Viernes'];
$('#configure-template').addEventListener('click',()=>{
 if(!user||!profile||busy)return;
 const config=weekTemplate||validateTemplate({days:[0,1,2,3,4],mediodia:2,noche:0});
 $('#template-days').innerHTML=templateDayNames.map((name,i)=>{
  const day=config.schedule[i];
  return '<fieldset class="template-day-row"><legend><label><input type="checkbox" name="template-day" value="'+i+'" '+(day?'checked':'')+'> '+name+'</label></legend><div class="template-day-turns">'+SHIFTS.map(shift=>'<label>'+shiftLabel(shift)+'<select data-template-day="'+i+'" data-template-shift="'+shift+'" aria-label="'+name+' '+shiftLabel(shift)+'" '+(day?'':'disabled')+'>'+[0,1,2].map(n=>'<option value="'+n+'" '+(n===(day?.[shift]??(shift==='mediodia'?2:0))?'selected':'')+'>'+(!n?'No voy':n+' '+(n===1?'porción':'porciones'))+'</option>').join('')+'</select></label>').join('')+'</div></fieldset>';
 }).join('');
 $('#template-message').textContent='';$('#week-template-dialog').showModal();
});
$('#template-days').addEventListener('change',e=>{
 if(e.target.name==='template-day')document.querySelectorAll('[data-template-day="'+e.target.value+'"]').forEach(select=>{select.disabled=!e.target.checked;});
});
$('#close-template').addEventListener('click',()=>$('#week-template-dialog').close());
$('#week-template-form').addEventListener('submit',e=>{e.preventDefault();if(!user||busy)return;action(async()=>{try{
 const schedule={};for(const day of document.querySelectorAll('[name="template-day"]:checked'))schedule[day.value]=Object.fromEntries(SHIFTS.map(shift=>[shift,Number(document.querySelector('[data-template-day="'+day.value+'"][data-template-shift="'+shift+'"]').value)]));
 const config=validateTemplate({schedule});await setDoc(doc(db,'reservationPreferences',user.uid),{...config,updatedAt:serverTimestamp()});$('#week-template-dialog').close();$('#app-status').textContent='Configuración guardada. Tocá Usar mi semana y luego Guardar reserva semanal.';
 }catch(err){$('#template-message').textContent=err.code==='permission-denied'?'No se pudo guardar. El responsable de la app debe publicar las reglas actualizadas de Firestore.':err.message;throw err;}});});
$('#apply-template').addEventListener('click',()=>{if(!user||!profile||!weekTemplate||busy||!dataReady||!reservationsReady)return;try{const result=applyWeekTemplate(weekTemplate,dates(),days,reservations,user.uid,profile,selected);for(const date of result.applied){selected.set(date,result.selection.get(date));dirty.add(date);collapsedDays.delete(date);}renderDays();$('#save-message').textContent=(result.applied.length?'Se configuraron '+result.applied.length+' días. Revisá y tocá Guardar reserva semanal.':'No hay días disponibles para esta configuración.')+(result.skipped.length?' No se aplicó en: '+result.skipped.map(s=>label(s.date)+' ('+s.reason+')').join('; ')+'.':'');if(result.applied.length)$('#save-button').focus();}catch(err){error(err);}});
