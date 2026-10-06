import test from 'node:test';import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {localSchedule,wantsReminder,reminderToken,tokenUid,reminderMail} from '../server/notifications.mjs';
import {dailyWorkbook} from '../server/workbook.mjs';
import {deliver,emailJob} from '../server/email-job.mjs';
import unsubscribe from '../api/unsubscribe.js';
const secret='test-only-secret-'.repeat(3),day={blocked:false,generation:2},profile={email:'alumno@example.com',name:'José <script>'};
test('Horarios argentinos: recordatorio domingo a jueves para mañana y Excel lunes a viernes',()=>{
 for(const [kind,time,allowed] of [['reminders','2026-10-05T08:59:00-03:00',false],['reminders','2026-10-05T09:00:00-03:00',true],['reminders','2026-10-05T09:59:59-03:00',true],['reminders','2026-10-05T10:00:00-03:00',false],['report','2026-10-05T10:04:00-03:00',false],['report','2026-10-05T10:05:00-03:00',true],['report','2026-10-10T10:05:00-03:00',false]])assert.equal(localSchedule(kind,new Date(time)).allowed,allowed);
 assert.deepEqual(localSchedule('reminders',new Date('2026-10-04T09:00:00-03:00')),{date:'2026-10-05',allowed:true});
 assert.equal(localSchedule('reminders',new Date('2026-10-09T09:00:00-03:00')).allowed,false);
 assert.equal(localSchedule('reminders',new Date('2026-10-08T09:00:00-03:00')).date,'2026-10-09');
 assert.equal(localSchedule('report',new Date('2026-10-09T10:05:00-03:00')).allowed,true);
 assert.equal(localSchedule('report',new Date('2026-10-04T10:05:00-03:00')).allowed,false);
});
test('Avisar a todos sin reserva, excluir baja, admin, bloqueo y cancelación expresa vigente',()=>{
 assert.equal(wantsReminder(profile,[],day),true);
 assert.equal(wantsReminder({...profile,reminderEmails:false},[],day),false);
 assert.equal(wantsReminder({...profile,email:'sebastianezequielmedina@gmail.com'},[],day),false);
 assert.equal(wantsReminder(profile,[],{...day,blocked:true}),false);
 assert.equal(wantsReminder(profile,[],undefined),false);
 assert.equal(wantsReminder(profile,[{portions:1,generation:2}],day),false);
 assert.equal(wantsReminder(profile,[{portions:1,generation:2,cancelled:true}],day),false);
 assert.equal(wantsReminder(profile,[{portions:1,generation:1}],day),true);
 assert.equal(wantsReminder(profile,[{portions:0,generation:2,cancelled:false}],day),true);
});
test('Enlace de baja firmado por usuario y sin exponer el correo; escapa HTML',()=>{
 const token=reminderToken('u_á',secret);assert.equal(tokenUid(token,secret),'u_á');
 assert.equal(tokenUid(token+'x',secret),null);assert.equal(tokenUid(token,secret+'x'),null);assert.equal(tokenUid(reminderToken('a/b',secret),secret),null);
 const mail=reminderMail('u',profile,'2026-10-05',secret);assert.deepEqual(mail.to,[profile.email]);assert.ok(mail.html.includes('&lt;script&gt;'));assert.ok(!mail.html.includes('<script>'));assert.ok(mail.headers['List-Unsubscribe']);
});
test('Excel real: dos turnos, Unicode, columnas de asistencia y totales de reservas activas',async()=>{
 const records=[{shift:'mediodia',name:'Ángela',condition:'Becario',portions:2,diet:'Sin TACC',generation:2},{shift:'noche',name:'=HYPERLINK("mal")',condition:'Personal',portions:1,generation:2},{shift:'mediodia',name:'Baja',portions:2,cancelled:true,generation:2},{shift:'noche',name:'Anterior',portions:2,generation:1}];
 const bytes=await dailyWorkbook('2026-10-05',records,day,new Date('2026-10-05T10:05:00-03:00')),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
 assert.deepEqual(book.worksheets.map(s=>s.name),['Mediodía','Noche','Resumen']);assert.equal(book.getWorksheet('Mediodía').getCell('A4').value,'Ángela');assert.equal(book.getWorksheet('Mediodía').getCell('C5').value,2);
 assert.equal(book.getWorksheet('Noche').getCell('A4').type,ExcelJS.ValueType.String);assert.equal(book.getWorksheet('Resumen').getCell('C6').value,3);assert.equal(book.getWorksheet('Mediodía').getCell('F3').value,'Asistió');
});
function mockDb(){let value=null;const ref={get:async()=>({exists:!!value,data:()=>value}),update:async d=>{value={...value,...d};}};const db={collection:()=>({doc:()=>ref}),runTransaction:async fn=>fn({get:()=>ref.get(),create:(_,d)=>{value=d;},update:(_,d)=>{value={...value,...d};}})};return {db,ref,get:()=>value};}
test('Reintentos reutilizan el mismo payload y clave; un correo enviado no vuelve a salir',async()=>{
 const state=mockDb(),original=global.fetch,requests=[];global.fetch=async(_,opts)=>{requests.push(opts);return {ok:true,json:async()=>({id:'provider-id'})};};
 try{
  const update=state.ref.update;let fail=true;state.ref.update=async d=>{if(fail){fail=false;throw new Error('DB temporarily unavailable');}await update(d);};
  await assert.rejects(deliver(state.db,'same-day-user',{to:['u@example.com'],text:'original'}));
  assert.equal(await deliver(state.db,'same-day-user',{to:['u@example.com'],text:'changed'}),true);
  assert.equal(requests.length,2);assert.equal(requests[0].body,requests[1].body);assert.equal(requests[1].headers['Idempotency-Key'],'same-day-user');
  assert.equal(await deliver(state.db,'same-day-user',{}),false);assert.equal(requests.length,2);
 }finally{global.fetch=original;}
});
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}});
test('Endpoints cerrados sin secreto, credenciales o token; GET de baja solo confirma',async()=>{
 const previous={...process.env};try{
  delete process.env.CRON_SECRET;let res=response();await emailJob({method:'GET',headers:{}},res,'reminders');assert.equal(res.code,401);
  process.env.CRON_SECRET=secret;delete process.env.EMAIL_JOBS_ENABLED;res=response();await emailJob({method:'GET',headers:{authorization:'Bearer '+secret}},res,'reminders');assert.equal(res.code,503);
  process.env.UNSUBSCRIBE_SECRET=secret;res=response();await unsubscribe({method:'GET',query:{token:reminderToken('u',secret)}},res);assert.equal(res.code,200);assert.ok(res.body.includes('method="post"'));assert.ok(!res.body.includes('Recordatorios desactivados'));
  res=response();await unsubscribe({method:'POST',query:{token:'invalid'}},res);assert.equal(res.code,400);
 }finally{for(const k of ['CRON_SECRET','EMAIL_JOBS_ENABLED','UNSUBSCRIBE_SECRET'])if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
});
test('Gmail marca antes de enviar; SMTP incierto no se reintenta y una aceptación no se duplica',async()=>{
 const previous=process.env.EMAIL_TRANSPORT;process.env.EMAIL_TRANSPORT='gmail';
 try{
  let calls=0;const failed=mockDb();const failSend=async()=>{calls++;throw new Error('socket lost after DATA');};
  await assert.rejects(deliver(failed.db,'gmail-uncertain',{to:['u@example.com']},{smtpSend:failSend}));assert.equal(failed.get().state,'uncertain');
  assert.equal(await deliver(failed.db,'gmail-uncertain',{}, {smtpSend:failSend}),false);assert.equal(calls,1);
  const good=mockDb();const accept=async()=>{calls++;assert.equal(good.get().state,'sending');return {messageId:'gmail-id'};};
  assert.equal(await deliver(good.db,'gmail-good',{to:['u@example.com']},{smtpSend:accept}),true);assert.equal(good.get().state,'sent');
  assert.equal(await deliver(good.db,'gmail-good',{}, {smtpSend:accept}),false);assert.equal(calls,2);
  const auth=mockDb();await assert.rejects(deliver(auth.db,'gmail-auth',{}, {smtpSend:async()=>{throw Object.assign(new Error('auth'),{code:'EAUTH'});}}));assert.equal(auth.get().state,'pending');
 }finally{if(previous===undefined)delete process.env.EMAIL_TRANSPORT;else process.env.EMAIL_TRANSPORT=previous;}
});
test('Gmail limita el remitente a la cuenta del comedor y exige contraseña de aplicación',async()=>{
 const {gmailOptions,gmailConfigured}=await import('../server/gmail.mjs');const previous={...process.env};
 try{
  process.env.GMAIL_USER='otro@gmail.com';process.env.GMAIL_APP_PASSWORD='abcdefghijklmnop';assert.equal(gmailConfigured(),false);assert.throws(()=>gmailOptions());
  process.env.GMAIL_USER='comedorunerfcal@gmail.com';process.env.GMAIL_APP_PASSWORD='abcd efgh ijkl mnop';assert.equal(gmailConfigured(),true);const config=gmailOptions();assert.equal(config.secure,true);assert.equal(config.port,465);assert.equal(config.auth.pass,'abcdefghijklmnop');
 }finally{for(const key of ['GMAIL_USER','GMAIL_APP_PASSWORD'])if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});

test('Gmail limita la espera SMTP y cierra el transporte sin reenviar',async()=>{
 const {sendGmail}=await import('../server/gmail.mjs');
 process.env.GMAIL_USER='comedorunerfcal@gmail.com';process.env.GMAIL_APP_PASSWORD='abcdefghijklmnop';
 let calls=0,closed=0;
 const createTransport=()=>({sendMail(){calls++;return new Promise(()=>{});},close(){closed++;}});
 await assert.rejects(sendGmail({to:['test@example.com'],text:'Prueba'},'timeout-test',{createTransport,timeoutMs:5}),{code:'ETIMEDOUT'});
 assert.equal(calls,1);assert.equal(closed,1);
});

test('El domingo se abre la próxima semana para reservar el lunes',async()=>{const {reservationWeek}=await import('../domain.mjs');assert.equal(reservationWeek(new Date('2026-10-04T09:00:00-03:00')),'2026-10-05');assert.equal(reservationWeek(new Date('2026-10-09T09:00:00-03:00')),'2026-10-05');assert.equal(reservationWeek(new Date('2026-12-27T09:00:00-03:00')),'2026-12-28');assert.ok(reminderMail('u',profile,'2026-10-05',secret).text.includes('mañana (2026-10-05)'));});
