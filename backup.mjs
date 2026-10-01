export const BACKUP_PROJECT='appcomedor-6b4f7';
export const BACKUP_COLLECTIONS=['users','days','modalities','menus','reservations','attendance','userActivity'];
export function encodeBackupValue(value){
  if(value&&typeof value.toDate==='function'&&Number.isInteger(value.seconds)&&Number.isInteger(value.nanoseconds))return {$type:'timestamp',seconds:value.seconds,nanoseconds:value.nanoseconds};
  if(Array.isArray(value))return value.map(encodeBackupValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encodeBackupValue(v)]));
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
  throw new Error('Un dato no se pudo incluir en la copia. No se descargó un respaldo incompleto.');
}
export function decodeBackupValue(value,makeTimestamp){
  if(value&&value.$type==='timestamp'){
    if(Object.keys(value).length!==3||!Number.isInteger(value.seconds)||!Number.isInteger(value.nanoseconds)||value.nanoseconds<0||value.nanoseconds>=1e9)throw new Error('Fecha inválida en el respaldo.');
    return makeTimestamp(value.seconds,value.nanoseconds);
  }
  if(Array.isArray(value))return value.map(v=>decodeBackupValue(v,makeTimestamp));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decodeBackupValue(v,makeTimestamp)]));
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
  throw new Error('Dato inválido en el respaldo.');
}
export function buildBackup(snapshots,now=new Date()){
  const collections=Object.fromEntries(BACKUP_COLLECTIONS.map(name=>[name,snapshots[name].docs.map(d=>({id:d.id,data:encodeBackupValue(d.data())}))]));
  return {format:'appcomedor-backup',version:2,projectId:BACKUP_PROJECT,createdAt:now.toISOString(),collections};
}
export function validateBackup(backup){
  if(backup?.format!=='appcomedor-backup'||![1,2].includes(backup.version)||backup.projectId!==BACKUP_PROJECT||!Number.isFinite(Date.parse(backup.createdAt)))throw new Error('El archivo no es un respaldo válido de este comedor.');
  const names=backup.version===1?BACKUP_COLLECTIONS.slice(0,5):BACKUP_COLLECTIONS;
  if(!backup.collections||Object.keys(backup.collections).length!==names.length)throw new Error('Respaldo incompleto.');
  for(const name of names){
    const rows=backup.collections[name],ids=new Set();if(!Array.isArray(rows))throw new Error('Falta la colección '+name);
    for(const row of rows){if(typeof row.id!=='string'||!row.id||row.id.includes('/')||ids.has(row.id)||!row.data||typeof row.data!=='object'||Array.isArray(row.data))throw new Error('Documento inválido o repetido en '+name);ids.add(row.id);decodeBackupValue(row.data,()=>null);}
  }
  return backup;
}
export function downloadBackup(backup){
  validateBackup(backup);
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='respaldo-comedor-'+backup.createdAt.replace(/[:.]/g,'-')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
