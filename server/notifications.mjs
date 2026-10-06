import {createHmac,timingSafeEqual} from 'node:crypto';
import {ADMIN_EMAILS,argentinaToday,reservationStatus} from '../domain.mjs';
export const APP_URL='https://appomedoruner.vercel.app';
export function localSchedule(kind,now=new Date()){
 const today=argentinaToday(now),weekday=new Date(today+'T00:00:00Z').getUTCDay();
 const mins=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').reduce((a,n,i)=>a+Number(n)*(i?1:60),0));
 const date=kind==='reminders'?new Date(new Date(today+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10):today;
 return {date,allowed:kind==='reminders'?weekday<=4&&mins>=540&&mins<600:kind==='report'&&weekday>=1&&weekday<=5&&mins>=605};
}
export function wantsReminder(profile,records,day){
 if(!day||day.blocked||profile.reminderEmails===false||ADMIN_EMAILS.includes(profile.email))return false;
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
export function reminderMail(uid,profile,date,secret){
 const unsubscribe=APP_URL+'/api/unsubscribe?token='+encodeURIComponent(reminderToken(uid,secret));
 return {to:[profile.email],headers:{'List-Unsubscribe':'<'+unsubscribe+'>'},subject:'Recordatorio: reservá tu comida de mañana',text:`Hola ${profile.name}. Todavía no tenés una reserva para mañana (${date}). Si vas al comedor, reservá antes de las 10:00 de mañana: ${APP_URL}\nSi no vas, podés ignorar este correo.\nDesactivar recordatorios: ${unsubscribe}`,html:`<p>Hola ${htmlEscape(profile.name)}.</p><p>Todavía no tenés una reserva para mañana (${date}). Si vas al comedor, reservá antes de las <strong>10:00 de mañana</strong>.</p><p><a href="${APP_URL}">Ir al comedor y reservar</a></p><p>Si no vas, podés ignorar este correo.</p><p><a href="${unsubscribe}">Desactivar recordatorios</a>. También podés cambiarlos desde Mi perfil.</p>`};
}
export function reportRows(records,day){return records.filter(r=>reservationStatus(r,day)==='Confirmada').sort((a,b)=>a.name.localeCompare(b.name,'es')).map(r=>[r.name,r.condition,r.portions,r.diet,r.modalityName||'Habitual']);}
