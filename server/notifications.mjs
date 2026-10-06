import {createHmac,timingSafeEqual} from 'node:crypto';
import {ADMIN_EMAILS,argentinaToday,reservationStatus} from '../domain.mjs';
export const APP_URL='https://appomedoruner.vercel.app';
export function localSchedule(kind,now=new Date()){
 const today=argentinaToday(now),weekday=new Date(today+'T00:00:00Z').getUTCDay();
 const mins=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').reduce((a,n,i)=>a+Number(n)*(i?1:60),0));
 const date=today;
 return {date,allowed:kind==='reminders'?weekday>=1&&weekday<=5&&mins>=540&&mins<600:kind==='report'&&weekday>=1&&weekday<=5&&mins>=605};
}
export const ADMIN_REMINDER_TEST_DATE='2026-10-06';
export const adminReminderTrial=(profile,date)=>date===ADMIN_REMINDER_TEST_DATE&&ADMIN_EMAILS.includes(profile.email);
export function wantsReminder(profile,records,day,date=null,response=null){
 if(!day||day.blocked||profile.reminderEmails===false||response?.notGoingDates?.includes(date))return false;
 if(ADMIN_EMAILS.includes(profile.email))return adminReminderTrial(profile,date);
 return !records.some(r=>r.generation===day.generation&&(r.cancelled===true||reservationStatus(r,day)==='Confirmada'));
}
export function reminderToken(uid,secret){return Buffer.from(uid).toString('base64url')+'.'+createHmac('sha256',secret).update('unsubscribe:'+uid).digest('base64url');}
export function tokenUid(token,secret){
 if(typeof token!=='string'||token.length>1000)return null;
 const parts=token.split('.');if(parts.length!==2)return null;
 const uid=Buffer.from(parts[0],'base64url').toString();if(!uid||uid.includes('/')||uid.length>128)return null;
 const expected=reminderToken(uid,secret),a=Buffer.from(token),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b)?uid:null;
}
export const htmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function welcomeMail(profile){
 const text=`Hola ${profile.name}.

¡Bienvenido/a al Comedor UNER! Tu perfil ya está guardado.

Consultá el menú, elegí los días y horarios de retiro y confirmá tus reservas antes de las 10:00 (hora de Argentina). Podés pedir hasta 2 porciones por día, entre mediodía y noche.

Si un día no vas, marcá No voy este día en la app para evitar el recordatorio de esa fecha. En Mi perfil podés desactivar todos los recordatorios. El botón Tutorial explica cómo usar la página.

Abrir el comedor: ${APP_URL}

Para recibir nuestros avisos, revisá también la carpeta Spam. Si encontrás este correo allí, elegí No es spam y agregá comedorunerfcal@gmail.com a tus contactos. Si aparece en otra pestaña, podés moverlo a Principal. La ubicación de los próximos correos depende de Gmail.

Si necesitás ayuda, contactá al personal del comedor.

Comedor UNER`;
 return {to:[profile.email],subject:'Bienvenido/a al Comedor UNER',text,html:text.split('\n\n').map(p=>'<p>'+htmlEscape(p).replace(/\n/g,'<br>')+'</p>').join('')};
}
export function reminderMail(uid,profile,date,secret){
 const unsubscribe=APP_URL+'/api/unsubscribe?token='+encodeURIComponent(reminderToken(uid,secret));
 return {to:[profile.email],headers:{'List-Unsubscribe':'<'+unsubscribe+'>'},subject:'Recordatorio de reserva · Comedor UNER',text:`Hola ${profile.name}. Todavía no registraste tu reserva para hoy (${date}). Si vas al comedor, reservá antes de las 10:00 (hora de Argentina): ${APP_URL}\nSi hoy no vas al comedor, podés ignorar este mensaje.\nPodés desactivar estos recordatorios desde Mi perfil o en este enlace: ${unsubscribe}`,html:`<p>Hola ${htmlEscape(profile.name)}.</p><p>Todavía no registraste tu reserva para hoy (${date}). Si vas al comedor, reservá antes de las <strong>10:00 (hora de Argentina)</strong>.</p><p><a href="${APP_URL}">Reservar mi comida</a></p><p>Si hoy no vas al comedor, podés ignorar este mensaje.</p><p><a href="${unsubscribe}">Desactivar recordatorios</a>. También podés desactivarlos desde Mi perfil.</p>`};
}
export function reservationCreatedLabel(value){
 const date=typeof value?.toDate==='function'?value.toDate():value instanceof Date?value:null;
 if(!date||!Number.isFinite(date.getTime()))return 'Sin registro';
 return new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);
}
export function reportRows(records,day){return records.filter(r=>reservationStatus(r,day)==='Confirmada').sort((a,b)=>a.name.localeCompare(b.name,'es')).map(r=>[r.name,r.condition,r.portions,r.diet,r.modalityName||'Habitual',reservationCreatedLabel(r.createdAt)]);}

export function reportMail(email,date,content){
 const text=`Hola.

Adjuntamos la planilla de reservas del comedor para el ${date}.

Incluye las hojas Mediodía, Noche y Resumen, con las porciones, las preferencias alimentarias y la fecha y hora de cada reserva.

Podés abrir y editar el archivo en Excel o Google Sheets, y completar la columna Asistió para registrar la asistencia.

La planilla refleja las reservas al momento de generarla. Las modificaciones en el archivo no se guardan en la app; consultá el panel por cambios posteriores.

Comedor UNER`;
 return {to:[email],subject:'Reservas del comedor · '+date,text,html:text.split('\n\n').map(p=>'<p>'+htmlEscape(p).replace(/\n/g,'<br>')+'</p>').join(''),attachments:[{filename:'reservas-'+date+'.xlsx',content}]};
}
