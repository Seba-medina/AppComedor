import test from 'node:test';import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';import {resolve} from 'node:path';
const root=new URL('../',import.meta.url),out=new URL('../public/',import.meta.url);
async function paths(dir,prefix=''){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=prefix+item.name;if(item.isDirectory())result.push(...await paths(new URL(item.name+'/',dir),path+'/'));else result.push(path);}return result;}
test('The published tree excludes configuration, archives and server-only code',async()=>{
 const files=await paths(out);
 for(const forbidden of ['firestore.rules','firebase.json','firestore.indexes.json','.firebaserc','firestore-completo-2026-10-05-correos.rules','server/email-job.mjs','scripts/restore-backup.mjs','tests/rules.cjs','package.json','package-lock.json','SECURITY.md','AppComedor-demo (1).zip'])assert.ok(!files.includes(forbidden),forbidden);
 assert.ok(!files.some(p=>/^(?:api|server|scripts|tests)\//.test(p)||/\.(?:rules|json|zip|log|md)$/.test(p)));
 for(const path of ['index.html','app.js','firebase.js','domain.mjs','backup.mjs','daily-pdf.mjs','week-template.mjs','privacidad.html','assets/logo-comedor.jpg'])assert.ok(files.includes(path),path);
 const config=JSON.parse(await readFile(new URL('vercel.json',root),'utf8'));assert.equal(config.outputDirectory,'public');assert.ok(config.functions['api/cron/*.js']);assert.equal(config.crons.length,2);
 for(const route of ['api/cron/reminders.js','api/cron/reservations.js','api/unsubscribe.js'])assert.ok((await stat(new URL(route,root))).isFile());
});
test('HTML and CSS file references resolve within public output',async()=>{
 for(const path of ['index.html','privacidad.html','styles.css']){
  const source=await readFile(new URL(path,out),'utf8');
  const matches=path.endsWith('.css')?[...source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)]:[...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)];
  for(const [,url] of matches){if(/^(?:https?:|data:|#)/.test(url)||url.startsWith('/api/'))continue;const target=resolve(new URL(out).pathname,url==='/'?'index.html':url.startsWith('/')?url.slice(1):url);assert.ok(target.startsWith(new URL(out).pathname),'Reference outside output');assert.ok((await stat(target)).isFile(),'Missing reference '+url);}
 }
});
