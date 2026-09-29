// Demo local: el acceso Google y los permisos reales aún requieren Firebase.
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days=['Lunes','Martes','Miércoles','Jueves','Viernes'].map((name,i)=>({name,date:'2026-10-0'+(i+5),number:i+5})), shifts=['Mediodía','Noche'], storageKey='appcomedor-demo-v2';
const seed={profile:{name:'Lucía Martínez',condition:'Alumno regular',diet:'Sin TACC'},blocked:['2026-10-06'],conditions:[{name:'Curso Cítricos y Berrys',active:true,dates:['2026-10-07','2026-10-08']}],reservations:[{uid:'camila',date:'2026-10-05',shift:'Mediodía',name:'Camila Gómez',condition:'Becaria',portions:1,diet:'Sin TACC',status:'activa'},{uid:'mateo',date:'2026-10-05',shift:'Noche',name:'Mateo Fernández',condition:'Alumno regular',portions:2,diet:'—',status:'activa'}],menu:null};
let state;try{state=JSON.parse(localStorage.getItem(storageKey))||structuredClone(seed);}catch{state=structuredClone(seed);}
const selected=new Map(), active=()=>state.reservations.filter(r=>r.status==='activa');
function cutoff(date,now=new Date()){return now>=new Date(date+'T10:00:00-03:00');}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));return true;}catch{alert('No se pudo guardar en este navegador. Habilitá el almacenamiento local o probá una imagen más pequeña.');return false;}}
function renderDays(){
  $('#day-list').innerHTML=days.map(d=>{
    const blocked=state.blocked.includes(d.date),closed=cutoff(d.date),picked=selected.get(d.date),disabled=blocked||closed;
    const options=state.conditions.filter(c=>c.active&&c.dates.includes(d.date));
    let html='<div class="day-row '+(disabled?'blocked':'')+'"><div class="day-top"><label><input type="checkbox" data-day="'+d.date+'" '+(picked?'checked ':'')+(disabled?'disabled':'')+'><span class="date-box"><small>OCT</small><b>'+d.number+'</b></span><span class="day-name">'+d.name+'</span></label>'+(disabled?'<span class="blocked-pill">'+(blocked?'Día bloqueado':'Plazo cerrado')+'</span>':'')+'</div>';
    if(picked&&!disabled){html+='<p>Marcá al menos un horario de retiro.</p>';for(const shift of shifts){const r=picked[shift];html+='<div class="turn-card"><label><input type="checkbox" data-date="'+d.date+'" data-shift="'+shift+'" '+(r?'checked':'')+'> '+shift+'</label>';if(r)html+='<div class="day-details"><div class="field"><label>Porciones<select data-date="'+d.date+'" data-turn="'+shift+'" data-field="portions">'+[1,2,3,4].map(n=>'<option '+(r.portions===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div><div class="field"><label>Restricciones<input data-date="'+d.date+'" data-turn="'+shift+'" data-field="diet" maxlength="100" value="'+esc(r.diet)+'"></label></div><div class="field"><label>Modalidad especial<select data-date="'+d.date+'" data-turn="'+shift+'" data-field="modality"><option value="">Condición habitual</option>'+options.map(c=>'<option '+(r.modality===c.name?'selected ':'')+'value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join('')+'</select></label></div></div>';html+='</div>';}}
    return html+'</div>';
  }).join('');
  $('#selected-count').textContent=selected.size+' días elegidos';
  const canceled=state.reservations.filter(r=>r.uid==='demo'&&r.status==='cancelada_por_bloqueo');
  $('#my-history').innerHTML=canceled.length?'<h3>Cancelaciones por bloqueo</h3>'+canceled.map(r=>'<p>'+esc(r.date)+' · '+esc(r.shift)+' · Cancelada por el comedor</p>').join(''):'';
}
$('#day-list').addEventListener('change',e=>{
  const t=e.target,date=t.dataset.day||t.dataset.date;if(state.blocked.includes(date)||cutoff(date))return;
  if(t.dataset.day){if(t.checked)selected.set(date,{});else{if(active().some(r=>r.uid==='demo'&&r.date===date)){t.checked=true;alert('Las bajas de reservas confirmadas se avisan por WhatsApp.');return;}selected.delete(date);}renderDays();}
  else if(t.dataset.shift){const shift=t.dataset.shift;if(t.checked)selected.get(date)[shift]={portions:1,diet:state.profile.diet,modality:''};else{if(active().some(r=>r.uid==='demo'&&r.date===date&&r.shift===shift)){t.checked=true;alert('La baja de este turno se avisa por WhatsApp.');return;}delete selected.get(date)[shift];}renderDays();}
  else if(t.dataset.field)selected.get(date)[t.dataset.turn][t.dataset.field]=t.dataset.field==='portions'?Number(t.value):t.value;
});
$('#day-list').addEventListener('input',e=>{const t=e.target;if(t.dataset.field==='diet')selected.get(t.dataset.date)[t.dataset.turn].diet=t.value;});
$('#save-button').addEventListener('click',()=>{
  const editable=[...selected].filter(([date])=>!state.blocked.includes(date)&&!cutoff(date));
  if(!editable.length){$('#save-message').textContent='Elegí al menos un día habilitado.';return;}
  if(editable.some(([,turns])=>!Object.keys(turns).length)){$('#save-message').textContent='Marcá al menos un horario en cada día elegido.';return;}
  for(const [date,turns]of editable)for(const [shift,r]of Object.entries(turns)){
    if(r.modality&&!state.conditions.some(c=>c.active&&c.name===r.modality&&c.dates.includes(date))){$('#save-message').textContent='Una modalidad dejó de estar disponible. Volvé a seleccionarla.';return;}
  }
  for(const [date,turns]of editable)for(const [shift,r]of Object.entries(turns)){const i=state.reservations.findIndex(x=>x.uid==='demo'&&x.date===date&&x.shift===shift),record={...r,uid:'demo',date,shift,name:state.profile.name,condition:state.profile.condition,status:'activa'};if(i<0)state.reservations.push(record);else state.reservations[i]=record;}
  if(persist())$('#save-message').textContent='Reservas de demostración guardadas en este navegador.';renderAdmin();
});
function renderAdmin(){
  $('#total-stat').textContent=active().length;$('#portions-stat').textContent=active().reduce((s,r)=>s+r.portions,0);$('#blocked-stat').textContent=state.blocked.length;
  const date=$('#admin-day').value;
  $('#admin-results').innerHTML=shifts.map(shift=>{const rows=active().filter(r=>r.date===date&&r.shift===shift);return '<div class="shift"><h3>'+shift+'<span>'+rows.length+' reservas · '+rows.reduce((s,r)=>s+r.portions,0)+' porciones</span></h3>'+ (rows.map(r=>'<div class="person"><strong>'+esc(r.name)+'</strong><span>'+esc(r.condition)+' · '+r.portions+' porciones'+(r.modality?' · '+esc(r.modality):'')+'</span><span>'+esc(r.diet||'—')+'</span></div>').join('')||'<p>No hay reservas activas.</p>')+'</div>';}).join('');
  $('#admin-results').innerHTML+='<h3>Historial de cancelaciones</h3>'+(state.reservations.filter(r=>r.date===date&&r.status==='cancelada_por_bloqueo').map(r=>'<p>'+esc(r.name)+' · '+esc(r.shift)+' · Cancelada por bloqueo</p>').join('')||'<p>Sin cancelaciones.</p>');
  $('#block-controls').innerHTML=days.map(d=>'<div class="block-row"><span>'+d.name+' '+d.number+'</span><button data-block="'+d.date+'">'+(state.blocked.includes(d.date)?'Desbloquear':'Bloquear')+'</button></div>').join('');
  $('#condition-list').innerHTML=state.conditions.map((c,i)=>'<li><span>'+esc(c.name)+'<small>'+c.dates.map(esc).join(', ')+'</small></span><button data-condition="'+i+'">'+(c.active?'Desactivar':'Activar')+'</button></li>').join('');
}
$('#block-controls').addEventListener('click',e=>{const date=e.target.dataset.block;if(!date)return;if(state.blocked.includes(date))state.blocked=state.blocked.filter(x=>x!==date);else{const count=active().filter(r=>r.date===date).length;if(!confirm('Bloquear '+date+': se cancelarán '+count+' reservas de ambos horarios. ¿Continuar?'))return;state.blocked.push(date);for(const r of state.reservations)if(r.date===date&&r.status==='activa'){r.status='cancelada_por_bloqueo';r.canceledAt=new Date().toISOString();r.canceledBy='admin-demo';}selected.delete(date);}persist();renderDays();renderAdmin();});
$('#condition-list').addEventListener('click',e=>{const i=e.target.dataset.condition;if(i===undefined)return;state.conditions[i].active=!state.conditions[i].active;persist();renderAdmin();renderDays();});
$('#condition-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#new-condition').value.trim(),dates=[...document.querySelectorAll('[name="modality-day"]:checked')].map(x=>x.value);if(!name||!dates.length){alert('Indicá nombre y al menos un día.');return;}if(state.conditions.some(c=>c.name.toLocaleLowerCase()===name.toLocaleLowerCase())){alert('Ya existe esa modalidad.');return;}state.conditions.push({name,dates,active:true});persist();e.target.reset();renderAdmin();renderDays();});
document.querySelectorAll('.nav-button').forEach(b=>b.addEventListener('click',()=>{const admin=b.dataset.view==='admin';$('#student-view').hidden=admin;$('#admin-view').hidden=!admin;document.querySelectorAll('.nav-button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderAdmin();}));
$('#admin-day').innerHTML=days.map(d=>'<option value="'+d.date+'">'+d.name+' '+d.number+' de octubre</option>').join('');$('#admin-day').addEventListener('change',renderAdmin);
$('#profile-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#profile-name').value.trim();if(!name)return;state.profile={name,condition:$('#profile-condition').value,diet:$('#profile-diet').value.trim()};persist();$('#profile-message').textContent='Perfil guardado. Las nuevas selecciones usarán estas preferencias.';$('.user-chip').textContent=name+' · '+state.profile.condition;});
$('#profile-name').value=state.profile.name;$('#profile-condition').value=state.profile.condition;$('#profile-diet').value=state.profile.diet;
$('#menu-upload').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1500000){alert('Usá JPG, PNG o WebP de hasta 1,5 MB.');return;}const reader=new FileReader();reader.onload=()=>{const old=state.menu;state.menu=reader.result;if(persist()){$('.menu-card img').src=state.menu;$('.menu-card img').alt='Menú semanal cargado en la demo';}else state.menu=old;};reader.readAsDataURL(file);});
if(state.menu){$('.menu-card img').src=state.menu;$('.menu-card img').alt='Menú semanal cargado en la demo';}
$('.menu-card img').addEventListener('click',e=>e.target.classList.toggle('expanded'));
$('#modality-days').innerHTML=days.map(d=>'<label><input type="checkbox" name="modality-day" value="'+d.date+'"> '+d.name+'</label>').join('');
for(const r of active().filter(r=>r.uid==='demo')){if(!selected.has(r.date))selected.set(r.date,{});selected.get(r.date)[r.shift]={...r};}
renderDays();renderAdmin();setInterval(renderDays,60000);
