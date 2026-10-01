const $=s=>document.querySelector(s);
const trigger=$('#tutorial-button');
const dialog=document.createElement('dialog');
dialog.className='tutorial-dialog';
dialog.setAttribute('aria-labelledby','tutorial-title');
dialog.setAttribute('aria-describedby','tutorial-description');
dialog.innerHTML='<div class="tutorial-highlight" aria-hidden="true"></div><section class="tutorial-card"><div class="tutorial-top"><span id="tutorial-progress"></span><button type="button" id="tutorial-exit">Salir</button></div><div aria-live="polite" aria-atomic="true"><h2 id="tutorial-title"></h2><p id="tutorial-description"></p></div><div id="tutorial-demo"></div><div class="tutorial-controls"><button type="button" id="tutorial-back">Atrás</button><button type="button" id="tutorial-next">Siguiente</button></div></section>';
document.body.append(dialog);
let steps=[],index=0,target=null,profileWasHidden=true,wasAdmin=false,frame;
function position(){
  if(!dialog.open||!target)return;
  const r=target.getBoundingClientRect(),h=$('.tutorial-highlight');
  h.style.left=Math.max(4,r.left-5)+'px';h.style.top=Math.max(4,r.top-5)+'px';
  h.style.width=Math.min(innerWidth-8,r.width+10)+'px';h.style.height=Math.max(20,Math.min(r.bottom+5,$('.tutorial-card').getBoundingClientRect().top-14)-Math.max(4,r.top-5))+'px';
}
function demo(kind){
  const box=$('#tutorial-demo');
  const examples={
    portions:'<div class="portion-animation"><div class="portion-frame frame-one"><div>✓ Mediodía <b>1 porción</b></div><div>✓ Noche <b>1 porción</b></div></div><div class="portion-frame frame-two"><div>✓ Mediodía <b>2 porciones</b></div><div>Noche <b>Sin retiro</b></div></div><div class="portion-frame frame-three"><div>Mediodía <b>Sin retiro</b></div><div>✓ Noche <b>2 porciones</b></div></div></div><div class="demo-result">Total del día: 2 porciones</div>',
    days:'<div class="demo-choice first">Lunes</div><div class="demo-choice second">Martes</div><div class="demo-result">Elegí los días que necesitás</div>',
    profile:'<div class="demo-choice first">Nombre y condición</div><div class="demo-choice second">Preferencias alimentarias</div><div class="demo-result">Guardar perfil</div>',
    save:'<div class="demo-choice first">Revisar los datos</div><div class="demo-choice second">Guardar</div><div class="demo-result">Confirmación de la operación</div>',
    block:'<div class="demo-choice first">Elegir el día</div><div class="demo-choice second">Bloquear y confirmar</div><div class="demo-result">Reservas del día canceladas</div>',
    pdf:'<div class="demo-choice first">Elegir el día</div><div class="demo-choice second">Descargar PDF del día</div><div class="demo-result">Planilla con total de porciones</div>'
  };
  box.innerHTML=kind?'<p class="demo-label">Ejemplo animado · no modifica datos</p><div class="demo-sequence">'+examples[kind]+'</div>':'';
}
function show(){
  const step=steps[index];
  $('#profile-panel').hidden=step.selector!=='#profile-panel';
  $('#profile-toggle').setAttribute('aria-expanded',String(!$('#profile-panel').hidden));
  target=$(step.selector);
  demo(step.demo);
  $('#tutorial-title').textContent=step.title;
  $('#tutorial-description').textContent=step.text;
  $('#tutorial-progress').textContent='Paso '+(index+1)+' de '+steps.length;
  $('#tutorial-back').disabled=index===0;
  $('#tutorial-next').textContent=index===steps.length-1?'Finalizar':'Siguiente';
  if(target){const r=target.getBoundingClientRect();window.scrollTo({top:Math.max(0,scrollY+r.top-24),behavior:'instant'});}
  cancelAnimationFrame(frame);frame=requestAnimationFrame(position);
}
function finish(){
  if(!dialog.open)return;
  dialog.close();
}
dialog.addEventListener('close',()=>{
  target=null;cancelAnimationFrame(frame);
  $('#profile-panel').hidden=profileWasHidden;
  $('#profile-toggle').setAttribute('aria-expanded',String(!profileWasHidden));
  if(wasAdmin&&!$('#admin-nav').hidden)$('#admin-nav').click();
  trigger.focus();
});
trigger.addEventListener('click',()=>{
  if(dialog.open)return;
  profileWasHidden=$('#profile-panel').hidden;wasAdmin=!$('#admin-view').hidden;
  if(!wasAdmin)$('[data-view="student"]').click();
  steps=[];
  if(!$('#login-button').hidden)steps.push({selector:'#login-button',title:'Ingresá con Google',text:'Usá tu cuenta de Google para reservar. Este recorrido solo explica los pasos: al terminar, tocá Ingresar con Google.'});
  steps.push(
    {selector:'#profile-panel',title:'1. Completá tu perfil',text:'Abrí Mi perfil, completá tus datos y tocá Guardar perfil. Solo hace falta la primera vez; después podés editar tus preferencias. Si todavía no ingresaste, el formulario aparecerá al iniciar sesión.'},
    {selector:'.menu-card',title:'2. Consultá el menú',text:'Acá aparece el menú de esta semana. Podés tocar la imagen para ampliarla. Si todavía no está publicado, el comedor debe cargarlo.'},
    {selector:'#day-list',title:'3. Elegí los días',text:'Marcá uno o varios días de la semana actual. Los días bloqueados, sin habilitar o fuera de plazo no admiten reservas.'},
    {selector:'#day-list',title:'4. Elegí turnos y porciones',text:'Al marcar un día se abren sus horarios: mediodía y noche. Podés pedir hasta 2 porciones por día: 2 en un turno o 1 en cada uno. También podés pedir solo 1. Revisá las restricciones y la modalidad especial, si corresponde.'},
    {selector:'.deadline',title:'5. Tené en cuenta el cierre',text:'Podés crear o editar una reserva antes de las 10:00 de Argentina del día de retiro. El cierre es el mismo para mediodía y noche.'},
    {selector:'#save-button',title:'6. Guardá y comprobá',text:'Tocá Guardar reserva semanal y esperá la confirmación. Si ya reservaste, verás Guardar cambios de mi reserva: edita la reserva existente sin duplicarla. Tus reservas confirmadas aparecen en Mis reservas.'},
    {selector:'.help-card',title:'Si necesitás cancelar',text:'Avisá por WhatsApp al privado del comedor. Si el comedor bloquea un día, sus reservas quedan canceladas. Podés repetir este tutorial cuando quieras desde el botón Tutorial.'}
  );
  steps.forEach(s=>{if(s.selector==='#profile-panel')s.demo='profile';if(s.selector==='#day-list')s.demo=s.title.includes('turnos')?'portions':'days';if(s.selector==='#save-button')s.demo='save';});
  if(wasAdmin)steps=[
    {selector:'#activate-week',title:'1. Habilitá esta semana',text:'Antes de recibir reservas, tocá Habilitar esta semana. Se crean los días disponibles y se conservan los bloqueos que ya existían.',demo:'save'},
    {selector:'#menu-upload',title:'2. Publicá el menú',text:'Seleccioná una imagen JPG, PNG o WebP de hasta 500 KB. Esperá la confirmación de publicación. Los usuarios verán el menú de esta semana.',demo:'save'},
    {selector:'#condition-form',title:'3. Configurá modalidades',text:'Escribí el nombre de la modalidad, elegí las fechas en que corresponde y tocá +. Por ejemplo, un curso que dura martes y miércoles. Podés activar o desactivar modalidades desde la lista.',demo:'days'},
    {selector:'#admin-days',title:'4. Consultá un día',text:'Tocá lunes, martes, miércoles, jueves o viernes. Debajo aparecen sus reservas de mediodía y noche. Los datos se actualizan cuando los usuarios guardan cambios.',demo:'days'},
    {selector:'#admin-results',title:'5. Revisá porciones y bajas',text:'Cada persona puede pedir hasta 2 porciones por día. Revisá cantidades y restricciones de cada turno. Si alguien solicita una baja por WhatsApp, buscá su registro, tocá Dar de baja y confirmá.',demo:'portions'},
    {selector:'#download-day-pdf',title:'6. Descargá la planilla',text:'Descargar PDF del día incluye ambos turnos, subtotales y el total de porciones. Las cancelaciones no suman. Volvé a descargarlo si hubo cambios.',demo:'pdf'},
    {selector:'#block-controls',title:'7. Gestioná días sin servicio',text:'Bloquear un día cancela las reservas de ambos turnos e impide nuevas reservas. Desbloquear no restaura las anteriores. La persona deberá reservar nuevamente antes de las 10:00.',demo:'block'},
    {selector:'#users-list',title:'8. Consultá los perfiles',text:'Acá podés ver los usuarios registrados y sus preferencias. Podés volver a iniciar este recorrido con Tutorial mientras estés en el panel del comedor.'}
  ];
  index=0;dialog.showModal();show();$('#tutorial-next').focus();
});
$('#tutorial-exit').addEventListener('click',finish);
$('#tutorial-next').addEventListener('click',()=>{if(index===steps.length-1)finish();else{index++;show();}});
$('#tutorial-back').addEventListener('click',()=>{if(index>0){index--;show();$('#tutorial-next').focus();}});
window.addEventListener('resize',position);
window.addEventListener('scroll',position,{passive:true});
