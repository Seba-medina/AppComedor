import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
if(args.some(a=>a!=='--apply'))throw new Error('Uso: node scripts/configure-backups.mjs [--apply]');
const common=['--project','appcomedor-6b4f7','--database','(default)'];
const run=a=>{const result=spawnSync(process.platform==='win32'?'firebase.cmd':'firebase',a,{stdio:'inherit',shell:false});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);};
console.log('Consultando programación existente de respaldos.');
run(['firestore:backups:schedules:list',...common]);
if(args.includes('--apply')){
 console.log('Solicitando respaldo diario con retención de 14 días. No se modifica ni elimina una programación existente.');
 run(['firestore:backups:schedules:create',...common,'--recurrence','DAILY','--retention','14d']);
 run(['firestore:backups:schedules:list',...common]);
}else console.log('Solo consulta. Revisá las programaciones y usá --apply únicamente si todavía no existe un respaldo diario.');
