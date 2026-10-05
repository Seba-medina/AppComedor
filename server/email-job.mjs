import {createHash,randomUUID} from 'node:crypto';
import {validCronAuth} from './cron-auth.mjs';
import {FieldValue} from 'firebase-admin/firestore';
import {ADMIN_EMAILS} from '../domain.mjs';
import {adminDb} from './firebase-admin.mjs';
import {localSchedule,wantsReminder,reminderMail} from './notifications.mjs';
import {GMAIL_SENDER,gmailConfigured,sendGmail} from './gmail.mjs';
import {dailyWorkbook} from './workbook.mjs';
const id=value=>createHash('sha256').update(value).digest('hex');
async function release(db,ref,owner){await db.runTransaction(async tx=>{const s=await tx.get(ref);if(s.data()?.owner===owner)tx.delete(ref);});}
export async function deliver(db,key,payload,{smtpSend=sendGmail}={}){
 const provider=process.env.EMAIL_TRANSPORT==='gmail'?'gmail':'resend';
 const ref=db.collection('emailDeliveries').doc(id(key));
 // Persist the exact provider payload before sending: retries use identical content.
 const stored=await db.runTransaction(async tx=>{const s=await tx.get(ref);if(s.exists)return s.data();const d={state:'pending',provider,payload,createdAt:FieldValue.serverTimestamp()};tx.create(ref,d);return d;});
 if(['sent','sending','uncertain'].includes(stored.state))return false;
 if((stored.provider||'resend')!==provider)throw new Error('Pending delivery uses a different transport');
 if(provider==='gmail'){
  // SMTP has no provider idempotency key. Claim before network I/O and never
  // retry an ambiguous outcome automatically: acceptance may already have happened.
  const claimed=await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.state!=='pending')return false;tx.update(ref,{state:'sending',attemptAt:FieldValue.serverTimestamp()});return true;});
  if(!claimed)return false;
  try{const result=await smtpSend(stored.payload,key);await ref.update({state:'sent',providerId:result.messageId,sentAt:FieldValue.serverTimestamp()});return true;}
  catch(err){await ref.update({state:err.code==='EAUTH'?'pending':'uncertain',failedAt:FieldValue.serverTimestamp()}).catch(()=>{});throw new Error(err.code==='EAUTH'?'Gmail authentication failed':'Gmail delivery outcome requires review');}
 }

 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(stored.payload)});
  const result=await r.json();if(!r.ok||!result.id)throw new Error('Mail provider rejected request');
  await ref.update({state:'sent',providerId:result.id,sentAt:FieldValue.serverTimestamp()});return true;
 }finally{clearTimeout(timer);}
}
export async function emailJob(req,res,kind,{getDb=adminDb,now=()=>new Date(),clock=Date.now,send=deliver,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!validCronAuth(req.headers.authorization))return res.status(401).json({error:'Unauthorized'});
 const transport=process.env.EMAIL_TRANSPORT||'resend';
 if(process.env.EMAIL_JOBS_ENABLED!=='true'||!['gmail','resend'].includes(transport)||(transport==='gmail'?!gmailConfigured():(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM))||!process.env.UNSUBSCRIBE_SECRET||process.env.UNSUBSCRIBE_SECRET.length<32)return res.status(503).json({error:'Email jobs not configured'});
 const sender=transport==='gmail'?'Comedor UNER <'+GMAIL_SENDER+'>':process.env.EMAIL_FROM;
 const timing=localSchedule(kind,now());if(!timing.allowed)return res.status(200).json({skipped:true});
 let db,lock,owner;const began=clock(),counts={sent:0,skipped:0};
 try{
  db=getDb();owner=randomUUID();lock=db.collection('emailJobLocks').doc(kind+'_'+timing.date);
  const claimed=await db.runTransaction(async tx=>{const s=await tx.get(lock);if(s.exists&&s.data().until>Date.now())return false;tx.set(lock,{owner,until:Date.now()+300000});return true;});
  if(!claimed)return res.status(200).json({busy:true});
  const dayDoc=await db.collection('days').doc(timing.date).get();if(!dayDoc.exists)return res.status(200).json({skipped:true});const day=dayDoc.data();
  if(kind==='report'){
   const snapshot=await db.collection('reservations').where('dateKey','==',timing.date).get(),records=snapshot.docs.map(d=>d.data());
   const modalities=await db.collection('modalities').get(),names=new Map(modalities.docs.map(d=>[d.id,d.data().name]));
   const content=(await dailyWorkbook(timing.date,records.map(r=>({...r,modalityName:r.modalityId?(names.get(r.modalityId)||'Modalidad eliminada'):'Habitual'})),day)).toString('base64');
   for(const email of ADMIN_EMAILS){await pause(600);const payload={from:sender,to:[email],subject:'Reservas del comedor · '+timing.date,text:'Adjuntamos las reservas y porciones del día. La planilla refleja los datos al generarla. Consultá el panel por cambios posteriores.',attachments:[{filename:'reservas-'+timing.date+'.xlsx',content}]};counts[await send(db,'report_'+timing.date+'_'+id(email),payload)?'sent':'skipped']++;}
  }else if(!day.blocked){
   const progressRef=db.collection('emailJobProgress').doc('reminders_'+timing.date),progress=(await progressRef.get()).data();
   if(progress?.done)return res.status(200).json({done:true,...counts});
   let cursor=progress?.lastUid||null,more=true;
   while(more&&clock()-began<35000&&localSchedule(kind,now()).allowed){
    let query=db.collection('users').orderBy('__name__').limit(50);if(cursor)query=query.startAfter(cursor);const page=await query.get();
    if(page.empty){more=false;break;}
    for(const doc of page.docs){
     if(clock()-began>=35000||!localSchedule(kind,now()).allowed)return res.status(503).json({retry:true,...counts});
     const sentKey='reminder_'+timing.date+'_'+id(doc.id),sent=(await db.collection('emailDeliveries').doc(id(sentKey)).get()).data();
     if(sent?.state==='sent'){counts.skipped++;}
     else {
      // Check opt-out, recent reservations, blocking and deletion before each send.
      const [fresh,current,latestDay,deleting]=await Promise.all([doc.ref.get(),db.collection('reservations').where('uid','==',doc.id).get(),dayDoc.ref.get(),db.collection('accountDeletionLocks').doc(doc.id).get()]);
      const profile=fresh.data(),todays=current.docs.map(d=>d.data()).filter(r=>r.dateKey===timing.date);
      if(!profile||deleting.exists||!profile.email||!wantsReminder(profile,todays,latestDay.data()))counts.skipped++;
      else {
       if(!localSchedule(kind,now()).allowed)return res.status(200).json({closed:true,...counts});
       const mail=reminderMail(doc.id,profile,timing.date,process.env.UNSUBSCRIBE_SECRET);
       counts[await send(db,sentKey,{from:sender,...mail})?'sent':'skipped']++;
       await pause(600);
      }
     }
     cursor=doc.id;await progressRef.set({lastUid:cursor,done:false,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    }
    more=page.size===50;
   }
   if(more)return res.status(503).json({retry:true,...counts});
   await progressRef.set({lastUid:cursor,done:true,updatedAt:FieldValue.serverTimestamp()},{merge:true});
   // Caller may retry within 09:00–09:59; sent ledger prevents repeats.
  }
  return res.status(200).json(counts);
 }catch(e){console.error('Email job failed',kind,e.message);return res.status(500).json({error:'Email job failed; safe to retry'});}
 finally{if(db&&lock&&owner)await release(db,lock,owner).catch(()=>{});}
}
