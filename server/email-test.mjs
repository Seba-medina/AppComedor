import {validCronAuth} from './cron-auth.mjs';
import {adminDb} from './firebase-admin.mjs';
import {gmailConfigured,GMAIL_SENDER} from './gmail.mjs';
import {deliver} from './email-job.mjs';
import {ADMIN_EMAIL,argentinaToday} from '../domain.mjs';
export async function emailTest(req,res,{getDb=adminDb,send=deliver,now=()=>new Date()}={}){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!validCronAuth(req.headers.authorization))return res.status(401).json({error:'Unauthorized'});
 if(process.env.EMAIL_TRANSPORT!=='gmail'||!gmailConfigured())return res.status(503).json({error:'Gmail not configured'});
 try{
  const sent=await send(getDb(),'gmail_test_'+argentinaToday(now()),{from:'Comedor UNER <'+GMAIL_SENDER+'>',to:[ADMIN_EMAIL],subject:'Prueba de correo · Comedor UNER',text:'Este es un correo de prueba de la aplicación del comedor. La conexión con Gmail funciona. Esta prueba no activa los recordatorios ni las planillas automáticas.'});
  return res.status(200).json({ok:true,sent,alreadyProcessed:!sent,enabled:process.env.EMAIL_JOBS_ENABLED==='true'});
 }catch{return res.status(500).json({error:'Test delivery failed; check delivery record before retrying'});}
}
