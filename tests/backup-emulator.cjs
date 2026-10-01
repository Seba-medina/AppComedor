const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
(async()=>{
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw new Error('Esta prueba solo admite el emulador local.');
 const deps=createRequire(process.env.BACKUP_ADMIN_DEPS||path.resolve('scripts/package.json'));
 const {initializeApp,deleteApp}=deps('firebase-admin/app'),{getFirestore,Timestamp}=deps('firebase-admin/firestore');
 const app=initializeApp({projectId:'demo-appcomedor'},'backup-test'),db=getFirestore(app);
 const {BACKUP_COLLECTIONS,buildBackup,validateBackup}=await import('../backup.mjs');
 const {restoreMissing}=await import('../scripts/restore-backup.mjs');
 try{
  const stamp=new Timestamp(1700000000,987654321);
  await db.doc('users/backup-student').set({name:'María',updatedAt:stamp});
  await db.doc('users/backup-other').set({name:'Otro'});
  await db.doc('reservations/backup-historical').set({uid:'backup-student',dateKey:'2026-01-05',portions:2,createdAt:stamp});
  await db.doc('days/2026-01-05').set({cutoff:stamp,blocked:false});
  await db.doc('menus/2026-01-05').set({image:'data:image/png;base64,YQ=='});
  await db.doc('modalities/backup-course').set({name:'Curso',dates:['2026-01-05']});
  const snapshots=Object.fromEntries(await Promise.all(BACKUP_COLLECTIONS.map(async n=>[n,await db.collection(n).get()])));
  const backup=validateBackup(JSON.parse(JSON.stringify(buildBackup(snapshots))));
  await db.doc('users/backup-student').delete();await db.doc('users/backup-other').delete();await db.doc('reservations/backup-historical').delete();
  await db.doc('menus/2026-01-05').set({image:'más reciente'});
  const options={makeTimestamp:(s,n)=>new Timestamp(s,n)};
  const dry=await restoreMissing(db,backup,options);assert.equal(dry.missing,3);assert.equal((await db.doc('users/backup-student').get()).exists,false);
  const single=await restoreMissing(db,backup,{...options,apply:true,uid:'backup-student'});assert.equal(single.restored,2);
  assert.equal((await db.doc('users/backup-other').get()).exists,false);
  const recovered=(await db.doc('users/backup-student').get()).data();assert.equal(recovered.name,'María');assert.equal(recovered.updatedAt.nanoseconds,backup.collections.users.find(r=>r.id==='backup-student').data.updatedAt.nanoseconds);
  const full=await restoreMissing(db,backup,{...options,apply:true});assert.equal(full.restored,1);
  assert.equal((await db.doc('menus/2026-01-05').get()).data().image,'más reciente');
  assert.equal((await restoreMissing(db,backup,{...options,apply:true})).restored,0);
  console.log('OK: respaldo JSON y recuperación real en emulador, fechas exactas, simulación, persona individual y preservación de datos existentes.');
 }finally{await db.terminate();await deleteApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1});
