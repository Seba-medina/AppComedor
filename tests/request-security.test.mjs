import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAppRequest,limitStudentRequests} from '../server/request-security.mjs';
import {secretKinds} from '../scripts/scan-secrets.mjs';
function database(){
 const state=new Map();let queue=Promise.resolve();
 return {state,collection:name=>({doc:id=>({path:name+'/'+id})}),runTransaction:fn=>{
  const result=queue.then(()=>fn({get:async ref=>({data:()=>state.get(ref.path)}),set:(ref,value)=>state.set(ref.path,value)}));queue=result.catch(()=>{});return result;
 }};
}
test('Concurrent API requests share the limit and separate UID/operation; windows recover',async()=>{
 const db=database(),time=new Date('2026-10-10T09:00:00Z');
 const results=await Promise.allSettled(Array.from({length:35},()=>limitStudentRequests(db,'student','choicesWrite',time)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,30);
 assert(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===429&&r.reason.retryAfter===300));
 await limitStudentRequests(db,'other','choicesWrite',time);await limitStudentRequests(db,'student','choicesRead',time);
 await limitStudentRequests(db,'student','choicesWrite',new Date(time.getTime()+300000));
 assert.equal(db.state.size,3);assert(!JSON.stringify([...db.state]).includes('student'));
 for(let i=0;i<5;i++)await limitStudentRequests(db,'student','welcome',time);
 await assert.rejects(limitStudentRequests(db,'student','welcome',time),{status:429});
});
test('App Check is staged, then rejects missing/invalid/other-app tokens when enforced',async()=>{
 const original=process.env.APP_CHECK_ENFORCED;
 try{
  delete process.env.APP_CHECK_ENFORCED;await checkAppRequest({headers:{}},()=>{throw new Error('should not run');});
  process.env.APP_CHECK_ENFORCED='true';
  await assert.rejects(checkAppRequest({headers:{}}),{status:403});
  await assert.rejects(checkAppRequest({headers:{'x-firebase-appcheck':'test'}},async()=>{throw new Error('invalid');}),{status:403});
  await assert.rejects(checkAppRequest({headers:{'x-firebase-appcheck':'test'}},async()=>({appId:'other'})),{status:403});
  await checkAppRequest({headers:{'x-firebase-appcheck':'test'}},async()=>({appId:'1:258857082564:web:077fd0da43f87dbdecf391'}));
 }finally{if(original===undefined)delete process.env.APP_CHECK_ENFORCED;else process.env.APP_CHECK_ENFORCED=original;}
});
test('Secret scanner distinguishes Firebase public configuration from private credentials',()=>{
 assert.deepEqual(secretKinds('apiKey: "AIzaSy-public-project-id"'),[]);
 const marker='-----BEGIN '+'PRIVATE KEY-----';assert(secretKinds(marker+'\n'+'A'.repeat(40)).includes('private-key'));
 assert(secretKinds('"private_key": "'+'A'.repeat(50)+'"').includes('service-account'));
 assert(secretKinds('CRON_SECRET="'+'Z'.repeat(40)+'"').includes('configured-secret'));
});
