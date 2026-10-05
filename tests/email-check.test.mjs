import test from 'node:test';import assert from 'node:assert/strict';import {emailCheck} from '../server/email-check.mjs';
const response=()=>({code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
test('Comprobación protegida y sin envíos; funciona con envíos desactivados y no revela credenciales',async()=>{
 const previous={...process.env},secret='test-check-secret-'.repeat(3);
 Object.assign(process.env,{CRON_SECRET:secret,UNSUBSCRIBE_SECRET:secret,EMAIL_TRANSPORT:'gmail',GMAIL_USER:'comedorunerfcal@gmail.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop',FIREBASE_SERVICE_ACCOUNT_JSON:'test-only',EMAIL_JOBS_ENABLED:'false'});
 let created=0,deleted=0,verified=0;const db={collection:()=>({doc:()=>({create:async()=>{created++;},get:async()=>({exists:true}),delete:async()=>{deleted++;}})})};
 try{
  let res=response();await emailCheck({method:'GET',headers:{}},res,{getDb:()=>{throw new Error('not reachable');}});assert.equal(res.code,401);assert.equal(created,0);
  const req={method:'GET',headers:{authorization:'Bearer '+secret}};
  res=response();await emailCheck(req,res,{getDb:()=>db,verify:async()=>{verified++;}});
  assert.deepEqual(res.body,{ok:true,configuration:'ok',firebase:'ok',gmail:'ok',enabled:false});assert.equal(created,1);assert.equal(deleted,1);assert.equal(verified,1);assert.ok(!JSON.stringify(res.body).includes(secret));
  res=response();await emailCheck(req,res,{getDb:()=>{throw Object.assign(new Error('private details'),{code:7});},verify:async()=>{throw Object.assign(new Error('private credential info'),{code:'EAUTH'});}});
  assert.equal(res.body.firebase,'permission_denied');assert.equal(res.body.gmail,'authentication_failed');assert.ok(!JSON.stringify(res.body).includes('private'));
  delete process.env.UNSUBSCRIBE_SECRET;res=response();await emailCheck(req,res,{getDb:()=>db,verify:async()=>{verified++;}});assert.equal(res.body.configuration,'missing_or_invalid');assert.equal(verified,1);
 }finally{for(const k of ['CRON_SECRET','UNSUBSCRIBE_SECRET','EMAIL_TRANSPORT','GMAIL_USER','GMAIL_APP_PASSWORD','FIREBASE_SERVICE_ACCOUNT_JSON','EMAIL_JOBS_ENABLED'])if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
});
