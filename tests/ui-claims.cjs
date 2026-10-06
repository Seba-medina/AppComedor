const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const deps=createRequire(process.env.APP_TEST_DEPS||path.resolve('tests/package.json'));
const {JSDOM}=deps('jsdom');
(async()=>{
 const domain=await import('../security/claims/domain.mjs');
 const {ADMIN_EMAIL}=await import('../server/mail-recipients.mjs');
 const backupTools=await import('../backup.mjs');
 const management=await import('../security/claims/management.mjs');
 const templateTools=await import('../week-template.mjs');
 let capturedBackup=null,failBackupRead=false;
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://appomedoruner.vercel.app'});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const document=dom.window.document,records=new Map([['adminRoles/admin',{admin:true}],['adminRoles/admin2',{admin:true}]]),listeners=[],writes=[];
 let authCallback,loginRequests=0,loginFailure=null; const choices=new Map(),welcomeRequests=[];
 const next=new Date(domain.monday()+'T00:00:00Z');next.setUTCDate(next.getUTCDate());
 const week=next.toISOString().slice(0,10);
 let autoId=0;const ref=(...args)=>args.length===1&&args[0]?.path?{path:args[0].path+'/auto'+(++autoId)}:{path:args.filter(x=>typeof x==='string').join('/')};
 const snapshot=r=>{
  if(r.filter){const list=[...records].filter(([p,d])=>p.startsWith(r.path+'/')&&(!r.constraints||r.constraints.every(w=>!w.field||(w.op==='=='?d[w.field]===w.value:w.op==='>='?d[w.field]>=w.value:d[w.field]<w.value))));return {docs:list.map(([p,d])=>({id:p.split('/').at(-1),data:()=>d}))};}
  const data=records.get(r.path);return {exists:()=>!!data,data:()=>data};
 };
 const notify=()=>listeners.filter(x=>x.active).forEach(x=>x.cb(snapshot(x.ref)));
 const set=async(r,d,opts)=>{records.set(r.path,opts?.merge?{...records.get(r.path),...d}:d);writes.push(r.path);notify();};
 const ctx=vm.createContext({document,console,Date:class extends Date{constructor(...args){super(...(args.length?args:[week+'T09:00:00-03:00']));}static now(){return new Date(week+'T09:00:00-03:00').getTime();}},Map,Number,Object,String,JSON,Intl,Promise,...domain,...backupTools,...management,...templateTools,applyWeekTemplate:(...args)=>templateTools.applyWeekTemplate(...args,new Date(week+'T09:00:00-03:00')),RECAPTCHA_ENTERPRISE_SITE_KEY:"",downloadBackup:b=>{capturedBackup=b;},validateSelections:(selected,days,profile)=>domain.validateSelections(selected,days,profile,new Date(week+'T09:00:00-03:00')),
  studentRequest:async(account,path,body)=>{if(path==='/api/welcome'){welcomeRequests.push(account.uid);return {state:'sent'};}const dates=new Set(choices.get(account.uid)||[]);if(body){if(body.choice==='notGoing'){dates.add(body.date);if(body.confirmCancel)for(const [path,r]of records)if(path.startsWith('reservations/')&&r.uid===account.uid&&r.dateKey===body.date)records.set(path,{...r,cancelled:true});notify();}else dates.delete(body.date);choices.set(account.uid,[...dates]);}return {week,notGoingDates:[...dates],cancelled:body?.confirmCancel?2:0};},
  auth:{},db:{},GoogleAuthProvider:class{setCustomParameters(){}},
  signInWithPopup:async()=>{loginRequests++;if(loginFailure)throw loginFailure;},signOut:async()=>authCallback(null),onIdTokenChanged:(a,cb)=>{authCallback=cb;cb(null);},getIdTokenResult:async u=>({claims:{admin:['admin','admin2'].includes(u.uid)},signInProvider:'google.com'}),
  doc:ref,collection:(...args)=>({...ref(...args),filter:true}),query:(r,...constraints)=>({...r,constraints}),where:(field,op,value)=>({field,op,value}),orderBy:()=>({}),limit:()=>({}),
  onSnapshot:(r,cb)=>{const x={ref:r,cb,active:true};listeners.push(x);cb(snapshot(r));return()=>x.active=false;},
  getDoc:async r=>snapshot(r),getDocs:async r=>snapshot(r),getDocsFromServer:async r=>{if(failBackupRead)throw new Error("Sin conexión");return snapshot(r);},setDoc:set,deleteDoc:async r=>{records.delete(r.path);notify();},
  writeBatch:()=>{const pending=[];return {set:(r,d,opts)=>pending.push([r,d,opts]),delete:r=>pending.push([r,null]),commit:async()=>{for(const [r,d,opts]of pending){if(d===null){records.delete(r.path);notify();}else await set(r,d,opts);}}};},
  runTransaction:async(db,fn)=>fn({get:async r=>snapshot(r),update:set,set}),
  serverTimestamp:()=>({server:true}),Timestamp:{fromDate:d=>d},setInterval(){},confirm:()=>true,prompt:()=>'',FileReader:dom.window.FileReader
 });
 vm.runInContext(fs.readFileSync('security/claims/app.js','utf8').replace(/^import .*;\n/gm,''),ctx);
 assert.equal(document.querySelector('#admin-nav').hidden,true);
 assert.equal(document.querySelector('#login-button').hidden,false);
 assert.equal(document.querySelector('#first-use').hidden,false);
 assert.equal(document.querySelector('#first-use-action').textContent,'Ingresar con Google');
 assert.equal(document.querySelector('#week-input'),null);
 assert.equal(document.querySelector('#profile-panel').hidden,true);
 document.querySelector('#profile-toggle').click();assert.equal(document.querySelector('#profile-panel').hidden,true);
 document.querySelector('#profile-toggle').click();assert.equal(document.querySelector('#profile-panel').hidden,true);
 assert.equal(document.querySelector('.sidebar').firstElementChild.className,'menu-card');
 assert.equal(document.querySelector('#welcome-screen').hidden,false);
 assert.equal(document.querySelector('#inicio').hidden,true);
 assert.equal(document.querySelector('.topbar').hidden,true);
 assert.equal(document.querySelector('.branded-footer').hidden,true);
 assert.equal(listeners.some(x=>x.active&&x.ref.path.startsWith('menus/')),false);
 document.querySelector('#register-button').click();assert.equal(document.querySelector('#login-button').disabled,true);await new Promise(r=>setImmediate(r));assert.equal(loginRequests,1);
 loginFailure={code:'auth/popup-closed-by-user'};document.querySelector('#login-button').click();await new Promise(r=>setImmediate(r));assert.match(document.querySelector('#welcome-auth-status').textContent,/Se cerró/);assert.equal(document.querySelector('#register-button').disabled,false);loginFailure=null;

 await authCallback({uid:'student',email:'student@example.com',displayName:'Alumno',emailVerified:true});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#first-use-action').textContent,'Completar mi perfil');
 assert.equal(document.querySelector('#welcome-screen').hidden,true);
 assert.equal(document.querySelector('#inicio').hidden,false);
 assert.equal(document.querySelector('#profile-panel').hidden,false);
 assert.equal(document.querySelector('#profile-name').value,'Alumno');
 assert.equal(document.querySelector('#profile-save').textContent,'Guardar y empezar');
 assert.equal(document.querySelector('#student-view').hidden,true);
 assert.equal(document.querySelector('.profile-toolbar').hidden,true);

 records.set('users/student',{name:'Alumno',condition:'Alumno regular',diet:'Sin TACC',email:'student@example.com'});
 for(const date of domain.weekDays(week))records.set('days/'+date,{week,blocked:false,generation:0});notify();
 await authCallback({uid:'student',email:'student@example.com',displayName:'Alumno',emailVerified:true});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#admin-nav').hidden,true);
 document.querySelector('#download-backup').click();await new Promise(r=>setImmediate(r));assert.equal(capturedBackup,null);
 assert.equal(document.querySelector('#profile-form').hidden,false);
 assert.equal(document.querySelector('#profile-reminders').checked,true);
 document.querySelector('#profile-toggle').click();
 assert.equal(document.querySelector('#profile-dialog').open,true);
 assert.equal(document.querySelector('#profile-panel').parentElement.id,'profile-dialog');
 assert.equal(document.body.classList.contains('profile-modal-open'),true);
 document.querySelector('#close-profile').click();
 assert.equal(document.querySelector('#profile-dialog').open,false);
 assert.equal(document.querySelector('#profile-panel').parentElement.id,'inicio');
 assert.equal(document.querySelector('#profile-panel').hidden,true);
 assert.equal(document.body.classList.contains('profile-modal-open'),false);
 document.querySelector('#profile-toggle').click();
 document.querySelector('#profile-reminders').checked=false;
 document.querySelector('#profile-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));
 assert.equal(records.get('users/student').reminderEmails,false);
 assert.equal(document.querySelector('#profile-dialog').open,false);
 assert.equal(document.querySelector('#profile-panel').hidden,true);
 await authCallback({uid:'student',email:'student@example.com',displayName:'Alumno',emailVerified:true});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#profile-reminders').checked,false);

 const check=selector=>{const e=document.querySelector(selector);assert.ok(e,selector);e.checked=true;e.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 check('[data-day="'+week+'"]');
 check('[data-date="'+week+'"][data-shift="mediodia"]');
 check('[data-date="'+week+'"][data-shift="noche"]');
 assert.equal(document.querySelector('[data-field="diet"]').value,'Sin TACC');
 assert.equal(document.querySelector('#pending-reservation').hidden,false);
 document.querySelector('#save-button').click();await new Promise(r=>setImmediate(r));
 assert.equal(writes.filter(p=>p.startsWith('reservations/')).length,2);
 assert.equal(document.querySelector('#first-use').hidden,true);
 assert.equal(document.querySelector('#pending-reservation').hidden,true);
 assert.match(document.querySelector('#save-message').textContent,/confirmada/);
 const toggle=document.querySelector('[data-toggle-day="'+week+'"]');assert.ok(toggle);
 toggle.click();assert.equal(document.querySelector('#details-'+week).hidden,true);
 assert.equal(document.querySelector('[data-toggle-day="'+week+'"]').getAttribute('aria-expanded'),'false');
 document.querySelector('[data-toggle-day="'+week+'"]').click();
 assert.equal(document.querySelector('#details-'+week).hidden,false);
 assert.equal(writes.filter(p=>p.startsWith('reservations/')).length,2);
 const cancelButton=document.querySelector('[data-cancel-own]');assert.ok(cancelButton);
 const cancelledId=cancelButton.dataset.cancelOwn;
 cancelButton.click();await new Promise(r=>setImmediate(r));
 assert.equal(records.get('reservations/'+cancelledId).cancelled,true);
 assert.equal(document.querySelectorAll('[data-cancel-own]').length,1);
 assert.match(document.querySelector('#my-history').textContent,/Cancelada/);
 records.set('days/'+week,{week,blocked:true,generation:1});notify();
 records.set('users/admin',{name:'Admin',condition:'Personal',diet:'',email:domain.ADMIN_EMAIL||ADMIN_EMAIL});
 records.set('users/admin2',{name:'Laura',condition:'Personal',diet:'',email:'marchesemarialaura@gmail.com'});
 assert.match(document.querySelector('#my-history').textContent,/Cancelada por bloqueo/);
 await authCallback({uid:'admin',email:ADMIN_EMAIL,emailVerified:true,displayName:'Admin'});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#admin-nav').hidden,false);
 const originalCaption=document.querySelector('#week-caption').textContent;
 document.querySelector('#admin-week-next').click();
 const upcoming=management.shiftWeek(week,1);assert.equal(document.querySelector('#admin-week-date').value,upcoming);
 assert.equal(document.querySelector('#week-caption').textContent,originalCaption);
 document.querySelector('#activate-week').click();await new Promise(r=>setImmediate(r));
 assert.equal(records.get('days/'+upcoming).week,upcoming);
 assert.ok([...records].some(([p,r])=>p.startsWith('auditLogs/')&&r.event==='Habilitar semana'));
 document.querySelector('#admin-week-current').click();assert.equal(document.querySelector('#admin-week-date').value,week);
 document.querySelector('#admin-nav').click();assert.equal(document.querySelector('#admin-view').hidden,false);
 records.set('days/'+week,{week,blocked:false,generation:0});
 for(const [key,r]of records)if(key.startsWith('reservations/')&&r.uid==='student')records.set(key,{...r,cancelled:false});
 records.set('userActivity/student',{lastSeen:{seconds:1790856000,nanoseconds:0,toDate:()=>new Date('2026-10-01T12:00:00Z')}});notify();
 const markAttendance=checked=>{const control=document.querySelector('[data-attendance="student"]');assert.ok(control);control.checked=checked;control.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 markAttendance(true);await new Promise(r=>setImmediate(r));
 assert.equal(records.get('attendance/student_'+week).present,true);
 assert.equal(document.querySelectorAll('[data-attendance="student"]:checked').length,2);
 let studentRow=document.querySelector('[data-delete-user="student"]').closest('tr');assert.equal(studentRow.cells[3].textContent,'1');assert.match(studentRow.cells[2].textContent,/1\/10\/26/);
 markAttendance(false);await new Promise(r=>setImmediate(r));
 studentRow=document.querySelector('[data-delete-user="student"]').closest('tr');assert.equal(studentRow.cells[3].textContent,'0');

 await authCallback({uid:'admin2',email:'marchesemarialaura@gmail.com',emailVerified:true,displayName:'Laura'});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#admin-nav').hidden,false);
 await authCallback({uid:'fakeadmin2',email:'marchesemarialaura@gmail.com',emailVerified:false});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#admin-nav').hidden,true);
 document.querySelector('#users-list').textContent='Dato privado anterior';
 document.querySelector('#profile-name').value='Persona anterior';
 authCallback(null);await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#users-list').textContent,'');
 assert.equal(document.querySelector('#profile-name').value,'');
 records.set('users/student',{name:'<img src=x onerror=alert(1)>',condition:'Alumno regular',diet:'<script>alert(1)</script>',email:'student@example.com'});
 await authCallback({uid:'admin',email:ADMIN_EMAIL,emailVerified:true,displayName:'Admin'});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#users-list img'),null);
 assert.equal(document.querySelector('#users-list script'),null);
 assert.match(document.querySelector('#users-list').textContent,/<img src=x/);
 records.set('reservations/historical',{uid:'student',week:'2026-01-05',dateKey:'2026-01-05',shift:'mediodia',portions:1});
 document.querySelector('#download-backup').click();await new Promise(r=>setImmediate(r));
 assert.equal(capturedBackup.projectId,'appcomedor-6b4f7');
 assert.ok(capturedBackup.collections.reservations.some(r=>r.id==='historical'));
 assert.equal(Object.keys(capturedBackup.collections).length,9);
 capturedBackup=null;failBackupRead=true;document.querySelector('#download-backup').click();await new Promise(r=>setImmediate(r));
 assert.equal(capturedBackup,null);assert.match(document.querySelector('#backup-message').textContent,/No se pudo/);failBackupRead=false;
 document.querySelector('#user-search').value='sin coincidencias';document.querySelector('#user-search').dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(document.querySelector('[data-delete-user="student"]'),null);
 document.querySelector('#user-search').value='';document.querySelector('#user-search').dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 document.querySelector('#report-month').value=week.slice(0,7);document.querySelector('#monthly-generate').click();await new Promise(r=>setImmediate(r));assert.equal(document.querySelector('#monthly-csv').disabled,false);assert.match(document.querySelector('#monthly-results').textContent,/porciones solicitadas/);
 if(process.env.APP_UI_RENDER){document.querySelector('#admin-nav').click();fs.writeFileSync(process.env.APP_UI_RENDER,dom.serialize());}
 records.set('users/admin',{name:'Admin',condition:'Personal',diet:'',email:ADMIN_EMAIL});
 records.set('users/admin2',{name:'Laura',condition:'Personal',diet:'',email:'marchesemarialaura@gmail.com'});
 notify();
 assert.equal(document.querySelector('[data-delete-user="admin"]'),null);
 assert.equal(document.querySelector('[data-delete-user="admin2"]'),null);
 document.querySelector('[data-delete-user="student"]').click();await new Promise(r=>setImmediate(r));
 assert.equal(records.has('users/student'),false);
 assert.equal([...records].some(([p,r])=>p.startsWith('reservations/')&&r.uid==='student'),false);
 records.set('users/guest1',{name:'Uno',condition:'Alumno regular',diet:'',email:'uno@example.com'});
 records.set('users/guest2',{name:'Dos',condition:'Alumno regular',diet:'',email:'dos@example.com'});notify();
 document.querySelector('#delete-all-users').click();await new Promise(r=>setImmediate(r));
 assert.equal(records.has('users/guest1'),false);assert.equal(records.has('users/guest2'),false);
 assert.equal(records.has('users/admin'),true);assert.equal(records.has('users/admin2'),true);
 records.set('modalities/curso',{name:'Curso',dates:[week],active:true});notify();
 document.querySelector('[data-delete-modality="curso"]').click();await new Promise(r=>setImmediate(r));
 assert.equal(records.has('modalities/curso'),false);
 records.set('users/template-student',{name:'Plantilla',condition:'Alumno regular',diet:'Sin TACC',email:'template@example.com'});
 for(const date of domain.weekDays(week))records.set('days/'+date,{week,blocked:false,generation:0});notify();
 await authCallback({uid:'template-student',email:'template@example.com',emailVerified:true});await new Promise(r=>setImmediate(r));
 document.querySelector('#configure-template').click();assert.equal(document.querySelector('#week-template-dialog').open,true);
 document.querySelector('[data-template-day="1"][data-template-shift="mediodia"]').value='0';
 document.querySelector('[data-template-day="1"][data-template-shift="noche"]').value='2';
 document.querySelector('#week-template-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));
 assert.equal(records.get('reservationPreferences/template-student').schedule['1'].noche,2);
 document.querySelector('#apply-template').click();await new Promise(r=>setImmediate(r));assert.equal(document.querySelectorAll('[data-day]:checked').length,5);
 assert.equal([...records].filter(([p,r])=>p.startsWith('reservations/')&&r.uid==='template-student').length,0);
 document.querySelector('#save-button').click();await new Promise(r=>setImmediate(r));
 const savedTemplate=[...records].filter(([p,r])=>p.startsWith('reservations/')&&r.uid==='template-student').map(([,r])=>r);
 assert.equal(savedTemplate.length,10);assert.equal(savedTemplate.filter(r=>r.portions===2&&r.shift==='mediodia').length,4);
 assert.equal(savedTemplate.find(r=>r.dateKey===domain.weekDays(week)[1]&&r.shift==='noche').portions,2);
 document.querySelector('#configure-template').click();
 assert.equal(document.querySelector('[data-template-day="1"][data-template-shift="noche"]').value,'2');
 assert.equal(document.querySelector('[data-template-day="0"][data-template-shift="mediodia"]').value,'2');
 console.log('OK: eliminación individual, masiva, protección de ambos administradores y modalidad.');

 // No voy is saved immediately, survives login, suppresses template selection and can be removed.
 await authCallback({uid:'choice-student',email:'choice@example.com',emailVerified:true});await new Promise(r=>setImmediate(r));
 document.querySelector('#profile-name').value='Usuario decisiones';document.querySelector('#profile-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#student-view').hidden,false);assert.equal(document.querySelector('.profile-toolbar').hidden,false);assert(welcomeRequests.includes('choice-student'));assert.match(document.querySelector('#welcome-message').textContent,/Bienvenida enviada/);
 const choiceDate=domain.weekDays(week)[1];
 document.querySelector('[data-no-going="'+choiceDate+'"]').click();await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('[data-day="'+choiceDate+'"]').disabled,true);assert.equal(document.querySelector('[data-no-going="'+choiceDate+'"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(choices.get('choice-student'),[choiceDate]);assert.match(document.querySelector('#save-message').textContent,/No recibirás/);
 records.set('reservationPreferences/choice-student',{schedule:{'0':{mediodia:2,noche:0},'1':{mediodia:1,noche:1}}});notify();
 document.querySelector('#apply-template').click();await new Promise(r=>setImmediate(r));assert.equal(document.querySelector('[data-day="'+choiceDate+'"]').checked,false);assert.match(document.querySelector('#save-message').textContent,/marcaste No voy/);
 document.querySelector('[data-no-going="'+choiceDate+'"]').click();await new Promise(r=>setImmediate(r));assert.equal(document.querySelector('[data-day="'+choiceDate+'"]').disabled,false);assert.deepEqual(choices.get('choice-student'),[]);
 document.querySelector('[data-no-going="'+choiceDate+'"]').click();await new Promise(r=>setImmediate(r));
 await authCallback(null);await new Promise(r=>setImmediate(r));await authCallback({uid:'choice-student',email:'choice@example.com',emailVerified:true});await new Promise(r=>setImmediate(r));assert.equal(document.querySelector('[data-no-going="'+choiceDate+'"]').getAttribute('aria-pressed'),'true');

 await authCallback(null);await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelector('#welcome-screen').hidden,false);assert.equal(document.querySelector('#inicio').hidden,true);assert.equal(document.querySelector('.topbar').hidden,true);
 assert.equal(document.querySelector('#profile-name').value,'');assert.equal(document.querySelector('.menu-card img').hasAttribute('src'),false);
 assert.equal(listeners.some(x=>x.active&&x.ref.path.startsWith('menus/')),false);
 console.log('OK: UI sin sesión, rol alumno/admin, preferencias, ambos turnos, guardado y cancelación actualizada con SDK simulado.');
})().catch(e=>{console.error(e);process.exitCode=1});
