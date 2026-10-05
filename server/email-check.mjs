import {randomUUID} from 'node:crypto';
import {adminDb} from './firebase-admin.mjs';
import {gmailConfigured,verifyGmail} from './gmail.mjs';
import {validCronAuth} from './cron-auth.mjs';
export async function emailCheck(req,res,{getDb=adminDb,verify=verifyGmail}={}){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!validCronAuth(req.headers.authorization))return res.status(401).json({error:'Unauthorized'});
 const result={ok:false,configuration:'ok',firebase:'not_checked',gmail:'not_checked',enabled:process.env.EMAIL_JOBS_ENABLED==='true'};
 if(process.env.EMAIL_TRANSPORT!=='gmail'||!gmailConfigured()||!process.env.FIREBASE_SERVICE_ACCOUNT_JSON||!process.env.UNSUBSCRIBE_SECRET||process.env.UNSUBSCRIBE_SECRET.length<32){result.configuration='missing_or_invalid';return res.status(200).json(result);}
 let probe;
 try{
  probe=getDb().collection('emailJobLocks').doc('check_'+randomUUID());
  await probe.create({until:0,purpose:'connection-check'});
  const s=await probe.get();if(!s.exists)throw new Error('Probe unavailable');
  await probe.delete();probe=null;result.firebase='ok';
 }catch(err){result.firebase=Number(err.code)===7?'permission_denied':'connection_failed';}
 finally{if(probe)await probe.delete().catch(()=>{});}
 try{await verify();result.gmail='ok';}catch(err){result.gmail=err.code==='EAUTH'?'authentication_failed':'connection_failed';}
 result.ok=result.firebase==='ok'&&result.gmail==='ok';
 // No user records, private keys, tokens, SMTP responses or passwords returned.
 return res.status(200).json(result);
}
