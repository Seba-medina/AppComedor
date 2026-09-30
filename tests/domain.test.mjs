import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monday,weekDays,deadline,reservationStatus,reservationId,validateSelections} from '../domain.mjs';
test('Semana y corte usan Argentina, incluyendo cambio de fecha UTC',()=>{
  assert.equal(monday(new Date('2026-10-05T01:00:00Z')),'2026-09-28');
  assert.equal(deadline('2026-10-05').toISOString(),'2026-10-05T13:00:00.000Z');
  assert.equal(weekDays('2026-10-05')[4],'2026-10-09');
  assert.throws(()=>weekDays('2026-10-06'));
});
test('Ambos horarios y nuevas reservas tras bloqueo tienen claves diferentes',()=>{
  assert.notEqual(reservationId('u','2026-10-05','mediodia',0),reservationId('u','2026-10-05','noche',0));
  assert.notEqual(reservationId('u','2026-10-05','noche',0),reservationId('u','2026-10-05','noche',1));
  assert.equal(reservationStatus({generation:0,cancelled:false},{generation:1,blocked:false}),'Cancelada por bloqueo');
});
test('Validación exige turnos y rechaza corte exacto y bloqueo',()=>{
  const days={'2026-10-05':{blocked:false}},profile={name:'Alumno'},now=new Date('2026-10-05T12:59:59Z');
  assert.throws(()=>validateSelections(new Map([['2026-10-05',{}]]),days,profile,now));
  const selections=new Map([['2026-10-05',{mediodia:{portions:1},noche:{portions:1}}]]);
  assert.equal(validateSelections(selections,days,profile,now).length,1);
  assert.throws(()=>validateSelections(selections,days,profile,new Date('2026-10-05T13:00:00Z')));
  assert.throws(()=>validateSelections(selections,{'2026-10-05':{blocked:true}},profile,now));
});

test('Máximo diario permite 2 en un turno o 1+1 y rechaza 2+1',()=>{const date='2026-10-05',days={[date]:{blocked:false}},p={name:'Alumno'},now=new Date(date+'T09:00:00-03:00');assert.equal(validateSelections(new Map([[date,{mediodia:{portions:2}}]]),days,p,now).length,1);assert.throws(()=>validateSelections(new Map([[date,{mediodia:{portions:2},noche:{portions:1}}]]),days,p,now));});
