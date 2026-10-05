import nodemailer from 'nodemailer';
import {createHash} from 'node:crypto';
export const GMAIL_SENDER='comedorunerfcal@gmail.com';
export function gmailConfigured(){return process.env.GMAIL_USER===GMAIL_SENDER&&/^[a-zA-Z0-9]{16}$/.test((process.env.GMAIL_APP_PASSWORD||'').replace(/\s/g,''));}
export function gmailOptions(){
 if(!gmailConfigured())throw new Error('Gmail server configuration missing');
 return {host:'smtp.gmail.com',port:465,secure:true,auth:{user:GMAIL_SENDER,pass:process.env.GMAIL_APP_PASSWORD.replace(/\s/g,'')},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,tls:{minVersion:'TLSv1.2'}};
}
export async function sendGmail(payload,key){
 const transporter=nodemailer.createTransport(gmailOptions());
 try{
  const result=await transporter.sendMail({...payload,from:'Comedor UNER <'+GMAIL_SENDER+'>',messageId:'<'+createHash('sha256').update(key).digest('hex')+'.appcomedor@gmail.com>',attachments:payload.attachments?.map(a=>({filename:a.filename,content:Buffer.from(a.content,'base64'),contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))});
  if(!result.accepted?.length)throw new Error('Gmail did not accept recipient');return result;
 }finally{transporter.close();}
}

export async function verifyGmail(){
 const transporter=nodemailer.createTransport(gmailOptions());
 try{return await transporter.verify();}finally{transporter.close();}
}
