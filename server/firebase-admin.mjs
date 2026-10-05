import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
export function adminDb(){
 if(!getApps().length){
  const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');
  if(!account||account.project_id!=='appcomedor-6b4f7')throw new Error('Firebase server configuration missing');
  initializeApp({credential:cert(account),projectId:account.project_id});
 }
 return getFirestore();
}
