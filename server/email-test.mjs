import {reminderMail} from './notifications.mjs';
import {dailyWorkbook} from './workbook.mjs';
import {validCronAuth} from './cron-auth.mjs';
import {adminDb} from './firebase-admin.mjs';
import {gmailConfigured,GMAIL_SENDER} from './gmail.mjs';
import {deliver} from './email-job.mjs';
import {ADMIN_EMAIL,argentinaToday} from '../domain.mjs';
export async function emailTest(req,res,{getDb=adminDb,send=deliver,now=()=>new Date(),kind='message',tomorrow=false}={}){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!validCronAuth(req.headers.authorization))return res.status(401).json({error:'Unauthorized'});
 if(process.env.EMAIL_TRANSPORT!=='gmail'||!gmailConfigured())return res.status(503).json({error:'Gmail not configured'});
 if(kind==='reminder'&&(process.env.UNSUBSCRIBE_SECRET||'').length<32)return res.status(503).json({error:'Unsubscribe secret not configured'});
 try{
  const db=getDb(),today=argentinaToday(now()),date=kind==='excel'&&tomorrow?new Date(new Date(today+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10):today;
  let payload={from:'Comedor UNER <'+GMAIL_SENDER+'>',to:[ADMIN_EMAIL],subject:'Prueba de correo · Comedor UNER',text:'Este es un correo de prueba de la aplicación del comedor. La conexión con Gmail funciona. Esta prueba no activa los recordatorios ni las planillas automáticas.'};
  if(kind==='excel'){
   const day=(await db.collection('days').doc(date).get()).data();
   if(!day)return res.status(200).json({ok:true,sent:false,skipped:true,reason:'No menu day configured',date});
   const [snapshot,modalities]=await Promise.all([db.collection('reservations').where('dateKey','==',date).get(),db.collection('modalities').get()]);
   const names=new Map(modalities.docs.map(d=>[d.id,d.data().name]));
   const records=snapshot.docs.map(d=>{const r=d.data();return {...r,modalityName:r.modalityId?(names.get(r.modalityId)||'Modalidad eliminada'):'Habitual'};});
   const content=(await dailyWorkbook(date,records,day,now())).toString('base64');
   payload={...payload,subject:'Prueba de Excel · Reservas del '+date,text:'Adjuntamos las reservas del día en un Excel editable, con hojas de Mediodía, Noche y Resumen. Podés completar la columna Asistió en Excel o importar el archivo en Google Sheets. Es una copia: los cambios no se guardan en la app. Esta prueba no activa los envíos automáticos.',attachments:[{filename:'reservas-'+date+'.xlsx',content}]};
  }
  if(kind==='reminder'){
   const users=await db.collection('users').where('email','==',ADMIN_EMAIL).limit(1).get();
   if(users.empty)return res.status(404).json({error:'Admin profile not found'});
   const user=users.docs[0],mail=reminderMail(user.id,{...user.data(),email:ADMIN_EMAIL},date,process.env.UNSUBSCRIBE_SECRET);
   const note='PRUEBA: este es un ejemplo del aviso para alumnos sin reserva. No indica el estado real de tu reserva y no activa los envíos automáticos.';
   payload={...payload,...mail,subject:'Prueba · '+mail.subject,text:note+'\n\n'+mail.text,html:'<p><strong>'+note+'</strong></p>'+mail.html};
  }
  const sent=await send(db,(kind==='excel'?'gmail_excel_test_v2_':kind==='reminder'?'gmail_reminder_test_':'gmail_test_')+date,payload);
  return res.status(200).json({ok:true,sent,alreadyProcessed:!sent,enabled:process.env.EMAIL_JOBS_ENABLED==='true'});
 }catch{return res.status(500).json({error:'Test delivery failed; check delivery record before retrying'});}
}

export function emailTestExcel(req,res,options={}){return emailTest(req,res,{...options,kind:'excel',tomorrow:req.query?.day==='tomorrow'});}

export function emailTestReminder(req,res,options={}){return emailTest(req,res,{...options,kind:'reminder'});}
