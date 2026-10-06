import test from 'node:test';import assert from 'node:assert/strict';
import {emailTest} from '../server/email-test.mjs';
const response=()=>({code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
test('Prueba protegida, destinatario fijo y envíos generales desactivados',async()=>{
 const keys=['CRON_SECRET','EMAIL_TRANSPORT','GMAIL_USER','GMAIL_APP_PASSWORD','EMAIL_JOBS_ENABLED'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{CRON_SECRET:'test-secret-'.repeat(4),EMAIL_TRANSPORT:'gmail',GMAIL_USER:'comedorunerfcal@gmail.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop',EMAIL_JOBS_ENABLED:'false'});
  const calls=[],opts={getDb:()=>({}),now:()=>new Date('2026-10-05T22:00:00-03:00'),send:async(db,key,p)=>{calls.push({key,p});return calls.length===1;}};
  let r=response();await emailTest({method:'GET',headers:{}},r,opts);assert.equal(r.code,401);assert.equal(calls.length,0);
  const req={method:'GET',headers:{authorization:'Bearer '+process.env.CRON_SECRET},query:{to:'outsider@example.com'}};
  r=response();await emailTest(req,r,opts);assert.equal(r.code,200);assert.equal(r.body.sent,true);assert.equal(r.body.enabled,false);assert.deepEqual(calls[0].p.to,['sebastianezequielmedina@gmail.com']);assert.equal(calls[0].key,'gmail_test_2026-10-05');
  r=response();await emailTest(req,r,opts);assert.equal(r.body.alreadyProcessed,true);assert.equal(calls[1].key,calls[0].key);
  r=response();await emailTest({...req,method:'POST'},r,opts);assert.equal(r.code,405);assert.equal(calls.length,2);
 }finally{for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
});
