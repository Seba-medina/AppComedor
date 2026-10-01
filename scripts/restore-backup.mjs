import {validateBackup,decodeBackupValue,BACKUP_COLLECTIONS,BACKUP_PROJECT} from '../backup.mjs';
import {pathToFileURL} from 'node:url';
// Missing documents only; transaction reads avoid overwriting a document recreated during recovery.
export async function restoreMissing(db,backup,{apply=false,uid=null,makeTimestamp}={}){
  validateBackup(backup);
  const summary={missing:0,existing:0,restored:0};
  for(const name of BACKUP_COLLECTIONS)for(const row of (backup.collections[name]||[])){
    if(uid&&!(['users','userActivity'].includes(name)&&row.id===uid||['reservations','attendance'].includes(name)&&row.data.uid===uid))continue;
    const ref=db.collection(name).doc(row.id),data=decodeBackupValue(row.data,makeTimestamp);
    if(!apply){if((await ref.get()).exists)summary.existing++;else summary.missing++;continue;}
    const created=await db.runTransaction(async tx=>{if((await tx.get(ref)).exists)return false;tx.create(ref,data);return true;});
    if(created){summary.missing++;summary.restored++;}else summary.existing++;
  }
  return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const args=process.argv.slice(2),file=args[0];
    if(!file)throw new Error('Uso: node scripts/restore-backup.mjs archivo.json [--uid UID] [--apply]');
    const flags=args.slice(1);for(let i=0;i<flags.length;i++){if(flags[i]==='--uid'){if(!flags[++i]||flags[i].startsWith('--'))throw new Error('Falta UID');}else if(flags[i]!=='--apply')throw new Error('Opción desconocida: '+flags[i]);}
    const uidIndex=args.indexOf('--uid'),uid=uidIndex>=0?args[uidIndex+1]:null;
    const {readFile}=await import('node:fs/promises'),backup=validateBackup(JSON.parse(await readFile(file,'utf8')));
    const {initializeApp,applicationDefault}=await import('firebase-admin/app');
    const {getFirestore,Timestamp}=await import('firebase-admin/firestore');
    initializeApp({projectId:BACKUP_PROJECT,credential:applicationDefault()});
    console.log(args.includes('--apply')?'Recuperando solo documentos faltantes…':'SIMULACIÓN: no se modificará ningún dato.');
    console.log(await restoreMissing(getFirestore(),backup,{apply:args.includes('--apply'),uid,makeTimestamp:(s,n)=>new Timestamp(s,n)}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
