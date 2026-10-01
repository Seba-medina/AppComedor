const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const deps=createRequire(process.env.APP_TEST_DEPS || path.resolve('tests/package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=deps('@firebase/rules-unit-testing');
const {doc,setDoc:rawSetDoc,getDoc,getDocs,collection,query,where,Timestamp,serverTimestamp,writeBatch}=deps('firebase/firestore');
const assert=require('node:assert/strict');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-appcomedor',firestore:{rules:fs.readFileSync('firestore.rules','utf8'),host:'127.0.0.1',port:8080}});
 const claims=email=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
 const student=env.authenticatedContext('student',claims('student@example.com')).firestore();
 const other=env.authenticatedContext('other',claims('other@example.com')).firestore();
 const admin=env.authenticatedContext('admin',claims('sebastianezequielmedina@gmail.com')).firestore();
 const guest=env.unauthenticatedContext().firestore();
 const fakeAdmin=env.authenticatedContext('fake',{...claims('sebastianezequielmedina@gmail.com'),email_verified:false}).firestore();
 const future=new Date(Date.now()+86400000*7).toISOString().slice(0,10);
 const past=new Date(Date.now()-86400000).toISOString().slice(0,10);
 const cutoff=key=>Timestamp.fromDate(new Date(key+'T10:00:00-03:00'));
 const profile={name:'Alumno de prueba',condition:'Alumno regular',diet:'Sin TACC',email:'student@example.com',updatedAt:serverTimestamp()};
 const day=key=>({week:key,blocked:false,generation:0,cutoff:cutoff(key),reason:'',updatedBy:'admin',updatedAt:serverTimestamp()});
 const slot=(key,shift='mediodia',generation=0)=>({uid:'student',dateKey:key,week:key,shift,generation,portions:1,diet:'Sin TACC',name:profile.name,condition:profile.condition,modalityId:'',cancelled:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const id=(key,shift='mediodia',g=0)=>['student',key,shift,g].join('_');
 const setDoc=async(ref,data)=>{
  if(!ref.path.startsWith('reservations/'))return rawSetDoc(ref,data);
  const old=await getDoc(ref).catch(()=>null);if(old?.exists())data={...data,createdAt:old.data().createdAt};
  const otherId=[data.uid,data.dateKey,data.shift==='mediodia'?'noche':'mediodia',data.generation].join('_');
  const otherRef=doc(ref.firestore,'reservations',otherId),otherDoc=await getDoc(otherRef).catch(()=>null);
  if(otherDoc?.exists())return rawSetDoc(ref,data);
  const b=writeBatch(ref.firestore);b.set(ref,data);b.set(otherRef,{...data,shift:data.shift==='mediodia'?'noche':'mediodia',portions:0,modalityId:''});return b.commit();
 };

 try {
  await assertFails(setDoc(doc(guest,'users','student'),profile));
  await assertSucceeds(setDoc(doc(student,'users','student'),profile));
  await assertFails(setDoc(doc(student,'users','student'),{...profile,role:'admin'}));
  await assertFails(getDoc(doc(other,'users','student')));
  await assertSucceeds(getDoc(doc(admin,'users','student')));
  const admin2=env.authenticatedContext('admin2',claims('marchesemarialaura@gmail.com')).firestore();
  await assertSucceeds(getDoc(doc(admin2,'users','student')));
  const fake2=env.authenticatedContext('fake2',{...claims('marchesemarialaura@gmail.com'),email_verified:false}).firestore();
  await assertFails(getDoc(doc(fake2,'users','student')));
  await assertFails(setDoc(doc(student,'days',future),day(future)));
  await assertFails(setDoc(doc(fakeAdmin,'days',future),day(future)));
  await assertSucceeds(setDoc(doc(admin,'days',future),day(future)));
  await assertFails(setDoc(doc(admin,'days',future),{...day(future),cutoff:Timestamp.fromMillis(Date.now()+86400000*60)}));
  await assertSucceeds(setDoc(doc(student,'reservations',id(future)),slot(future)));
  await assertSucceeds(setDoc(doc(student,'reservations',id(future,'noche')),slot(future,'noche')));

  const swap=writeBatch(student);swap.set(doc(student,'reservations',id(future)),{portions:2,updatedAt:serverTimestamp()},{merge:true});swap.set(doc(student,'reservations',id(future,'noche')),{portions:0,updatedAt:serverTimestamp()},{merge:true});await assertSucceeds(swap.commit());
  const excessive=writeBatch(student);for(const shift of ['mediodia','noche'])excessive.set(doc(student,'reservations',id(future,shift)),{portions:2,updatedAt:serverTimestamp()},{merge:true});await assertFails(excessive.commit());
  const restore=writeBatch(student);for(const shift of ['mediodia','noche'])restore.set(doc(student,'reservations',id(future,shift)),{portions:1,updatedAt:serverTimestamp()},{merge:true});await assertSucceeds(restore.commit());
  await assertFails(setDoc(doc(student,'reservations','duplicado'),slot(future)));
  await assertFails(setDoc(doc(student,'reservations',id(future)),{...slot(future),portions:99}));
  await assertFails(setDoc(doc(student,'reservations',id(future)),{...slot(future),portions:2}));
  await assertFails(getDoc(doc(other,'reservations',id(future))));
  await assertSucceeds(getDocs(query(collection(student,'reservations'),where('uid','==','student'))));
  await assertFails(getDocs(collection(student,'reservations')));
  await assertSucceeds(getDocs(collection(admin,'reservations')));
  await assertSucceeds(setDoc(doc(admin,'days',past),day(past)));
  await assertFails(setDoc(doc(student,'reservations',id(past)),slot(past)));
  await assertSucceeds(setDoc(doc(admin,'days',future),{...day(future),blocked:true,generation:1}));
  await assertFails(setDoc(doc(student,'reservations',id(future)),slot(future)));
  await assertFails(setDoc(doc(student,'reservations',id(future,'mediodia',1)),slot(future,'mediodia',1)));
  await assertSucceeds(setDoc(doc(admin,'days',future),{...day(future),generation:1}));
  await assertFails(setDoc(doc(student,'reservations',id(future)),slot(future)));
  await assertSucceeds(setDoc(doc(student,'reservations',id(future,'mediodia',1)),slot(future,'mediodia',1)));
  await assertFails(setDoc(doc(admin,'days',future),day(future)));
  await assertFails(setDoc(doc(student,'reservations',id(future,'noche',1)),{...slot(future,'noche',1),modalityId:'inexistente'}));
  await assertSucceeds(setDoc(doc(admin,'modalities','curso'),{name:'Curso',dates:[future],active:true,updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(doc(student,'reservations',id(future,'noche',1)),{...slot(future,'noche',1),modalityId:'curso'}));
  await assertFails(setDoc(doc(student,'menus',future),{image:'data:image/png;base64,YQ==',updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(doc(admin,'menus',future),{image:'data:image/png;base64,YQ==',updatedAt:serverTimestamp()}));
  assert.equal((await getDocs(query(collection(admin,'reservations'),where('week','==',future)))).size,4);
  const weeklyUser=env.authenticatedContext('weekly',claims('weekly@example.com')).firestore();
  await assertSucceeds(setDoc(doc(weeklyUser,'users','weekly'),{...profile,email:'weekly@example.com'}));
  const batch=writeBatch(weeklyUser);
  for(let i=0;i<5;i++){
    const key=new Date(new Date(future+'T00:00:00Z').getTime()+i*86400000).toISOString().slice(0,10);
    if(i)await assertSucceeds(setDoc(doc(admin,'days',key),{...day(key),week:future}));
    const generation=i?0:1;
    for(const shift of ['mediodia','noche']){
      const r={...slot(key,shift,generation),uid:'weekly',week:future};
      batch.set(doc(weeklyUser,'reservations',['weekly',key,shift,generation].join('_')),r);
    }
  }
  await assertSucceeds(batch.commit());
  assert.equal((await getDocs(query(collection(weeklyUser,'reservations'),where('uid','==','weekly')))).size,10);
  console.log('OK: reglas compiladas; autenticación, permisos, perfiles, turnos, duplicados, hora, bloqueo, historial, modalidades y menú comprobados.');
 } finally { await env.cleanup(); }
})().catch(e=>{console.error(e);process.exitCode=1});
