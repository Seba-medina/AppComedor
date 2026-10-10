import {createHash} from 'node:crypto';
import {getAppCheck} from 'firebase-admin/app-check';
import {adminDb} from './firebase-admin.mjs';
const denied=(status,message,extra={})=>Object.assign(new Error(message),{status,...extra});
const APP_ID='1:258857082564:web:077fd0da43f87dbdecf391';
export async function checkAppRequest(req,verify=token=>{adminDb();return getAppCheck().verifyToken(token);}){
 if(process.env.APP_CHECK_ENFORCED!=='true')return;
 const token=req.headers?.['x-firebase-appcheck'];
 if(typeof token!=='string'||!token||token.length>10000)throw denied(403,'Actualizá la página del comedor para continuar.');
 let result;try{result=await verify(token);}catch{throw denied(403,'No pudimos validar el acceso. Actualizá la página e intentá nuevamente.');}
 if(result.appId!==APP_ID)throw denied(403,'Usá la página del comedor para continuar.');
}
// A shared transaction survives serverless restarts and concurrent instances.
// Stable documents bound storage to one record per UID/operation, without storing IPs or emails.
export async function limitStudentRequests(db,uid,operation,now=new Date()){
 const policy={choicesRead:[90,300],choicesWrite:[30,300],welcome:[5,600]}[operation];
 if(!policy)throw new Error('Unknown request policy');
 const [limit,seconds]=policy,time=now.getTime();
 const id=createHash('sha256').update(uid+'\0'+operation).digest('hex'),ref=db.collection('requestLimits').doc(id);
 await db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref),previous=snapshot.data(),expires=previous?.expiresAt?.toMillis?.()??previous?.expiresAt?.getTime?.()??0;
  const active=expires>time,count=active?previous.count:0;
  if(active&&count>=limit)throw denied(429,'Demasiados intentos. Esperá unos minutos y volvé a probar.',{retryAfter:Math.max(1,Math.ceil((expires-time)/1000))});
  tx.set(ref,{count:count+1,expiresAt:new Date(active?expires:time+seconds*1000)});
 });
}
