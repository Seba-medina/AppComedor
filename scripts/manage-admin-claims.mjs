import {manageAdminClaims} from './admin-claims-core.mjs';import {adminClaimClients} from './admin-claims-client.mjs';
const mode=process.argv[2]||'check';
try{
 if(!['check','grant'].includes(mode))throw new Error('Usage: check|grant');
 const {auth,db}=await adminClaimClients(),results=await manageAdminClaims(auth,db,mode);console.table(results);
 if(results.some(r=>!r.claim||!r.protected)){console.error('Migration NOT ready. Keep current rules and client.');process.exitCode=2;}
 else console.log('Both roles verified. Sign out and in to refresh tokens before publishing new rules.');
}catch(error){console.error('Role operation failed:',error.code||'Check credentials, verified accounts and IAM permissions.');process.exitCode=1;}
