import {timingSafeEqual} from 'node:crypto';
export function validCronAuth(value){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return false;
 const a=Buffer.from(typeof value==='string'?value:''),b=Buffer.from('Bearer '+secret);
 return a.length===b.length&&timingSafeEqual(a,b);
}
