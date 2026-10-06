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
    menuView:[['Consultá el menú','Menú de la semana','Tocá la imagen para ampliarla','','Vista normal'],['Ampliá la imagen','Menú de la semana','Ahora podés leerlo completo','','Vista ampliada'],['Volvé a la vista normal','Menú de la semana','Tocá otra vez la imagen','','Vista normal']],
    adminDays:[['Elegí un día','Lunes · Martes · Miércoles · Jueves · Viernes','Tocá el botón del día','','Consultar reservas'],['Revisá ambos turnos','Mediodía: reservas del día','Noche: reservas del día','','Detalle del día seleccionado']],
    adminReview:[['Consultá las reservas','Nombre · Condición · Porciones','Restricciones alimentarias','Modalidades aplicadas','Detalle por turno'],['Gestioná una baja solicitada','Buscá la persona y el turno','Dar de baja','Confirmá solo si corresponde','La baja deja de sumar porciones']],
    portions:[['Elegir el día','✓ Jueves','Mediodía: sin elegir','Noche: sin elegir','0 porciones'],['Seleccionar mediodía','✓ Jueves','✓ Mediodía: 1 porción','Noche: sin elegir','Total: 1 porción'],['Agregar noche','✓ Jueves','✓ Mediodía: 1 porción','✓ Noche: 1 porción','Total: 2 porciones'],['Otra opción: todo al mediodía','✓ Jueves','✓ Mediodía: 2 porciones','Noche: sin retiro','Total: 2 porciones'],['O todo a la noche','✓ Jueves','Mediodía: sin retiro','✓ Noche: 2 porciones','Total: 2 porciones']],
    days:[['Elegir una fecha','Lunes','Martes','Miércoles','Seleccioná un día'],['Marcar martes','Lunes','✓ Martes','Miércoles','Martes seleccionado'],['Consultar sus horarios','Martes seleccionado','Mediodía','Noche','Los detalles aparecen debajo']],
    profile:[['Abrir Mi perfil','Mi perfil','Nombre: sin completar','Preferencias: sin completar','Abrir formulario'],['Completar los datos','Nombre: Ana Pérez','Condición: Alumno regular','Preferencias: Sin TACC','Datos de ejemplo'],['Guardar el perfil','Ana Pérez','Alumno regular · Sin TACC','Guardar perfil','✓ Perfil guardado']],
    save:[['Revisar antes de guardar','Jueves','Mediodía: 1 · Noche: 1','Total: 2 porciones','Datos listos'],['Guardar la reserva','Guardar reserva semanal','Procesando…','Esperá la confirmación','Guardando'],['Comprobar el resultado','✓ Reservas confirmadas','Mis reservas','Jueves · Mediodía y noche','✓ Reserva guardada']],
    activate:[['Abrir el panel','Semana seleccionada','Días sin habilitar','Habilitar semana seleccionada','Preparar la semana'],['Habilitar los días','Habilitar semana seleccionada','Procesando…','Se conservan los bloqueos','Guardando'],['Ver la confirmación','✓ Semana habilitada','Lunes a viernes disponibles','Publicá el menú','Lista para recibir reservas']],
    menu:[['Seleccionar una imagen','Cargar menú semanal','Elegir archivo','JPG, PNG o WebP · hasta 500 KB','Seleccionar imagen'],['Cargar el menú','menu-semanal.jpg','Publicando…','Menú de la semana seleccionada','Esperar confirmación'],['Menú publicado','✓ Imagen publicada','Visible al consultar esa semana','Tocar imagen para ampliar','✓ Menú listo']],
    modalities:[['Escribir la modalidad','Curso de cocina','Elegir fechas','Martes · Miércoles','Nombre del ejemplo'],['Marcar las fechas','Curso de cocina','✓ Martes · ✓ Miércoles','Agregar con +','Solo esas fechas'],['Modalidad disponible','✓ Curso de cocina activo','Martes y miércoles','Los usuarios pueden elegirla','Podés activar, desactivar o eliminar desde la lista']],
    block:[['Elegir el día sin servicio','Viernes','Bloquear','Mediodía y noche','Revisar la fecha'],['Leer y confirmar','Se cancelan las reservas del día','Motivo: sin servicio','Confirmar bloqueo','Acción sobre ambos turnos'],['Día bloqueado','✓ Viernes bloqueado','Reservas anteriores canceladas','Desbloquear no las restaura','No admite nuevas reservas']],
    pdf:[['Seleccionar el día','✓ Miércoles','Mediodía: 12 porciones','Noche: 8 porciones','Total: 20 porciones'],['Descargar la planilla','Descargar PDF del día','Miércoles · ambos turnos','Generando archivo','Preparar PDF'],['Archivo descargado','✓ reservas-del-dia.pdf','Nombre | Turno | Porciones','Total a preparar: 20','✓ Listo para imprimir']],
    login:[['Iniciar sesión','Ingresar con Google','Elegir una cuenta','Usá siempre la misma','Abrir acceso'],['Cuenta seleccionada','ana@ejemplo.com','Continuar con Google','Volver al comedor','Ejemplo de ingreso'],['Sesión iniciada','✓ Hola, Ana','Mi perfil','Completá tus datos','Ya podés preparar tu reserva']],
    deadline:[['Antes del cierre','09:59 · Argentina','Crear o editar reserva','Guardar cambios','Dentro del plazo'],['Llega el cierre','10:00 · Argentina','Plazo cerrado para hoy','Mediodía y noche','Ya no admite cambios'],['Reservar otro día','Hoy: plazo cerrado','Mañana: día habilitado','Elegir otro día','Revisá siempre la fecha']],
    cancel:[['Antes de las 10:00','Mis reservas · Jueves · Mediodía','Cancelar reserva','Revisá el día y el turno','Baja de ese turno'],['Confirmar la cancelación','¿Cancelar las porciones de este turno?','Confirmar','El otro turno se conserva','Para recuperar este turno, contactá al comedor'],['Después de las 10:00','El botón de cancelar ya no está disponible','Avisá por WhatsApp al privado del comedor','El personal gestiona la baja','La reserva cancelada deja de sumar porciones']],
    habitual:[['Configurar por día','Lunes: 2 al mediodía','Martes: 1 a la noche','Miércoles: no voy','Guardá la configuración'],['Usar mi semana','Se preparan los días disponibles','Se omiten bloqueados y fuera de plazo','Revisá turnos y porciones','Todavía no hay reservas nuevas'],['Confirmar las reservas','Guardar reserva semanal','Esperá la confirmación','Comprobá Mis reservas','La configuración no reserva automáticamente']],
    reminders:[['Abrir Mi perfil','Recibir recordatorios por correo','✓ Activado','Guardar perfil','Lunes a viernes desde las 9:00'],['Desactivar los avisos','Recibir recordatorios por correo','☐ Desactivado','Guardar perfil','También podés darte de baja desde el correo']],
    edit:[['Abrir el día reservado','Ver detalles','Revisá tus turnos y porciones','Antes de las 10:00 del día reservado','Una reserva por turno'],['Guardar la edición','Guardar cambios de mi reserva','Esperá la confirmación','La reserva existente se actualiza','No se crea un duplicado'],['Minimizar el día','Minimizar','Se ocultan los detalles','Ver detalles los vuelve a mostrar','La reserva sigue confirmada']],
    attendance:[['Elegir el día del servicio','Ana Pérez · Mediodía','☐ Asistió este día','Esperá a que retire la comida','No se marca una fecha futura'],['Marcar asistencia','Ana Pérez · Mediodía','✓ Asistió este día','Ana Pérez · Noche: también marcada','Suma un día aunque venga a ambos turnos'],['Corregir una marca','Destildá Asistió este día','Se quita la asistencia del día','La reserva se conserva','Sin marca no significa ausencia confirmada']],
    backup:[['Antes de eliminar datos','Descargar respaldo','Todas las semanas','Perfiles, reservas y asistencias','Copia en formato JSON'],['Guardar el archivo','Copia descargada','Contiene datos personales','Guardalo en un lugar privado','No incluye las cuentas de Google']],
    monthly:[['Elegir el mes','Resumen mensual','Seleccionar mes','Generar resumen','Consultar reservas y asistencia'],['Leer el resultado','Reservas · Porciones · Días asistidos','Una persona cuenta una vez por día','Descargar para Excel','Archivo CSV editable']],
    audit:[['Consultar el historial','Historial administrativo','Últimas 100 acciones del panel','Quién realizó la acción y cuándo','Control de la gestión']],
    adminWeek:[['Elegir la semana','Semana a consultar','Anterior / Siguiente','O seleccioná una fecha','Administración de otras semanas'],['Preparar o consultar','Habilitar semana seleccionada','Menú y modalidades de esa semana','Reservas por día de esa semana','Revisá la fecha antes de actuar'],['Volver al presente','Volver a esta semana','Semana actual','Datos del período seleccionado','El alumno siempre ve la semana actual']],
    adminEmail:[['Consultar el correo del comedor','Reservas del día','Archivo Excel adjunto','Mediodía · Noche · Resumen','Incluye fecha y hora de reserva'],['Editar la planilla','Abrir con Excel o Google Sheets','Completar Asistió','Guardar los cambios en la planilla','Editar el Excel no actualiza la app']],
    deleteUsers:[['Buscar un usuario','Filtrar por nombre, correo o condición','Revisar el perfil','Descargar respaldo primero','Los administradores están protegidos'],['Eliminar los datos del comedor','Eliminar cuenta → Confirmar','Borra perfil, reservas, asistencia y actividad','No borra la cuenta de Google','Puede volver a registrarse'],['Eliminar todos los usuarios','Revisá y confirmá la operación','Se conservan los administradores','Los datos eliminados no se recuperan desde el panel','Usá esta acción solo si corresponde']],
    users:[['Abrir usuarios registrados','Buscá por nombre o correo','Filtrá por condición y tipo de cuenta','Ana Pérez · Alumno regular','Datos ficticios'],['Consultar actividad','Última conexión: al abrir la app con sesión','Días asistidos: 3','Preferencias: Sin TACC','La asistencia se marca en el listado diario']]
  };
  if(!kind){box.innerHTML='';return;}
  const scenes=examples[kind]||examples.days;let stage=0,paused=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  box.innerHTML='<div class="demo-label">Demostración · datos ficticios</div><div class="demo-screen" aria-hidden="true"></div><div class="demo-playback"><span class="demo-counter"></span><button type="button" class="demo-pause"></button><button type="button" class="demo-advance">Ver siguiente</button></div>';
  const paint=()=>{
    const s=scenes[stage],screen=box.querySelector('.demo-screen');screen.replaceChildren();
    if(kind==='days'||kind==='portions')renderReservationDemo(screen,kind,stage);
    else if(kind==='menuView')renderMenuDemo(screen,stage);
    else if(kind==='habitual')renderHabitualDemo(screen,stage);
    else if(kind==='attendance'||kind==='reminders')renderCheckDemo(screen,kind,stage);
    else s.forEach((line,i)=>{const el=document.createElement(i===0?'strong':'div');el.className=i===0?'demo-scene-title':i===4?'demo-scene-total':'demo-scene-row';el.textContent=line;screen.append(el);});
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

function renderReservationDemo(screen,kind,stage){
  const picked=stage>0;
  const expanded=kind==='portions'?picked:stage===2;
  const midday=kind==='portions'?([0,1,1,2,0][stage]||0):0;
  const night=kind==='portions'?([0,0,1,0,2][stage]||0):0;
  const header=document.createElement('div');header.className='tutorial-mini-header';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=picked;checkbox.disabled=true;
  const title=document.createElement('strong');title.textContent='Jueves · día de ejemplo';header.append(checkbox,title);screen.append(header);
  if(expanded){
    const hint=document.createElement('p');hint.className='tutorial-mini-hint';hint.textContent='Elegí los horarios · Máximo 2 porciones por día';screen.append(hint);
    for(const [name,amount]of [['Mediodía',midday],['Noche',night]]){
      const row=document.createElement('div');row.className='tutorial-mini-turn';
      const label=document.createElement('div');label.className='tutorial-mini-check';
      const check=document.createElement('input');check.type='checkbox';check.checked=amount>0;check.disabled=true;
      const text=document.createElement('strong');text.textContent=name;label.append(check,text);row.append(label);
      if(amount){
        const fields=document.createElement('div');fields.className='tutorial-mini-fields';
        const portions=document.createElement('label');portions.textContent='Porciones';
        const select=document.createElement('select');select.disabled=true;
        for(const n of [1,2]){const option=document.createElement('option');option.textContent=String(n);option.selected=n===amount;select.append(option);}portions.append(select);
        const diet=document.createElement('label');diet.textContent='Restricciones';const input=document.createElement('input');input.disabled=true;input.value='Sin restricciones';diet.append(input);
        const modality=document.createElement('label');modality.textContent='Modalidad especial';const choice=document.createElement('select');choice.disabled=true;const opt=document.createElement('option');opt.textContent='Condición habitual';choice.append(opt);modality.append(choice);
        fields.append(portions,diet,modality);row.append(fields);
      }
      screen.append(row);
    }
  }
  const total=document.createElement('div');total.className='demo-scene-total';total.textContent=kind==='days'?(expanded?'Horarios desplegados: elegí mediodía, noche o ambos':picked?'Día marcado: se abren sus horarios':'Primero marcá el día'):'Total del día: '+(midday+night)+' porciones';screen.append(total);
}
function renderHabitualDemo(screen,stage){
  const title=document.createElement('strong');title.className='demo-scene-title';
  title.textContent=['Configurá cada día','Aplicá y revisá','Confirmá tus reservas'][stage];screen.append(title);
  for(const [day,midday,night] of [['Lunes',2,0],['Martes',0,1],['Miércoles',0,0]]){
    const row=document.createElement('div');row.className='tutorial-mini-turn';
    const header=document.createElement('div');header.className='tutorial-mini-check';
    const check=document.createElement('input');check.type='checkbox';check.checked=midday+night>0;check.disabled=true;
    const name=document.createElement('strong');name.textContent=day;header.append(check,name);row.append(header);
    const fields=document.createElement('div');fields.className='tutorial-mini-fields tutorial-week-fields';
    for(const [shift,amount] of [['Mediodía',midday],['Noche',night]]){
      const label=document.createElement('label');label.textContent=shift;
      const select=document.createElement('select');select.disabled=true;
      for(const n of [0,1,2]){const option=document.createElement('option');option.textContent=n?n+' '+(n===1?'porción':'porciones'):'No voy';option.selected=n===amount;select.append(option);}
      label.append(select);fields.append(label);
    }
    row.append(fields);screen.append(row);
  }
  const action=document.createElement('div');action.className='demo-scene-total';
  action.textContent=['Guardar configuración','Usar mi semana → revisar (sin confirmar todavía)','Guardar reserva semanal → esperar confirmación'][stage];screen.append(action);
}
function renderCheckDemo(screen,kind,stage){
  const title=document.createElement('strong');title.className='demo-scene-title';
  title.textContent=kind==='attendance'?'Asistencia del día':'Mi perfil · Avisos por correo';screen.append(title);
  const labels=kind==='attendance'?['Ana Pérez · Mediodía','Ana Pérez · Noche']:['Recibir recordatorios por correo'];
  for(const text of labels){
    const row=document.createElement('div');row.className='tutorial-mini-turn';
    const name=document.createElement('strong');name.textContent=text;row.append(name);
    const label=document.createElement('label');label.className='tutorial-mini-check';
    const check=document.createElement('input');check.type='checkbox';check.disabled=true;
    check.checked=kind==='attendance'?stage===1:stage===0;label.append(check,document.createTextNode(kind==='attendance'?'Asistió este día':check.checked?'Activado':'Desactivado'));row.append(label);screen.append(row);
  }
  const total=document.createElement('div');total.className='demo-scene-total';
  total.textContent=kind==='attendance'?(stage===1?'✓ 1 día asistido, aunque venga a ambos turnos':stage===2?'Marca corregida: la reserva se conserva':'Tildá cuando retire la comida'):'Guardar perfil para confirmar la preferencia';screen.append(total);
}
function renderMenuDemo(screen,stage){
  const heading=document.createElement('strong');heading.className='demo-scene-title';heading.textContent=stage===1?'Imagen ampliada':stage===2?'Volviste a la vista normal':'Tocá la imagen del menú';screen.append(heading);
  const frame=document.createElement('div');frame.className='tutorial-menu-example'+(stage===1?' is-expanded':'');
  const published=$('.menu-card img');
  if(published&&!published.hidden&&published.getAttribute('src')){const img=document.createElement('img');img.src=published.getAttribute('src');img.alt='';frame.append(img);}
  else{const placeholder=document.createElement('div');placeholder.className='tutorial-menu-placeholder';placeholder.textContent='MENÚ DE LA SEMANA';frame.append(placeholder);}
  const action=document.createElement('span');action.className='tutorial-menu-action';action.textContent=stage===1?'− Reducir':'+ Ampliar';frame.append(action);screen.append(frame);
  const caption=document.createElement('p');caption.className='tutorial-mini-hint';caption.textContent=stage===1?'La imagen completa se muestra sin recortes. Tocá otra vez para reducirla.':stage===2?'El menú volvió a su tamaño normal. Podés ampliarlo cuando quieras.':'La imagen se amplía al tocarla.';screen.append(caption);
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
  if(!$('#login-button').hidden)steps.push({selector:'#login-button',title:'Ingresá con Google',text:'Usá siempre la misma cuenta de Google. Al terminar el recorrido, tocá Ingresar con Google. Las demostraciones usan datos ficticios y no guardan reservas.',demo:'login'});
  steps.push(
    {selector:'#profile-panel',title:'1. Completá tu perfil',text:'Abrí Mi perfil, completá nombre, condición habitual y preferencias alimentarias, y guardá. Se usan al preparar tus reservas; podés editarlas cuando quieras. Si no ingresaste, el formulario aparece al iniciar sesión.',demo:'profile'},
    {selector:'.menu-card',title:'2. Consultá el menú',text:'Ves el menú de la semana actual. Tocá la imagen para verla completa y otra vez para reducirla. Si falta, el comedor todavía debe publicarlo.',demo:'menuView'},
    {selector:'#day-list',title:'3. Elegí tus días',text:'Marcá uno o varios días de esta semana. Podés reservar solo un día o varios juntos. Los días bloqueados, sin habilitar o fuera de plazo no admiten reservas.',demo:'days'},
    {selector:'#day-list',title:'4. Turnos y porciones',text:'Elegí mediodía, noche o ambos: son los horarios de retiro. Pedí entre 1 y 2 porciones por día, sumando ambos turnos. Podés pedir 2 en uno o 1 en cada uno. Revisá las restricciones; una modalidad especial solo aparece en sus fechas habilitadas.',demo:'portions'},
    {selector:'.week-template-box',title:'5. Configurá tu semana habitual',text:'En Configurar mi semana elegís turnos y cantidades distintos para cada día. Destildá los días que no vas y guardá la configuración. Después tocá Usar mi semana, revisá y confirmá con Guardar reserva semanal. Configurar o aplicar no reserva automáticamente.',demo:'habitual'},
    {selector:'.deadline',title:'6. Reservá antes de las 10:00',text:'Crear, editar y cancelar está permitido antes de las 10:00 de Argentina del día reservado, tanto para mediodía como para noche. Podés preparar los otros días habilitados antes de su propio cierre.',demo:'deadline'},
    {selector:'#save-button',title:'7. Guardá y comprobá',text:'Tocá Guardar reserva semanal y esperá la confirmación. Comprobá el resultado en Mis reservas. Si hay cambios sin guardar, todavía no se confirmaron.',demo:'save'},
    {selector:'#day-list',title:'8. Editá o minimizá tu día',text:'Una reserva confirmada se edita, sin duplicarla. Abrí Ver detalles, cambiá los datos y tocá Guardar cambios de mi reserva antes del cierre. Minimizar oculta los detalles y conserva la reserva.',demo:'edit'},
    {selector:'.reservation-footer',title:'9. Cancelá desde Mis reservas',text:'Antes de las 10:00 del día reservado, tocá Cancelar reserva y confirmá el día y turno. Cancela solo ese turno. Para recuperar un turno cancelado, contactá al comedor. Después del cierre, pedí la baja por WhatsApp al privado del comedor.',demo:'cancel'},
    {selector:'#profile-panel',title:'10. Elegí si querés recordatorios',text:'En Mi perfil podés activar o desactivar Recibir recordatorios por correo y guardar. Los avisos están previstos de lunes a viernes a partir de las 9:00, cuando todavía no reservaste para ese día. También podés darte de baja desde el enlace del correo.',demo:'reminders'}
  );
  if(wasAdmin)steps=[
    {selector:'.admin-week-toolbar',title:'1. Elegí la semana a gestionar',text:'Consultá semanas anteriores o prepará las próximas con Anterior, Siguiente o el selector de fecha. Volver a esta semana regresa a la actual. Revisá la semana elegida antes de habilitar días, cargar menú o crear modalidades.',demo:'adminWeek'},
    {selector:'#activate-week',title:'2. Habilitá los días',text:'Tocá Habilitar semana seleccionada para crear los días disponibles. Los bloqueos existentes se conservan. Los alumnos solo reservan los días habilitados de la semana que ven.',demo:'activate'},
    {selector:'#menu-upload',title:'3. Publicá el menú',text:'Elegí una imagen JPG, PNG o WebP de hasta 500 KB. Se publica para la semana seleccionada al elegir el archivo. Esperá la confirmación y revisá la vista previa.',demo:'menu'},
    {selector:'#condition-form',title:'4. Modalidades temporales',text:'Escribí el nombre, marcá las fechas en que corresponde y tocá Agregar modalidad. En la lista podés activar, desactivar o eliminar una modalidad. Eliminarla impide nuevas selecciones y conserva las reservas existentes.',demo:'modalities'},
    {selector:'#admin-days',title:'5. Revisá reservas y porciones',text:'Elegí lunes a viernes para ver mediodía y noche, las cantidades y las restricciones. Cada persona tiene hasta 2 porciones por día. Revisá los subtotales por turno y el total del día; las cancelaciones no suman.',demo:'adminDays'},
    {selector:'#admin-results',title:'6. Registrá la asistencia',text:'En el listado del día tildá Asistió este día cuando la persona retire la comida. Cuenta un día aunque venga a ambos turnos. Podés destildar para corregir. No se marca asistencia futura; una casilla sin marcar no confirma una ausencia.',demo:'attendance'},
    {selector:'#admin-results',title:'7. Gestioná una baja',text:'Si alguien pide cancelar después del cierre, buscá su reserva del día y turno, tocá Dar de baja y confirmá. Antes de las 10:00, el alumno también puede cancelar desde Mis reservas.',demo:'adminReview'},
    {selector:'#download-day-pdf',title:'8. Descargá la planilla diaria',text:'El PDF del día está en A4 vertical, con ambos turnos, porciones y espacio para marcar asistencia en papel. Volvé a descargarlo si cambian las reservas. Las marcas en papel no se cargan automáticamente a la app.',demo:'pdf'},
    {selector:'#admin-days',title:'9. Planilla por correo',text:'El envío por correo, cuando está habilitado, adjunta un Excel para los administradores con Mediodía, Noche y Resumen, incluida la fecha y hora de reserva. Podés editarlo en Excel o Google Sheets. Sus cambios no se sincronizan con la app.',demo:'adminEmail'},
    {selector:'#block-controls',title:'10. Bloqueá días sin servicio',text:'Bloquear cancela las reservas de ambos turnos e impide nuevas reservas. Podés indicar el motivo. Desbloquear no restaura las reservas: deben volver a reservar dentro del plazo.',demo:'block'},
    {selector:'#users-list',title:'11. Consultá los usuarios',text:'Buscá por nombre o correo y filtrá por condición o tipo de cuenta. Podés ver preferencias, última conexión al abrir la app con sesión y días de asistencia registrados.',demo:'users'},
    {selector:'#download-backup',title:'12. Guardá un respaldo',text:'Descargar respaldo reúne los datos de todas las semanas en un archivo JSON: perfiles, reservas, asistencias, actividad, preferencias, días, modalidades y menús. Guardalo en un lugar privado al finalizar la jornada y antes de eliminar datos. No incluye las cuentas de acceso de Google.',demo:'backup'},
    {selector:'#delete-all-users',title:'13. Eliminá datos con cuidado',text:'Podés eliminar un usuario desde su fila o todos con Eliminar todos los usuarios. Se borran sus datos del comedor, sin borrar su cuenta de Google; puede registrarse otra vez. Los administradores están protegidos. Descargá un respaldo antes de confirmar: el panel no permite deshacerlo.',demo:'deleteUsers'},
    {selector:'#report-month',title:'14. Consultá el resumen mensual',text:'Elegí un mes y tocá Generar resumen para ver reservas vigentes, porciones y asistencias. Descargar para Excel genera un CSV. Una persona cuenta una sola vez por día asistido.',demo:'monthly'},
    {selector:'#audit-list',title:'15. Revisá el historial',text:'Consultá las últimas 100 acciones realizadas desde el panel. Podés repetir este recorrido desde Tutorial. Las demostraciones no modifican datos reales.',demo:'audit'}
  ];
  index=0;dialog.showModal();show();$('#tutorial-next').focus();
});
$('#tutorial-exit').addEventListener('click',finish);
$('#tutorial-next').addEventListener('click',()=>{if(index===steps.length-1)finish();else{index++;show();}});
$('#tutorial-back').addEventListener('click',()=>{if(index>0){index--;show();$('#tutorial-next').focus();}});
window.addEventListener('resize',position);
window.addEventListener('scroll',position,{passive:true});
