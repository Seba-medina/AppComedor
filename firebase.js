import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {RECAPTCHA_ENTERPRISE_SITE_KEY} from './app-check-config.js';
// Configuración pública del cliente. Los permisos están en firestore.rules.
const app=initializeApp({
  apiKey:'AIzaSyDr0mW80naPHjm89YYFYdyJcg1uhmpNFT4',
  authDomain:'appcomedor-6b4f7.firebaseapp.com',
  projectId:'appcomedor-6b4f7',
  storageBucket:'appcomedor-6b4f7.firebasestorage.app',
  messagingSenderId:'258857082564',
  appId:'1:258857082564:web:077fd0da43f87dbdecf391'
});
// Inicializar antes de Auth/Firestore; activar enforcement solo tras verificar métricas.
let appCheck=null;
if(RECAPTCHA_ENTERPRISE_SITE_KEY){
  const {initializeAppCheck,ReCaptchaEnterpriseProvider}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js');
  appCheck=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),isTokenAutoRefreshEnabled:true});
}
export {appCheck};
export const auth=getAuth(app), db=getFirestore(app);
