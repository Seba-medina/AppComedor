export const SHIFTS = ['mediodia', 'noche'];
export const shiftLabel = s => s === 'mediodia' ? 'Mediodía' : 'Noche';
export const ADMIN_EMAIL = 'sebastianezequielmedina@gmail.com';
export const dateKey = d => d.toISOString().slice(0, 10);
export function argentinaToday(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const fields = Object.fromEntries(p.map(x=>[x.type,x.value]));
  return fields.year + '-' + fields.month + '-' + fields.day;
}
export function monday(now = new Date()) {
  const d = new Date(argentinaToday(now) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return dateKey(d);
}
export function weekDays(start) {
  const d = new Date(start + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(d.getTime()) || dateKey(d)!==start || d.getUTCDay()!==1) throw new Error('Elegí el lunes de la semana.');
  return Array.from({length:5},(_,i)=>dateKey(new Date(d.getTime()+i*86400000)));
}
export const deadline = key => new Date(key + 'T10:00:00-03:00');
export const reservationId = (uid,key,shift,generation) => [uid,key,shift,generation].join('_');
export function reservationStatus(r,day) {
  if (r.portions===0) return 'Turno cambiado';
  if (r.cancelled) return 'Baja gestionada por el comedor';
  if (!day) return 'Sin información del día';
  if (day.blocked || r.generation!==day.generation) return 'Cancelada por bloqueo';
  return 'Confirmada';
}
export function validateSelections(selected,days,profile,now=new Date()) {
  if(!profile?.name?.trim()) throw new Error('Guardá tu perfil antes de reservar.');
  const entries=[...selected].filter(([key])=>days[key]&&!days[key].blocked&&now<deadline(key));
  if(!entries.length) throw new Error('Elegí al menos un día habilitado antes de las 10:00.');
  for(const [,turns] of entries) {
    if(!Object.keys(turns).length) throw new Error('Marcá al menos un horario en cada día elegido.');
    if(Object.values(turns).reduce((n,r)=>n+r.portions,0)>2)throw new Error('El máximo es de 2 porciones por día, sumando mediodía y noche.');
    for(const [shift,r] of Object.entries(turns)) if(!SHIFTS.includes(shift)||!Number.isInteger(r.portions)||r.portions<1||r.portions>2) throw new Error('Revisá los turnos y porciones.');
  }
  return entries;
}
