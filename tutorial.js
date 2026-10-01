const $=s=>document.querySelector(s);
const trigger=$('#tutorial-button');
const dialog=document.createElement('dialog');
dialog.className='tutorial-dialog';
dialog.setAttribute('aria-labelledby','tutorial-title');
dialog.setAttribute('aria-describedby','tutorial-description');
dialog.innerHTML='<div class="tutorial-highlight" aria-hidden="true"></div><section class="tutorial-card"><div class="tutorial-top"><span id="tutorial-progress"></span><button type="button" id="tutorial-exit">Salir</button></div><div aria-live="polite" aria-atomic="true"><h2 id="tutorial-title"></h2><p id="tutorial-description"></p></div><div id="tutorial-demo"></div><div class="tutorial-controls"><button type="button" id="tutorial-back">Atrás</button><button type="button" id="tutorial-next">Siguiente</button></div></section>';
document.body.append(dialog);
let steps=[],index=0,target=null,profileWasHidden=true,wasAdmin=false,frame,demoTimer;
function position(){
  if(!dialog.open||!target)return;
  const r=target.getBoundingClientRect(),highlight=$('.tutorial-highlight'),card=$('.tutorial-card');
  const margin=12,gap=18,cw=card.offsetWidth,ch=card.offsetHeight;
  const clamp=(n,min,max)=>Math.max(min,Math.min(n,Math.max(min,max)));
  const candidates=[
    [r.left-cw-gap,r.top], [r.right+gap,r.top],
    [r.left,r.bottom+gap], [r.left,r.top-ch-gap],
    [margin,innerHeight-ch-margin], [innerWidth-cw-margin,margin]
  ].map(([x,y])=>[clamp(x,margin,innerWidth-cw-margin),clamp(y,margin,innerHeight-ch-margin)]);
  const overlap=([x,y])=>Math.max(0,Math.min(x+cw,r.right+gap)-Math.max(x,r.left-gap))*Math.max(0,Math.min(y+ch,r.bottom+gap)-Math.max(y,r.top-gap));
  candidates.sort((a,b)=>overlap(a)-overlap(b));
  card.style.left=candidates[0][0]+'px';card.style.top=candidates[0][1]+'px';card.style.bottom='auto';card.style.transform='none';
  const left=Math.max(4,r.left-5),top=Math.max(4,r.top-5);
  highlight.style.left=left+'px';highlight.style.top=top+'px';
  highlight.style.width=Math.max(0,Math.min(innerWidth-4,r.right+5)-left)+'px';
  highlight.style.height=Math.max(0,Math.min(innerHeight-4,r.bottom+5)-top)+'px';
}

