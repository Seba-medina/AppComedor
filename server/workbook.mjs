import ExcelJS from 'exceljs';
import {reportRows} from './notifications.mjs';
export async function dailyWorkbook(date,records,day,generatedAt=new Date()){
 const book=new ExcelJS.Workbook();book.creator='Comedor UNER';book.created=generatedAt;
 for(const shift of ['mediodia','noche']){
  const sheet=book.addWorksheet(shift==='mediodia'?'Mediodía':'Noche');
  sheet.addRow(['Reservas del '+date]);sheet.addRow(['Generado',generatedAt.toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})]);
  sheet.addRow(['Nombre y apellido','Condición','Porciones','Restricciones','Modalidad','Asistió']);
  const rows=reportRows(records.filter(r=>r.shift===shift),day);for(const row of rows)sheet.addRow([...row,'']);
  sheet.addRow(['Total de porciones','',rows.reduce((n,r)=>n+r[2],0)]);
  sheet.getRow(3).font={bold:true};sheet.columns.forEach((c,i)=>{c.width=[32,22,12,32,25,12][i];});
  sheet.views=[{state:'frozen',ySplit:3}];sheet.autoFilter={from:{row:3,column:1},to:{row:Math.max(3,3+rows.length),column:6}};
  sheet.pageSetup={orientation:'portrait',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
 }
 const summary=book.addWorksheet('Resumen');summary.addRows([['Fecha',date],['Estado',day.blocked?'Sin servicio':'Habilitado'],['Turno','Reservas','Porciones']]);
 for(const shift of ['mediodia','noche']){const rows=reportRows(records.filter(r=>r.shift===shift),day);summary.addRow([shift==='mediodia'?'Mediodía':'Noche',rows.length,rows.reduce((n,r)=>n+r[2],0)]);}
 summary.addRow(['Total',summary.getCell('B4').value+summary.getCell('B5').value,summary.getCell('C4').value+summary.getCell('C5').value]);summary.columns.forEach(c=>c.width=24);
 return Buffer.from(await book.xlsx.writeBuffer());
}
