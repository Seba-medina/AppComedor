import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
// Configuración pública del cliente. Los permisos están en firestore.rules.
const app=initializeApp({
  apiKey:'AIzaSyDr0mW80naPHjm89YYFYdyJcg1uhmpNFT4',
  authDomain:'appcomedor-6b4f7.firebaseapp.com',
  projectId:'appcomedor-6b4f7',
  storageBucket:'appcomedor-6b4f7.firebasestorage.app',
  messagingSenderId:'258857082564',
  appId:'1:258857082564:web:077fd0da43f87dbdecf391'
});
export const auth=getAuth(app), db=getFirestore(app);
