import {reservationStatus} from './domain.mjs';
export const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterUsers(users,search='',condition='',role='',admins=[]){const needle=normalizeSearch(search);return users.filter(p=>(!needle||normalizeSearch(p.name+' '+p.email).includes(needle))&&(!condition||p.condition===condition)&&(!role||(role==='admin')===admins.includes(p.email))).sort((a,b)=>a.name.localeCompare(b.name,'es'));}
export function shiftWeek(week,amount){return new Date(new Date(week+'T00:00:00Z').getTime()+amount*7*86400000).toISOString().slice(0,10);}
export function monthBounds(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Elegí un mes válido.');const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return [month+'-01',d.toISOString().slice(0,10)];}
export function monthlyReport(month,records,days,attendance,users){
 const [start,end]=monthBounds(month),entries=new Map();
 const person=(uid,name)=>{if(!entries.has(uid)){const p=users.find(x=>x.id===uid);entries.set(uid,{uid,name:p?.name||name||'Usuario sin perfil',email:p?.email||'',reservations:0,portions:0,reserved:new Set(),attended:new Set()});}return entries.get(uid);};
 for(const r of records)if(r.dateKey>=start&&r.dateKey<end&&reservationStatus(r,days[r.dateKey])==='Confirmada'){const p=person(r.uid,r.name);p.reservations++;p.portions+=r.portions;p.reserved.add(r.dateKey);}
 for(const a of attendance)if(a.present&&a.dateKey>=start&&a.dateKey<end)person(a.uid).attended.add(a.dateKey);
 const rows=[...entries.values()].map(p=>({uid:p.uid,name:p.name,email:p.email,reservations:p.reservations,portions:p.portions,reservedDays:p.reserved.size,attendedDays:p.attended.size})).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 return {month,rows,reservations:rows.reduce((n,p)=>n+p.reservations,0),portions:rows.reduce((n,p)=>n+p.portions,0),attendance:rows.reduce((n,p)=>n+p.attendedDays,0),people:rows.filter(p=>p.attendedDays>0).length};
}
export function reportCsv(report){const cell=value=>'"'+String(value).replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[['Mes','Nombre','Correo','Reservas por turno','Porciones solicitadas','Días reservados','Días asistidos'],...report.rows.map(p=>[report.month,p.name,p.email,p.reservations,p.portions,p.reservedDays,p.attendedDays])].map(r=>r.map(cell).join(';')).join('\r\n');}
