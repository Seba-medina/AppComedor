import {createHash} from 'node:crypto';
import {checkAppRequest,limitStudentRequests} from './request-security.mjs';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb,adminAuth} from './firebase-admin.mjs';
import {argentinaToday,monday,weekDays,deadline,reservationId,reservationStatus,SHIFTS} from '../domain.mjs';
import {APP_URL,welcomeMail} from './notifications.mjs';
import {deliver} from './email-job.mjs';
import {GMAIL_SENDER,gmailConfigured} from './gmail.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const failure=(status,message)=>Object.assign(new Error(message),{status});
export async function studentIdentity(req,verify=token=>adminAuth().verifyIdToken(token)){
 const origin=req.headers?.origin;
 if(origin&&origin!==APP_URL)throw failure(403,'Abrí esta función desde la página del comedor.');
 const authorization=req.headers?.authorization;
 if(typeof authorization!=='string'||authorization.length>10000||!authorization.startsWith('Bearer '))throw failure(401,'Iniciá sesión para continuar.');
 let identity;
 try{identity=await verify(authorization.slice(7));}catch{throw failure(401,'Volvé a iniciar sesión para continuar.');}
 if(typeof identity?.uid!=='string'||!identity.uid||identity.uid.includes('/')||identity.uid.length>128||identity.email_verified!==true||identity.firebase?.sign_in_provider!=='google.com'||typeof identity.email!=='string'||identity.email.length>320)throw failure(403,'Usá una cuenta de Google verificada.');
 return identity;
}
function parseBody(req,keys){
 let body=req.body;
 if(typeof body==='string'){if(body.length>1000)throw failure(400,'Solicitud inválida.');try{body=JSON.parse(body);}catch{throw failure(400,'Solicitud inválida.');}}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k)))throw failure(400,'Solicitud inválida.');
 return body;
}
function respondError(res,error){if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));return res.status(error.status||503).json({error:error.status?error.message:'No pudimos completar la operación. Intentá nuevamente.'});}
function currentChoices(data,week){return data?.week===week&&Array.isArray(data.notGoingDates)?data.notGoingDates.filter(d=>weekDays(week).includes(d)):[];}

export async function dayResponse(req,res,{getDb=adminDb,verify,now=()=>new Date()}={}){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
 try{
  const identity=await studentIdentity(req,verify);await checkAppRequest(req);
  const db=getDb(),week=monday(now()),ref=db.collection('dayResponses').doc(identity.uid);
  await limitStudentRequests(db,identity.uid,req.method==='GET'?'choicesRead':'choicesWrite',now());
  if(req.method==='GET'){
   const [profile,deleting,state]=await Promise.all([db.collection('users').doc(identity.uid).get(),db.collection('accountDeletionLocks').doc(identity.uid).get(),ref.get()]);
   if(!profile.exists||deleting.exists||profile.data().email!==identity.email)throw failure(403,'Completá tu perfil para continuar.');
   return res.status(200).json({week,notGoingDates:currentChoices(state.data(),week)});
  }
  const body=parseBody(req,['date','choice','confirmCancel']);
  if(!weekDays(week).includes(body.date)||!['notGoing','clear'].includes(body.choice)||('confirmCancel' in body&&typeof body.confirmCancel!=='boolean'))throw failure(400,'Elegí un día de esta semana.');
  const result=await db.runTransaction(async tx=>{
   const [profile,deleting,state,day]=await Promise.all([tx.get(db.collection('users').doc(identity.uid)),tx.get(db.collection('accountDeletionLocks').doc(identity.uid)),tx.get(ref),tx.get(db.collection('days').doc(body.date))]);
   if(!profile.exists||deleting.exists||profile.data().email!==identity.email)throw failure(403,'Completá tu perfil para continuar.');
   if(now().getTime()>=deadline(body.date))throw failure(409,'El plazo de este día cerró a las 10:00.');
   if(!day.exists||day.data().blocked)throw failure(409,'Este día no está habilitado para reservas.');
   const slots=await Promise.all(SHIFTS.map(shift=>tx.get(db.collection('reservations').doc(reservationId(identity.uid,body.date,shift,day.data().generation)))));
   const active=slots.filter(s=>s.exists&&s.data().uid===identity.uid&&reservationStatus(s.data(),day.data())==='Confirmada');
   if(body.choice==='notGoing'&&active.length&&!body.confirmCancel)throw failure(409,'Ya reservaste este día. Confirmá la cancelación de ambos turnos para marcar que no vas.');
   const choices=new Set(currentChoices(state.data(),week));
   if(body.choice==='notGoing')choices.add(body.date);else choices.delete(body.date);
   if(body.choice==='notGoing')for(const slot of active)tx.update(slot.ref,{cancelled:true,updatedAt:FieldValue.serverTimestamp()});
   const notGoingDates=[...choices].sort();
   tx.set(ref,{week,notGoingDates,updatedAt:FieldValue.serverTimestamp()});
   return {week,notGoingDates,cancelled:body.choice==='notGoing'?active.length:0};
  });
  return res.status(200).json(result);
 }catch(error){return respondError(res,error);}
}

export async function welcomeEmail(req,res,{getDb=adminDb,verify,send=deliver,now=()=>new Date()}={}){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 try{
  const identity=await studentIdentity(req,verify);await checkAppRequest(req);parseBody(req,[]);
  const transport=process.env.EMAIL_TRANSPORT||'resend';
  if(transport==='gmail'?!gmailConfigured():transport!=='resend'||!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw failure(503,'El correo de bienvenida no está disponible. Intentá más tarde.');
  const db=getDb();await limitStudentRequests(db,identity.uid,'welcome',now());
  const key='welcome_v1_'+hash(identity.uid),delivery=db.collection('emailDeliveries').doc(hash(key));
  const [profile,deleting,previous]=await Promise.all([db.collection('users').doc(identity.uid).get(),db.collection('accountDeletionLocks').doc(identity.uid).get(),delivery.get()]);
  if(!profile.exists||deleting.exists||profile.data().email!==identity.email)throw failure(403,'Guardá tu perfil antes de solicitar la bienvenida.');
  if(['sent','sending','uncertain'].includes(previous.data()?.state))return res.status(200).json({state:previous.data().state,alreadyProcessed:true});
  // Bound total welcome traffic even if many verified accounts register at once.
  const date=argentinaToday(now()),rate=db.collection('emailRateLimits').doc('welcome_'+date),registration=db.collection('emailWelcomeRequests').doc(hash(identity.uid));
  await db.runTransaction(async tx=>{
   const [state,registered]=await Promise.all([tx.get(rate),tx.get(registration)]),count=state.data()?.count||0;
   if(registered.exists)return;
   if(count>=200)throw failure(429,'Hay muchos registros ahora. Podés reintentar el correo de bienvenida mañana.');
   tx.set(rate,{count:count+1,updatedAt:FieldValue.serverTimestamp()});
   tx.create(registration,{createdAt:FieldValue.serverTimestamp()});
  });
  const from=transport==='gmail'?'Comedor UNER <'+GMAIL_SENDER+'>':process.env.EMAIL_FROM;
  const sent=await send(db,key,{from,...welcomeMail({...profile.data(),email:identity.email})});
  const state=(await delivery.get()).data()?.state||(sent?'sent':'sending');
  return res.status(200).json({state,alreadyProcessed:!sent});
 }catch(error){return respondError(res,error);}
}
