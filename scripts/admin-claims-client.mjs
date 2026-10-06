import {applicationDefault,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';import {getFirestore} from 'firebase-admin/firestore';
import {readFile} from 'node:fs/promises';
export async function adminClaimClients(){
 const projectId='appcomedor-6b4f7';
 if(process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Production migration cannot use emulators');
 if(process.env.GOOGLE_APPLICATION_CREDENTIALS){const credentials=JSON.parse(await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));if(credentials.project_id&&credentials.project_id!==projectId)throw new Error('Credential project mismatch');}
 const app=initializeApp({projectId,credential:applicationDefault()},'admin-claims-tool');return {auth:getAuth(app),db:getFirestore(app)};
}
