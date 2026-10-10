import {appCheck} from './firebase.js';
export async function studentRequest(user,path,body){
 if(!user)throw new Error('Iniciá sesión para continuar.');
 const token=await user.getIdToken(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const attestation=appCheck?(await (await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js')).getToken(appCheck)).token:null;
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(attestation?{'X-Firebase-AppCheck':attestation}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'No pudimos guardar el cambio. Intentá nuevamente.');
  return result;
 }catch(error){if(error.name==='AbortError')throw new Error('No se pudo confirmar el resultado. Revisá el estado antes de volver a intentar.');throw error;}
 finally{clearTimeout(timer);}
}
