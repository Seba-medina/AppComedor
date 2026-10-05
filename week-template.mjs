import {deadline,SHIFTS,reservationId} from './domain.mjs';
export function validateTemplate(value){
 let schedule=value?.schedule;
 if(schedule===undefined){
  if(!Array.isArray(value?.days)||!value.days.length||value.days.length>5||new Set(value.days).size!==value.days.length||value.days.some(n=>!Number.isInteger(n)||n<0||n>4))throw new Error('Elegí al menos un día de lunes a viernes.');
  schedule=Object.fromEntries(value.days.map(i=>[String(i),{mediodia:value.mediodia,noche:value.noche}]));
 }
 if(!schedule||Array.isArray(schedule)||typeof schedule!=='object'||!Object.keys(schedule).length||Object.keys(schedule).some(i=>!['0','1','2','3','4'].includes(i)))throw new Error('Elegí al menos un día de lunes a viernes.');
 const clean={};
 for(const [i,day] of Object.entries(schedule)){
  if(!day||SHIFTS.some(s=>!Number.isInteger(day[s])||day[s]<0||day[s]>2)||day.mediodia+day.noche<1||day.mediodia+day.noche>2)throw new Error(['Lunes','Martes','Miércoles','Jueves','Viernes'][i]+': elegí entre 1 y 2 porciones, sumando ambos turnos.');
  clean[i]={mediodia:day.mediodia,noche:day.noche};
 }
 return {schedule:clean};
}
export function applyWeekTemplate(template,dates,days,records,uid,profile,selection,now=new Date()){
 const config=validateTemplate(template),next=new Map(selection),applied=[],skipped=[];
 for(const [i,portions] of Object.entries(config.schedule)){const date=dates[Number(i)],day=days[date];let reason=!day?'sin habilitar':day.blocked?'bloqueado':now>=deadline(date)?'plazo cerrado':'';
 if(!reason&&SHIFTS.some(s=>portions[s]>0&&records.find(r=>r.id===reservationId(uid,date,s,day.generation))?.cancelled))reason='turno cancelado';
 if(reason){skipped.push({date,reason});continue;}
 const turns={};for(const shift of SHIFTS)if(portions[shift]){const old=records.find(r=>r.id===reservationId(uid,date,shift,day.generation)&&r.portions>0&&!r.cancelled);turns[shift]={portions:portions[shift],diet:old?.diet??profile.diet,modalityId:old?.modalityId||''};}
 next.set(date,turns);applied.push(date);
 }
 return {selection:next,applied,skipped};
}
