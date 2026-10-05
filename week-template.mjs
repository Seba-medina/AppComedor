import {deadline,SHIFTS,reservationId} from './domain.mjs';
export function validateTemplate(value){
 if(!Array.isArray(value.days)||!value.days.length||value.days.length>5||new Set(value.days).size!==value.days.length||value.days.some(n=>!Number.isInteger(n)||n<0||n>4))throw new Error('Elegí al menos un día de lunes a viernes.');
 if(SHIFTS.some(s=>!Number.isInteger(value[s])||value[s]<0||value[s]>2)||value.mediodia+value.noche<1||value.mediodia+value.noche>2)throw new Error('Elegí entre 1 y 2 porciones por día, sumando ambos turnos.');
 return {days:[...value.days].sort(),mediodia:value.mediodia,noche:value.noche};
}
export function applyWeekTemplate(template,dates,days,records,uid,profile,selection,now=new Date()){
 const config=validateTemplate(template),next=new Map(selection),applied=[],skipped=[];
 for(const i of config.days){const date=dates[i],day=days[date];let reason=!day?'sin habilitar':day.blocked?'bloqueado':now>=deadline(date)?'plazo cerrado':'';
 if(!reason&&SHIFTS.some(s=>config[s]>0&&records.find(r=>r.id===reservationId(uid,date,s,day.generation))?.cancelled))reason='turno cancelado';
 if(reason){skipped.push({date,reason});continue;}
 const turns={};for(const shift of SHIFTS)if(config[shift]){const old=records.find(r=>r.id===reservationId(uid,date,shift,day.generation)&&r.portions>0&&!r.cancelled);turns[shift]={portions:config[shift],diet:old?.diet??profile.diet,modalityId:old?.modalityId||''};}
 next.set(date,turns);applied.push(date);
 }
 return {selection:next,applied,skipped};
}
