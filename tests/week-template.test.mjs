import test from 'node:test';import assert from 'node:assert/strict';import {validateTemplate,applyWeekTemplate} from '../week-template.mjs';import {weekDays,reservationId} from '../domain.mjs';
const dates=weekDays('2026-10-05'),days=Object.fromEntries(dates.map(date=>[date,{blocked:false,generation:0}])),template={days:[0,1,2,3,4],mediodia:2,noche:0},profile={diet:'Sin TACC'};
test('Plantilla de 2 porciones mediodía configura los cinco días sin confirmar reservas',()=>{const r=applyWeekTemplate(template,dates,days,[],'u',profile,new Map(),new Date('2026-10-05T09:00:00-03:00'));assert.equal(r.applied.length,5);for(const turns of r.selection.values()){assert.equal(turns.mediodia.portions,2);assert.equal(turns.mediodia.diet,'Sin TACC');assert.equal(turns.noche,undefined);}});
test('Omite cierre exacto, bloqueo, falta de habilitación y turno cancelado',()=>{const blocked={...days,[dates[1]]:{blocked:true,generation:0}};delete blocked[dates[2]];const records=[{id:reservationId('u',dates[3],'mediodia',0),cancelled:true}];const r=applyWeekTemplate(template,dates,blocked,records,'u',profile,new Map(),new Date('2026-10-05T10:00:00-03:00'));assert.deepEqual(r.applied,[dates[4]]);assert.equal(r.skipped.length,4);});
test('No permite más de dos porciones y preserva restricciones de reservas existentes',()=>{assert.throws(()=>validateTemplate({...template,noche:1}));assert.throws(()=>validateTemplate({...template,days:[0,0]}));const records=[{id:reservationId('u',dates[0],'mediodia',0),portions:1,diet:'Alergia a maní',modalityId:'curso'}];const r=applyWeekTemplate(template,dates,days,records,'u',profile,new Map(),new Date('2026-10-05T09:00:00-03:00'));assert.equal(r.selection.get(dates[0]).mediodia.diet,'Alergia a maní');});

test('Cada día aplica sus propios turnos, porciones y días libres',()=>{
 const config={schedule:{0:{mediodia:2,noche:0},1:{mediodia:0,noche:2},2:{mediodia:1,noche:1},4:{mediodia:0,noche:1}}};
 const r=applyWeekTemplate(config,dates,days,[],'u',profile,new Map(),new Date('2026-10-05T09:00:00-03:00'));
 assert.deepEqual(r.applied,[dates[0],dates[1],dates[2],dates[4]]);
 assert.equal(r.selection.get(dates[0]).mediodia.portions,2);assert.equal(r.selection.get(dates[0]).noche,undefined);
 assert.equal(r.selection.get(dates[1]).noche.portions,2);assert.equal(r.selection.get(dates[1]).mediodia,undefined);
 assert.equal(r.selection.get(dates[2]).mediodia.portions,1);assert.equal(r.selection.get(dates[2]).noche.portions,1);
 assert.equal(r.selection.has(dates[3]),false);assert.equal(r.selection.get(dates[4]).noche.portions,1);
});
test('Valida cada día y migra el formato anterior',()=>{
 assert.deepEqual(validateTemplate({days:[1,3],mediodia:0,noche:2}),{schedule:{1:{mediodia:0,noche:2},3:{mediodia:0,noche:2}}});
 for(const schedule of [{},{5:{mediodia:1,noche:0}},{0:{mediodia:2,noche:1}},{0:{mediodia:0,noche:0}},{0:{mediodia:0.5,noche:1}},{0:{mediodia:-1,noche:2}}])assert.throws(()=>validateTemplate({schedule}));
});
