import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '../server/firebase-admin.mjs';
import {tokenUid,htmlEscape} from '../server/notifications.mjs';
export default async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Type','text/html; charset=utf-8');
 const secret=process.env.UNSUBSCRIBE_SECRET;if(!secret||secret.length<32)return res.status(503).send('La configuración de notificaciones no está disponible. Contactá al comedor.');
 const token=req.query.token,uid=tokenUid(token,secret);if(!uid)return res.status(400).send('El enlace no es válido. Podés cambiar las notificaciones desde Mi perfil.');
 if(!['GET','POST'].includes(req.method))return res.status(405).send('Método no permitido.');
 let message;
 if(req.method==='POST'){
  try{const ref=adminDb().collection('users').doc(uid);await adminDb().runTransaction(async tx=>{const s=await tx.get(ref);if(s.exists)tx.update(ref,{reminderEmails:false,updatedAt:FieldValue.serverTimestamp()});});message='<h1>Recordatorios desactivados</h1><p>Podés volver a activarlos desde Mi perfil.</p>';}
  catch{ return res.status(503).send('No pudimos guardar el cambio. Intentá nuevamente o contactá al comedor.');}
 }else message='<h1>Desactivar recordatorios</h1><p>Dejarás de recibir los avisos para reservar. Tus reservas se conservan.</p><form method="post" action="/api/unsubscribe?token='+htmlEscape(encodeURIComponent(token))+'"><button type="submit">Desactivar recordatorios</button></form>';
 return res.status(200).send('<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Notificaciones · Comedor</title><link rel="stylesheet" href="/styles.css"></head><body><main class="card settings-card">'+message+'<p><a href="/">Volver al comedor</a></p></main></body></html>');
}
