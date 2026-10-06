import {readFile,copyFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {resolve,dirname} from 'node:path';
import {adminClaimClients} from './admin-claims-client.mjs';import {manageAdminClaims} from './admin-claims-core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const allowed=new Set(['app.js','domain.mjs','management.mjs','firestore.rules','firestore-completo-2026-10-05-correos.rules','server/notifications.mjs','server/email-test.mjs','server/email-job.mjs']);
try{
 const {auth,db}=await adminClaimClients(),roles=await manageAdminClaims(auth,db,'check');if(roles.some(r=>!r.claim||!r.protected))throw new Error('Both verified admin roles are required');
 const manifest=JSON.parse(await readFile(resolve(root,'security/claims/manifest.json'),'utf8'));
 for(const file of manifest){if(!allowed.has(file.target)||file.source!=='security/claims/'+(file.target.startsWith('firestore-completo')?'firestore.rules':file.target))throw new Error('Unexpected migration path');const source=await readFile(resolve(root,file.target));const sha=createHash('sha1').update('blob '+source.length+'\0').update(source).digest('hex');if(sha!==file.originalBlobSha)throw new Error('Source changed; regenerate migration before applying: '+file.target);await readFile(resolve(root,file.source));}
 const backup=resolve(root,'.claims-migration-backup');
 for(const file of manifest){await mkdir(dirname(resolve(backup,file.target)),{recursive:true});await copyFile(resolve(root,file.target),resolve(backup,file.target));await copyFile(resolve(root,file.source),resolve(root,file.target));}
 console.log('Local migration prepared. Publish the new Firestore rules after refreshing both admin sessions; then commit/push the client. Full emulator and UI checks are required first. No remote deployment performed by this command.');
}catch(error){console.error('Migration preparation failed:',error.code||error.message);process.exitCode=1;}
