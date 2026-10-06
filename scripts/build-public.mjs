import {copyFile,mkdir,readdir,readFile,rm,lstat} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'public');
export const PUBLIC_FILES=['index.html','app.js','firebase.js','app-check-config.js','styles.css','tutorial.js','domain.mjs','management.mjs','backup.mjs','daily-pdf.mjs','week-template.mjs','student-api.mjs','privacidad.html','menu-semanal.jpg'];
async function copy(source,destination){const stat=await lstat(source);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Only regular public files may be copied');await mkdir(dirname(destination),{recursive:true});await copyFile(source,destination);}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of PUBLIC_FILES)await copy(resolve(root,path),resolve(out,path));
async function images(dir){
 for(const item of await readdir(resolve(root,dir),{withFileTypes:true})){
  if(item.name.startsWith('.')||item.isSymbolicLink())continue;
  const path=dir+'/'+item.name;
  if(item.isDirectory())await images(path);
  else if(item.isFile()&&/\.(?:png|jpe?g|webp|gif|ico)$/i.test(item.name))await copy(resolve(root,path),resolve(out,path));
 }
}
await images('assets');
// Every local module import must remain inside the public output and exist.
for(const path of PUBLIC_FILES.filter(p=>/\.(?:js|mjs)$/.test(p))){
 const source=await readFile(resolve(out,path),'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){
  const specifier=match[1];if(specifier.startsWith('https://'))continue;
  if(!specifier.startsWith('./')&&!specifier.startsWith('../'))throw new Error('Unsupported client import in '+path);
  const target=resolve(dirname(resolve(out,path)),specifier);
  if(!target.startsWith(out+sep))throw new Error('Client import escapes public directory');
  const stat=await lstat(target);if(!stat.isFile())throw new Error('Missing public import: '+relative(out,target));
 }
}
console.log('Public output built from an explicit allowlist; internal configuration, server source, tests and archives excluded.');