function demo(kind){
  clearInterval(demoTimer);
  const box=$('#tutorial-demo');
  const examples={
    portions:[['Elegir el día','✓ Jueves','Mediodía: sin elegir','Noche: sin elegir','0 porciones'],['Seleccionar mediodía','✓ Jueves','✓ Mediodía: 1 porción','Noche: sin elegir','Total: 1 porción'],['Agregar noche','✓ Jueves','✓ Mediodía: 1 porción','✓ Noche: 1 porción','Total: 2 porciones'],['Otra opción: todo al mediodía','✓ Jueves','✓ Mediodía: 2 porciones','Noche: sin retiro','Total: 2 porciones'],['O todo a la noche','✓ Jueves','Mediodía: sin retiro','✓ Noche: 2 porciones','Total: 2 porciones']],
    days:[['Elegir una fecha','Lunes','Martes','Miércoles','Seleccioná un día'],['Marcar martes','Lunes','✓ Martes','Miércoles','Martes seleccionado'],['Consultar sus horarios','Martes seleccionado','Mediodía','Noche','Los detalles aparecen debajo']],
    profile:[['Abrir Mi perfil','Mi perfil','Nombre: sin completar','Preferencias: sin completar','Abrir formulario'],['Completar los datos','Nombre: Ana Pérez','Condición: Alumno regular','Preferencias: Sin TACC','Datos de ejemplo'],['Guardar el perfil','Ana Pérez','Alumno regular · Sin TACC','Guardar perfil','✓ Perfil guardado']],
    save:[['Revisar antes de guardar','Jueves','Mediodía: 1 · Noche: 1','Total: 2 porciones','Datos listos'],['Guardar la reserva','Guardar reserva semanal','Procesando…','Esperá la confirmación','Guardando'],['Comprobar el resultado','✓ Reservas confirmadas','Mis reservas','Jueves · Mediodía y noche','✓ Reserva guardada']],
    activate:[['Abrir el panel','Esta semana','Días sin habilitar','Habilitar esta semana','Preparar la semana'],['Habilitar los días','Habilitar esta semana','Procesando…','Se conservan los bloqueos','Guardando'],['Ver la confirmación','✓ Semana habilitada','Lunes a viernes disponibles','Publicá el menú','Lista para recibir reservas']],
    menu:[['Seleccionar una imagen','Cargar menú semanal','Elegir archivo','JPG, PNG o WebP · hasta 500 KB','Seleccionar imagen'],['Cargar el menú','menu-semanal.jpg','Publicando…','Menú de esta semana','Esperar confirmación'],['Menú publicado','✓ Imagen publicada','Visible para los usuarios','Tocar imagen para ampliar','✓ Menú listo']],
    modalities:[['Escribir la modalidad','Curso de cocina','Elegir fechas','Martes · Miércoles','Nombre del ejemplo'],['Marcar las fechas','Curso de cocina','✓ Martes · ✓ Miércoles','Agregar con +','Solo esas fechas'],['Modalidad disponible','✓ Curso de cocina activo','Martes y miércoles','Los usuarios pueden elegirla','Activar o desactivar desde la lista']],
    block:[['Elegir el día sin servicio','Viernes','Bloquear','Mediodía y noche','Revisar la fecha'],['Leer y confirmar','Se cancelan las reservas del día','Motivo: sin servicio','Confirmar bloqueo','Acción sobre ambos turnos'],['Día bloqueado','✓ Viernes bloqueado','Reservas anteriores canceladas','Desbloquear no las restaura','No admite nuevas reservas']],
    pdf:[['Seleccionar el día','✓ Miércoles','Mediodía: 12 porciones','Noche: 8 porciones','Total: 20 porciones'],['Descargar la planilla','Descargar PDF del día','Miércoles · ambos turnos','Generando archivo','Preparar PDF'],['Archivo descargado','✓ reservas-del-dia.pdf','Nombre | Turno | Porciones','Total a preparar: 20','✓ Listo para imprimir']],
    login:[['Iniciar sesión','Ingresar con Google','Elegir una cuenta','Usá siempre la misma','Abrir acceso'],['Cuenta seleccionada','ana@ejemplo.com','Continuar con Google','Volver al comedor','Ejemplo de ingreso'],['Sesión iniciada','✓ Hola, Ana','Mi perfil','Completá tus datos','Ya podés preparar tu reserva']],
    deadline:[['Antes del cierre','09:59 · Argentina','Crear o editar reserva','Guardar cambios','Dentro del plazo'],['Llega el cierre','10:00 · Argentina','Plazo cerrado para hoy','Mediodía y noche','Ya no admite cambios'],['Reservar otro día','Hoy: plazo cerrado','Mañana: día habilitado','Elegir otro día','Revisá siempre la fecha']],
    cancel:[['Contactar al comedor','Avisar por WhatsApp','Indicar día y turno','Solicitar la baja','Contactá al privado del comedor'],['El comedor gestiona la baja','Buscar la reserva','Dar de baja','Confirmar','Gestión administrativa'],['Baja registrada','✓ Reserva cancelada','Ya no suma porciones','Consultar Mis reservas','Baja gestionada por el comedor']],
    users:[['Abrir usuarios registrados','Usuarios registrados','Ana Pérez','Alumno regular','Consultar perfiles'],['Revisar preferencias','Ana Pérez','Preferencias: Sin TACC','Condición habitual','Datos del perfil']]
  };
  if(!kind){box.innerHTML='';return;}
  const scenes=examples[kind]||examples.days;let stage=0,paused=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  box.innerHTML='<div class="demo-label">Demostración · datos ficticios</div><div class="demo-screen" aria-hidden="true"></div><div class="demo-playback"><span class="demo-counter"></span><button type="button" class="demo-pause"></button><button type="button" class="demo-advance">Ver siguiente</button></div>';
  const paint=()=>{
    const s=scenes[stage],screen=box.querySelector('.demo-screen');screen.replaceChildren();
    s.forEach((line,i)=>{const el=document.createElement(i===0?'strong':'div');el.className=i===0?'demo-scene-title':i===4?'demo-scene-total':'demo-scene-row';el.textContent=line;screen.append(el);});
    box.querySelector('.demo-counter').textContent='Ejemplo '+(stage+1)+' / '+scenes.length;
    box.querySelector('.demo-pause').textContent=paused?'Reproducir':'Pausar';
    if(dialog.open)position();
  };
  const advance=()=>{stage=(stage+1)%scenes.length;paint();};
  const schedule=()=>{clearInterval(demoTimer);if(!paused)demoTimer=setInterval(advance,2600);};
  box.querySelector('.demo-pause').onclick=()=>{paused=!paused;paint();schedule();};
  box.querySelector('.demo-advance').onclick=()=>{paused=true;clearInterval(demoTimer);advance();};
  paint();schedule();
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
  target=null;clearInterval(demoTimer);cancelAnimationFrame(frame);
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
  steps.forEach(s=>{if(s.selector==='#login-button')s.demo='login';if(s.selector==='.menu-card')s.demo='menu';if(s.selector==='.deadline')s.demo='deadline';if(s.selector==='.help-card')s.demo='cancel';if(s.selector==='#profile-panel')s.demo='profile';if(s.selector==='#day-list')s.demo=s.title.includes('turnos')?'portions':'days';if(s.selector==='#save-button')s.demo='save';});
  if(wasAdmin)steps=[
    {selector:'#activate-week',title:'1. Habilitá esta semana',text:'Antes de recibir reservas, tocá Habilitar esta semana. Se crean los días disponibles y se conservan los bloqueos que ya existían.',demo:'activate'},
    {selector:'#menu-upload',title:'2. Publicá el menú',text:'Seleccioná una imagen JPG, PNG o WebP de hasta 500 KB. Esperá la confirmación de publicación. Los usuarios verán el menú de esta semana.',demo:'menu'},
    {selector:'#condition-form',title:'3. Configurá modalidades',text:'Escribí el nombre de la modalidad, elegí las fechas en que corresponde y tocá +. Por ejemplo, un curso que dura martes y miércoles. Podés activar o desactivar modalidades desde la lista.',demo:'modalities'},
    {selector:'#admin-days',title:'4. Consultá un día',text:'Tocá lunes, martes, miércoles, jueves o viernes. Debajo aparecen sus reservas de mediodía y noche. Los datos se actualizan cuando los usuarios guardan cambios.',demo:'days'},
    {selector:'#admin-results',title:'5. Revisá porciones y bajas',text:'Cada persona puede pedir hasta 2 porciones por día. Revisá cantidades y restricciones de cada turno. Si alguien solicita una baja por WhatsApp, buscá su registro, tocá Dar de baja y confirmá.',demo:'portions'},
    {selector:'#download-day-pdf',title:'6. Descargá la planilla',text:'Descargar PDF del día incluye ambos turnos, subtotales y el total de porciones. Las cancelaciones no suman. Volvé a descargarlo si hubo cambios.',demo:'pdf'},
    {selector:'#block-controls',title:'7. Gestioná días sin servicio',text:'Bloquear un día cancela las reservas de ambos turnos e impide nuevas reservas. Desbloquear no restaura las anteriores. La persona deberá reservar nuevamente antes de las 10:00.',demo:'block'},
    {selector:'#users-list',title:'8. Consultá los perfiles',text:'Acá podés ver los usuarios registrados y sus preferencias. Podés volver a iniciar este recorrido con Tutorial mientras estés en el panel del comedor.',demo:'users'}
  ];
  index=0;dialog.showModal();show();$('#tutorial-next').focus();
});
$('#tutorial-exit').addEventListener('click',finish);
$('#tutorial-next').addEventListener('click',()=>{if(index===steps.length-1)finish();else{index++;show();}});
$('#tutorial-back').addEventListener('click',()=>{if(index>0){index--;show();$('#tutorial-next').focus();}});
window.addEventListener('resize',position);
window.addEventListener('scroll',position,{passive:true});
