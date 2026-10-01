import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyTableReport,pdfBytes} from '../daily-pdf.mjs';
const date='2026-10-02',day={generation:0,blocked:false};
const person=i=>({dateKey:date,shift:i%2?'noche':'mediodia',generation:0,portions:1,name:'Alumno '+String(i).padStart(3,'0'),condition:'Alumno regular',diet:'',modalityId:'',cancelled:false});
test('A4 vertical con asistencia, totales y 40 reservas compactas en una hoja',()=>{
 const records=Array.from({length:40},(_,i)=>person(i));
 records.push({...person(41),portions:0});
 const report=dailyTableReport(date,records,day),pdf=Buffer.from(pdfBytes(report)).toString('latin1');
 assert.equal(report.count,40);assert.equal(report.total,40);assert.equal(report.cancelled.length,0);
 assert.match(pdf,/MediaBox \[0 0 595 842\]/);assert.match(pdf,/\/Count 1\b/);
 assert.match(pdf,/Asistió/);assert.doesNotMatch(pdf,/CANCELACIONES/);
 for(let i=0;i<40;i++)assert.ok(pdf.includes(person(i).name));
});
test('Lista extensa conserva personas, repite encabezados y separa cancelaciones',()=>{
 const records=Array.from({length:100},(_,i)=>({...person(i),diet:'Sin TACC / alergia a frutos secos'}));
 records.push({...person(101),cancelled:true});
 const report=dailyTableReport(date,records,day),pdf=Buffer.from(pdfBytes(report)).toString('latin1');
 assert.equal(report.total,100);assert.equal(report.cancelled.length,1);
 assert.ok(Number(pdf.match(/\/Count (\d+)/)[1])>1);
 assert.ok((pdf.match(/\(Asistió\)/g)||[]).length>2);
 assert.match(pdf,/CANCELACIONES/);
 for(let i=0;i<100;i++)assert.ok(pdf.includes(person(i).name));
});
