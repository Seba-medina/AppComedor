import test from 'node:test';import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {emailTest,emailTestExcel,emailTestReminder} from '../server/email-test.mjs';
const response=()=>({code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
test('Prueba protegida, destinatario fijo y envíos generales desactivados',async()=>{
 const keys=['CRON_SECRET','EMAIL_TRANSPORT','GMAIL_USER','GMAIL_APP_PASSWORD','EMAIL_JOBS_ENABLED','UNSUBSCRIBE_SECRET'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{CRON_SECRET:'test-secret-'.repeat(4),EMAIL_TRANSPORT:'gmail',GMAIL_USER:'comedorunerfcal@gmail.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop',EMAIL_JOBS_ENABLED:'false',UNSUBSCRIBE_SECRET:'test-unsubscribe-'.repeat(3)});
  const calls=[],opts={getDb:()=>({}),now:()=>new Date('2026-10-05T22:00:00-03:00'),send:async(db,key,p)=>{calls.push({key,p});return calls.length===1;}};
  let r=response();await emailTest({method:'GET',headers:{}},r,opts);assert.equal(r.code,401);assert.equal(calls.length,0);
  const req={method:'GET',headers:{authorization:'Bearer '+process.env.CRON_SECRET},query:{to:'outsider@example.com'}};
  r=response();await emailTest(req,r,opts);assert.equal(r.code,200);assert.equal(r.body.sent,true);assert.equal(r.body.enabled,false);assert.deepEqual(calls[0].p.to,['sebastianezequielmedina@gmail.com']);assert.equal(calls[0].key,'gmail_test_2026-10-05');
  r=response();await emailTest(req,r,opts);assert.equal(r.body.alreadyProcessed,true);assert.equal(calls[1].key,calls[0].key);
  r=response();await emailTest({...req,method:'POST'},r,opts);assert.equal(r.code,405);assert.equal(calls.length,2);
  const record={name:'Alumno de prueba',condition:'Alumno regular',portions:2,shift:'mediodia',generation:1};
  let expectedDate='2026-10-05';
  const excelDb={collection:name=>name==='days'?{doc:date=>{assert.equal(date,expectedDate);return ({get:async()=>({data:()=>({generation:1,blocked:false})})});}}:name==='reservations'?{where:(field,op,date)=>{assert.equal(date,expectedDate);return {get:async()=>({docs:[{data:()=>record}]})};}}:{get:async()=>({docs:[]})}};
  let excelPayload,excelKey;
  r=response();await emailTestExcel(req,r,{...opts,getDb:()=>excelDb,send:async(db,key,p)=>{excelPayload=p;excelKey=key;return true;}});
  assert.equal(r.body.sent,true);assert.equal(r.body.enabled,false);assert.deepEqual(excelPayload.to,['sebastianezequielmedina@gmail.com']);assert.equal(excelKey,'gmail_excel_test_v2_2026-10-05');
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(excelPayload.attachments[0].content,'base64'));assert.equal(book.getWorksheet('Mediodía').getCell('A4').value,'Alumno de prueba');assert.equal(book.getWorksheet('Mediodía').getCell('C4').value,2);assert.equal(book.getWorksheet('Mediodía').getCell('F3').value,'Asistió');assert.equal(book.getWorksheet('Mediodía').getCell('F4').protection,undefined);

  expectedDate='2026-10-06';r=response();await emailTestExcel({...req,query:{day:'tomorrow',to:'outsider@example.com',date:'2099-01-01'}},r,{...opts,getDb:()=>excelDb,send:async(db,key,p)=>{excelPayload=p;excelKey=key;return true;}});
  assert.equal(r.body.sent,true);assert.equal(excelKey,'gmail_excel_test_v2_2026-10-06');assert.equal(excelPayload.attachments[0].filename,'reservas-2026-10-06.xlsx');assert.deepEqual(excelPayload.to,['sebastianezequielmedina@gmail.com']);const tomorrowBook=new ExcelJS.Workbook();await tomorrowBook.xlsx.load(Buffer.from(excelPayload.attachments[0].content,'base64'));assert.equal(tomorrowBook.getWorksheet('Mediodía').getCell('A1').value,'Reservas del 2026-10-06');
  const reminderDb={collection:name=>{assert.equal(name,'users');return {where:(field,op,email)=>{assert.equal(field,'email');assert.equal(email,'sebastianezequielmedina@gmail.com');return {limit:n=>{assert.equal(n,1);return {get:async()=>({empty:false,docs:[{id:'admin-uid',data:()=>({name:'Sebastián',email:'wrong@example.com'})}]})};}};}};}};
  let reminderPayload,reminderKey;r=response();await emailTestReminder(req,r,{...opts,getDb:()=>reminderDb,send:async(db,key,p)=>{reminderPayload=p;reminderKey=key;return true;}});
  assert.equal(r.body.sent,true);assert.equal(r.body.enabled,false);assert.deepEqual(reminderPayload.to,['sebastianezequielmedina@gmail.com']);assert.equal(reminderKey,'gmail_reminder_test_2026-10-05');assert.ok(reminderPayload.html.includes('Reservar mi comida'));assert.ok(reminderPayload.text.includes('PRUEBA:'));assert.ok(reminderPayload.headers['List-Unsubscribe']);
  const {reminderToken}=await import('../server/notifications.mjs');assert.ok(reminderPayload.text.includes(reminderToken('admin-uid',process.env.UNSUBSCRIBE_SECRET)));
 }finally{for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
});
