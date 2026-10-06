import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dayResponse,welcomeEmail} from '../server/student-messages.mjs';
import {emailJob,deliver} from '../server/email-job.mjs';
import {reservationId} from '../domain.mjs';
assert(process.env.FIRESTORE_EMULATOR_HOST,'Run only with the emulator');
initializeApp({projectId:'demo-appcomedor'});const db=getFirestore();
Object.assign(process.env,{EMAIL_TRANSPORT:'gmail',GMAIL_USER:'comedorunerfcal@gmail.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop',EMAIL_JOBS_ENABLED:'true',UNSUBSCRIBE_SECRET:'emulator-only-'.repeat(4),CRON_SECRET:'emulator-cron-'.repeat(4)});
const identity={uid:'new-student',email:'new@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}};
const req=body=>({method:'POST',headers:{authorization:'Bearer simulated'},body});
const response=()=>({code:200,setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
const now=()=>new Date('2026-10-06T08:30:00-03:00');
const options={getDb:()=>db,verify:async()=>identity,now};
const sent=[],send=(db,key,payload)=>deliver(db,key,payload,{smtpSend:async p=>{sent.push(p);return {messageId:'simulated-'+sent.length};}});
try{
 await db.collection('users').doc(identity.uid).set({name:'Nuevo alumno',email:identity.email});
 await db.collection('users').doc('other').set({name:'Otro alumno',email:'other@example.com'});
 await db.collection('days').doc('2026-10-06').set({week:'2026-10-05',generation:0,blocked:false});
 for(const shift of ['mediodia','noche'])await db.collection('reservations').doc(reservationId(identity.uid,'2026-10-06',shift,0)).set({uid:identity.uid,dateKey:'2026-10-06',week:'2026-10-05',generation:0,shift,portions:1,cancelled:false});
 let r=response();await dayResponse(req({date:'2026-10-06',choice:'notGoing'}),r,options);assert.equal(r.code,409);
 r=response();await dayResponse(req({date:'2026-10-06',choice:'notGoing',confirmCancel:true}),r,options);assert.equal(r.code,200);assert.equal(r.body.cancelled,2);
 for(const shift of ['mediodia','noche'])assert.equal((await db.collection('reservations').doc(reservationId(identity.uid,'2026-10-06',shift,0)).get()).data().cancelled,true);
 const welcomeResults=[response(),response()];await Promise.all(welcomeResults.map(r=>welcomeEmail(req({}),r,{...options,send})));assert(welcomeResults.every(r=>r.code===200));assert.equal(sent.length,1);assert.deepEqual(sent[0].to,[identity.email]);
 r=response();await emailJob({method:'GET',headers:{authorization:'Bearer '+process.env.CRON_SECRET}},r,'reminders',{getDb:()=>db,now:()=>new Date('2026-10-06T09:00:00-03:00'),send,pause:async()=>{}});assert.equal(r.code,200);assert.deepEqual(sent.map(p=>p.to[0]),[identity.email,'other@example.com']);
 r=response();await dayResponse({...req(undefined),method:'GET'},r,options);assert.deepEqual(r.body.notGoingDates,['2026-10-06']);
 r=response();await dayResponse(req({date:'2026-10-06',choice:'clear'}),r,options);assert.deepEqual(r.body.notGoingDates,[]);
 console.log('OK: real Firestore transactions, both-turn cancellation, once-only welcome and reminder exclusion; SMTP simulated.');
}finally{await db.terminate();}
