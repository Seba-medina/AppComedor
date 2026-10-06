import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dayResponse,welcomeEmail,studentIdentity} from '../server/student-messages.mjs';
import {deliver} from '../server/email-job.mjs';
import {wantsReminder,welcomeMail} from '../server/notifications.mjs';
import {reservationId} from '../domain.mjs';

const now=()=>new Date('2026-10-06T08:30:00-03:00');
const identity={uid:'student',email:'student@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}};
const verify=async token=>{assert.equal(token,'valid');return identity;};
const request=(body,method='POST')=>({method,headers:{authorization:'Bearer valid',origin:'https://appomedoruner.vercel.app'},body});
const response=()=>({code:200,setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
function memoryDb(){
 const data=new Map();let tail=Promise.resolve();
 const ref=path=>({path,id:path.split('/').at(-1),get:async()=>({exists:data.has(path),ref:ref(path),data:()=>data.get(path)}),update:async value=>data.set(path,{...data.get(path),...value})});
 const db={collection:name=>({doc:key=>ref(name+'/'+key)}),runTransaction:fn=>{
  const result=tail.then(async()=>{const writes=[];const out=await fn({get:r=>r.get(),set:(r,d)=>writes.push(()=>data.set(r.path,d)),update:(r,d)=>writes.push(()=>data.set(r.path,{...data.get(r.path),...d})),create:(r,d)=>{if(data.has(r.path))throw new Error('exists');writes.push(()=>data.set(r.path,d));}});writes.forEach(fn=>fn());return out;});
  tail=result.catch(()=>{});return result;
 }};
 data.set('users/student',{name:'Ana <Pérez>',email:identity.email});
 data.set('days/2026-10-06',{week:'2026-10-05',blocked:false,generation:0});
 data.set('days/2026-10-07',{week:'2026-10-05',blocked:false,generation:0});
 return {db,data};
}
test('Solo Google verificado y el token propio; no acepta UID o destinatario del cuerpo',async()=>{
 await assert.rejects(studentIdentity({headers:{}}),{status:401});
 await assert.rejects(studentIdentity(request({}),async()=>{throw new Error('expired');}),{status:401});
 await assert.rejects(studentIdentity(request({}),async()=>({...identity,email_verified:false})),{status:403});
 await assert.rejects(studentIdentity(request({}),async()=>({...identity,firebase:{sign_in_provider:'password'}})),{status:403});
 await assert.rejects(studentIdentity({...request({}),headers:{...request({}).headers,origin:'https://other.example'}}),{status:403});
 const {db,data}=memoryDb(),r=response();
 await dayResponse(request({date:'2026-10-06',choice:'notGoing',uid:'victim'}),r,{getDb:()=>db,verify,now});
 assert.equal(r.code,400);assert(!data.has('dayResponses/student'));assert(!data.has('dayResponses/victim'));
});
test('No voy persiste por fecha; no avisa solo esa fecha y quitarlo no restaura reservas',async()=>{
 const {db,data}=memoryDb(),options={getDb:()=>db,verify,now};
 let r=response();await dayResponse(request({date:'2026-10-06',choice:'notGoing'}),r,options);assert.equal(r.code,200);assert.deepEqual(r.body.notGoingDates,['2026-10-06']);
 r=response();await dayResponse(request(undefined,'GET'),r,options);assert.deepEqual(r.body.notGoingDates,['2026-10-06']);
 const state=data.get('dayResponses/student'),day=data.get('days/2026-10-06');
 assert.equal(wantsReminder({email:identity.email},[],day,'2026-10-06',state),false);
 assert.equal(wantsReminder({email:identity.email},[],day,'2026-10-07',state),true);
 r=response();await dayResponse(request({date:'2026-10-06',choice:'clear'}),r,options);assert.deepEqual(r.body.notGoingDates,[]);
 assert.equal(wantsReminder({email:identity.email},[],day,'2026-10-06',data.get('dayResponses/student')),true);
 r=response();await dayResponse(request(undefined,'GET'),r,{...options,now:()=>new Date('2026-10-12T08:00:00-03:00')});assert.deepEqual(r.body.notGoingDates,[]);
});
test('Con reservas exige confirmar ambos turnos, cancela atómicamente solo sus registros',async()=>{
 const {db,data}=memoryDb(),options={getDb:()=>db,verify,now};
 for(const shift of ['mediodia','noche'])data.set('reservations/'+reservationId(identity.uid,'2026-10-06',shift,0),{uid:identity.uid,dateKey:'2026-10-06',shift,generation:0,portions:1,cancelled:false,createdAt:'original'});
 data.set('reservations/other_2026-10-06_mediodia_0',{uid:'other',portions:2,cancelled:false});
 let r=response();await dayResponse(request({date:'2026-10-06',choice:'notGoing'}),r,options);assert.equal(r.code,409);assert(!data.has('dayResponses/student'));
 r=response();await dayResponse(request({date:'2026-10-06',choice:'notGoing',confirmCancel:true}),r,options);assert.equal(r.body.cancelled,2);
 for(const shift of ['mediodia','noche']){const slot=data.get('reservations/'+reservationId(identity.uid,'2026-10-06',shift,0));assert.equal(slot.cancelled,true);assert.equal(slot.createdAt,'original');}
 assert.equal(data.get('reservations/other_2026-10-06_mediodia_0').cancelled,false);
 r=response();await dayResponse(request({date:'2026-10-06',choice:'clear'}),r,options);assert.equal(r.code,200);assert.equal(data.get('reservations/'+reservationId(identity.uid,'2026-10-06','noche',0)).cancelled,true);
});
test('Rechaza cierre exacto, bloqueo, días sin habilitar, otras semanas y bloqueo de borrado',async()=>{
 for(const scenario of ['closed','blocked','missing','otherWeek','deleting']){
  const {db,data}=memoryDb();if(scenario==='blocked')data.get('days/2026-10-06').blocked=true;
  if(scenario==='missing')data.delete('days/2026-10-06');
  if(scenario==='deleting')data.set('accountDeletionLocks/student',{});
  const r=response();await dayResponse(request({date:scenario==='otherWeek'?'2026-10-13':'2026-10-06',choice:'notGoing'}),r,{getDb:()=>db,verify,now:scenario==='closed'?()=>new Date('2026-10-06T10:00:00-03:00'):now});
  assert.equal(r.code,scenario==='otherWeek'?400:scenario==='deleting'?403:409);assert(!data.has('dayResponses/student'));
 }
});
test('Bienvenida al correo verificado: concurrencia/reintentos/recreación no duplican; escapa nombres',async()=>{
 Object.assign(process.env,{EMAIL_TRANSPORT:'gmail',GMAIL_USER:'comedorunerfcal@gmail.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop'});
 const {db,data}=memoryDb(),calls=[];
 const options={getDb:()=>db,verify,now,send:(db,key,payload)=>deliver(db,key,payload,{smtpSend:async p=>{calls.push(p);return {messageId:'test-only'};}})};
 const results=[response(),response()];await Promise.all(results.map(r=>welcomeEmail(request({}),r,options)));assert(results.every(r=>r.code===200));assert.equal(calls.length,1);assert.deepEqual(calls[0].to,[identity.email]);
 assert(!calls[0].html.includes('Ana <Pérez>'));assert(calls[0].html.includes('&lt;Pérez&gt;'));assert(calls[0].text.includes('No es spam'));assert(calls[0].text.includes('depende de Gmail'));
 assert.equal(data.get('emailRateLimits/welcome_2026-10-06').count,1);
 data.set('users/student',{name:'Recreado',email:identity.email});let r=response();await welcomeEmail(request({}),r,options);assert.equal(calls.length,1);assert.equal(r.body.alreadyProcessed,true);
 r=response();await welcomeEmail(request({to:'victim@example.com'}),r,options);assert.equal(r.code,400);assert.equal(calls.length,1);
});
test('SMTP incierto no se reenvía; bienvenida necesita perfil y respeta límite global',async()=>{
 Object.assign(process.env,{EMAIL_TRANSPORT:'gmail',GMAIL_USER:'comedorunerfcal@gmail.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop'});
 const {db,data}=memoryDb();let calls=0;
 const options={getDb:()=>db,verify,now,send:(db,key,p)=>deliver(db,key,p,{smtpSend:async()=>{calls++;throw new Error('connection lost');}})};
 let r=response();await welcomeEmail(request({}),r,options);assert.equal(r.code,503);
 r=response();await welcomeEmail(request({}),r,options);assert.equal(r.body.state,'uncertain');assert.equal(calls,1);
 const clean=memoryDb();clean.data.delete('users/student');r=response();await welcomeEmail(request({}),r,{...options,getDb:()=>clean.db});assert.equal(r.code,403);
 const limited=memoryDb();limited.data.set('emailRateLimits/welcome_2026-10-06',{count:200});r=response();await welcomeEmail(request({}),r,{...options,getDb:()=>limited.db});assert.equal(r.code,429);assert.equal(calls,1);
});
