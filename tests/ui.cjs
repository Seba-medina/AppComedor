const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const deps=createRequire(process.env.APP_TEST_DEPS||path.resolve('tests/package.json'));
const {JSDOM}=deps('jsdom');
(async()=>{
 const domain=await import('../domain.mjs');
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://appomedoruner.vercel.app'});
 const document=dom.window.document,records=new Map(),listeners=[],writes=[];
 let authCallback;
 const next=new Date(domain.monday()+'T00:00:00Z');next.setUTCDate(next.getUTCDate());
 const week=next.toISOString().slice(0,10);
 const ref=(...args)=>({path:args.filter(x=>typeof x==='string').join('/')});
 const snapshot=r=>{
  if(r.filter){const list=[...records].filter(([p,d])=>p.startsWith(r.path+'/')&&(!r.field||d[r.field]===r.value));return {docs:list.map(([p,d])=>({id:p.split('/').at(-1),data:()=>d}))};}
  const data=records.get(r.path);return {exists:()=>!!data,data:()=>data};
 };
 const notify=()=>listeners.filter(x=>x.active).forEach(x=>x.cb(snapshot(x.ref)));
 const set=async(r,d,opts)=>{records.set(r.path,opts?.merge?{...records.get(r.path),...d}:d);writes.push(r.path);notify();};
 const ctx=vm.createContext({document,console,Date:class extends Date{constructor(...args){super(...(args.length?args:[week+'T09:00:00-03:00']));}static now(){return new Date(week+'T09:00:00-03:00').getTime();}},Map,Number,Object,String,JSON,Intl,Promise,...domain,validateSelections:(selected,days,profile)=>domain.validateSelections(selected,days,profile,new Date(week+'T09:00:00-03:00')),
  auth:{},db:{},GoogleAuthProvider:class{setCustomParameters(){}},
  signInWithPopup:async()=>{},signOut:async()=>authCallback(null),onAuthStateChanged:(a,cb)=>{authCallback=cb;cb(null);},
  doc:ref,collection:(...args)=>({...ref(...args),filter:true}),query:(r,w)=>({...r,field:w.field,value:w.value}),where:(field,op,value)=>({field,value}),
  onSnapshot:(r,cb)=>{const x={ref:r,cb,active:true};listeners.push(x);cb(snapshot(r));return()=>x.active=false;},
  getDoc:async r=>snapshot(r),getDocs:async r=>snapshot(r),setDoc:set,deleteDoc:async r=>{records.delete(r.path);notify();},
  writeBatch:()=>{const pending=[];return {set:(r,d)=>pending.push([r,d]),delete:r=>pending.push([r,null]),commit:async()=>{for(const [r,d]of pending){if(d===null){records.delete(r.path);notify();}else await set(r,d);}}};},
  runTransaction:async(db,fn)=>fn({get:async r=>snapshot(r),update:set}),
  serverTimestamp:()=>({server:true}),Timestamp:{fromDate:d=>d},setInterval(){},confirm:()=>true,prompt:()=>'',FileReader:dom.window.FileReader
 });
 vm.runInContext(fs.readFileSync('app.js','utf8').replace(/^import .*;\n/gm,''),ctx);
 assert.equal(document.querySelector('#admin-nav').hidden,true);
 assert.equal(document.querySelector('#login-button').hidden,false);
 assert.equal(document.querySelector('#first-use').hidden,false);
 assert.equal(document.querySelector('#first-use-action').textContent,'Ingresar con Google');
 assert.equal(document.querySelector('#week-input'),null);
 assert.equal(document.querySelector('#profile-panel').hidden,true);
 document.querySelector('#profile-toggle').click();assert.equal(document.querySelector('#profile-panel').hidden,false);
 document.querySelector('#profile-toggle').click();assert.equal(document.querySelector('#profile-panel').hidden,true);
 assert.equal(document.querySelector('.sidebar').firstElementChild.className,'menu-card');
 authCallback({uid:'student',email:'student@example.com',displayName:'Alumno',emailVerified:true});
 assert.equal(document.querySelector('#first-use-action').textContent,'Completar mi perfil');
 records.set('users/student',{name:'Alumno',condition:'Alumno regular',diet:'Sin TACC',email:'student@example.com'});
 for(const date of domain.weekDays(week))records.set('days/'+date,{week,blocked:false,generation:0});
 authCallback({uid:'student',email:'student@example.com',displayName:'Alumno',emailVerified:true});
 assert.equal(document.querySelector('#admin-nav').hidden,true);
 assert.equal(document.querySelector('#profile-form').hidden,false);
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
 records.set('days/'+week,{week,blocked:true,generation:1});notify();
 assert.match(document.querySelector('#my-history').textContent,/Cancelada por bloqueo/);
 authCallback({uid:'admin',email:domain.ADMIN_EMAIL,emailVerified:true,displayName:'Admin'});
 assert.equal(document.querySelector('#admin-nav').hidden,false);
 document.querySelector('#admin-nav').click();assert.equal(document.querySelector('#admin-view').hidden,false);
 authCallback({uid:'admin2',email:'marchesemarialaura@gmail.com',emailVerified:true,displayName:'Laura'});
 assert.equal(document.querySelector('#admin-nav').hidden,false);
 authCallback({uid:'fakeadmin2',email:'marchesemarialaura@gmail.com',emailVerified:false});
 assert.equal(document.querySelector('#admin-nav').hidden,true);
 document.querySelector('#users-list').textContent='Dato privado anterior';
 document.querySelector('#profile-name').value='Persona anterior';
 authCallback(null);
 assert.equal(document.querySelector('#users-list').textContent,'');
 assert.equal(document.querySelector('#profile-name').value,'');
 records.set('users/student',{name:'<img src=x onerror=alert(1)>',condition:'Alumno regular',diet:'<script>alert(1)</script>',email:'student@example.com'});
 authCallback({uid:'admin',email:domain.ADMIN_EMAIL,emailVerified:true,displayName:'Admin'});
 assert.equal(document.querySelector('#users-list img'),null);
 assert.equal(document.querySelector('#users-list script'),null);
 assert.match(document.querySelector('#users-list').textContent,/<img src=x/);
 records.set('users/admin',{name:'Admin',condition:'Personal',diet:'',email:domain.ADMIN_EMAIL});
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
 console.log('OK: eliminación individual, masiva, protección de ambos administradores y modalidad.');
 console.log('OK: UI sin sesión, rol alumno/admin, preferencias, ambos turnos, guardado y cancelación actualizada con SDK simulado.');
})().catch(e=>{console.error(e);process.exitCode=1});
