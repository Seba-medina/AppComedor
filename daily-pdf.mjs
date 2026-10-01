import {SHIFTS,shiftLabel,reservationStatus} from './domain.mjs';

export function dailyReportLines(date,records,day,modalities=[]){
  const rows=records.filter(r=>r.dateKey===date).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const active=rows.filter(r=>reservationStatus(r,day)==='Confirmada');
  const lines=['COMEDOR UNER - RESERVAS DEL DIA',date.split('-').reverse().join('/'),day?.blocked?'DIA BLOQUEADO':!day?'DIA SIN HABILITAR':'',
    'Reservas activas: '+active.length+' | Porciones a preparar: '+active.reduce((n,r)=>n+r.portions,0),''];
  for(const shift of SHIFTS){
    const group=active.filter(r=>r.shift===shift);
    lines.push(shiftLabel(shift).toUpperCase()+' - '+group.length+' reservas / '+group.reduce((n,r)=>n+r.portions,0)+' porciones');
    if(!group.length)lines.push('Sin reservas activas.');
    for(const r of group){
      lines.push(r.name+' | '+r.condition+' | '+r.portions+' porciones',
        'Restricciones: '+(r.diet||'Sin restricciones'),
        'Modalidad: '+(r.modalityId?(modalities.find(m=>m.id===r.modalityId)?.name||'Modalidad especial'):'Habitual'),'');
    }
    lines.push('');
  }
  lines.push('CANCELACIONES (NO INCLUIDAS EN PORCIONES A PREPARAR)');
  const cancelled=rows.filter(r=>r.portions>0&&reservationStatus(r,day)!=='Confirmada');
  if(!cancelled.length)lines.push('Sin cancelaciones.');
  for(const r of cancelled)lines.push(r.name+' | '+shiftLabel(r.shift)+' | '+r.portions+' porciones',reservationStatus(r,day),'');
  return lines.filter(line=>line!==undefined);
}

// PDF A4 con texto WinAnsi, saltos de página y sin dependencias externas.
export function pdfBytes(lines){
  if(!Array.isArray(lines))return tablePdfBytes(lines);
  const latin=text=>String(text).normalize('NFC').replace(/[^\x20-\xFF]/g,'?');
  const wrapped=[];
  for(const line of lines){
    let text=latin(line).replace(/\s+/g,' ').trim();
    while(text.length>88){let cut=text.lastIndexOf(' ',88);if(cut<1)cut=88;wrapped.push(text.slice(0,cut));text=text.slice(cut).trim();}
    wrapped.push(text);
  }
  const pages=[];for(let i=0;i<wrapped.length;i+=46)pages.push(wrapped.slice(i,i+46));
  if(!pages.length)pages.push([]);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const escape=text=>text.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const pageRefs=[];
  pages.forEach((page,i)=>{
    const pageId=objects.length+1,contentId=pageId+1;pageRefs.push(pageId+' 0 R');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+contentId+' 0 R >>');
    const stream='BT /F1 10 Tf 15 TL 42 795 Td '+page.map((line,j)=>(j?'T* ':'')+'('+escape(line)+') Tj').join('\n')+' ET\nBT /F1 9 Tf 42 25 Td (Pagina '+(i+1)+' de '+pages.length+') Tj ET';
    objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');
  });
  objects[1]='<< /Type /Pages /Count '+pages.length+' /Kids ['+pageRefs.join(' ')+'] >>';
  let output='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(output.length);output+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});
  const xref=output.length;output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return Uint8Array.from(output,c=>c.charCodeAt(0));
}
export function downloadPdf(lines,filename){
  const url=URL.createObjectURL(new Blob([pdfBytes(lines)],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}

export function dailyTableReport(date,records,day,modalities=[]){
  const rows=records.filter(r=>r.dateKey===date).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const active=rows.filter(r=>reservationStatus(r,day)==='Confirmada');
  const groups=SHIFTS.map(shift=>{const items=active.filter(r=>r.shift===shift);return {title:shiftLabel(shift),portions:items.reduce((n,r)=>n+r.portions,0),rows:items.map(r=>[r.name,r.condition,String(r.portions),r.diet||'Sin restricciones',r.modalityId?(modalities.find(m=>m.id===r.modalityId)?.name||'Modalidad especial'):'Habitual'])};});
  const cancelled=rows.filter(r=>r.portions>0&&reservationStatus(r,day)!=='Confirmada');
  return {date,total:active.reduce((n,r)=>n+r.portions,0),count:active.length,groups,cancelled:cancelled.map(r=>[r.name,shiftLabel(r.shift),String(r.portions),reservationStatus(r,day),''])};
}
function tablePdfBytes(report){
  const safe=v=>String(v).normalize('NFC').replace(/[^\x20-\xFF]/g,'?');
  const esc=v=>safe(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const widths=[157,74,32,112,105,55],left=30,tableWidth=535;
  // Conservative Helvetica widths keep long values inside their cells without wasting lines.
  const measure=t=>[...t].reduce((n,c)=>{const base=c.normalize('NFD')[0];return n+8.2*(base==='W'?1:base==='M'||base==='m'?0.9:base==='w'?0.8:/[ilI.,:;!| ]/.test(base)?0.3:/[frt]/.test(base)?0.4:/[A-Z]/.test(base)?0.75:0.56);},0);
  const wrap=(v,width)=>{let t=safe(v).replace(/\s+/g,' ').trim(),out=[];while(measure(t)>width-10){let end=1;while(end<t.length&&measure(t.slice(0,end+1))<=width-10)end++;let cut=t.lastIndexOf(' ',end);if(cut<1)cut=end;out.push(t.slice(0,cut));t=t.slice(cut).trim();}out.push(t);return out;};
  let pages=[],commands=[],y;
  const text=(value,x,top,size=8.2,bold=false)=>commands.push('0.07 0.23 0.18 rg BT /'+(bold?'F2':'F1')+' '+size+' Tf '+x+' '+top+' Td ('+esc(value)+') Tj ET');
  const rect=(x,top,w,h,fill)=>{commands.push((fill||'1 1 1')+' rg '+x+' '+(top-h)+' '+w+' '+h+' re f','0.72 0.77 0.73 RG 0.4 w '+x+' '+(top-h)+' '+w+' '+h+' re S');};
  const page=()=>{if(commands.length)pages.push(commands.join('\n'));commands=[];y=810;text('COMEDOR UNER | ASISTENCIA DEL DIA',left,y,13,true);text(report.date.split('-').reverse().join('/'),465,y,10,true);y-=19;rect(left,y,tableWidth,23,'0.91 0.95 0.90');text('A PREPARAR: '+report.total+' PORCIONES | '+report.count+' reservas activas',left+8,y-15,10,true);y-=36;};
  const rowHeight=cells=>Math.max(15,...cells.map((c,i)=>wrap(c,widths[i]).length*10+5));
  const row=(cells,header=false,attendance=false)=>{const lines=cells.map((c,i)=>wrap(c,widths[i]));const height=rowHeight(cells);let x=left;lines.forEach((l,i)=>{rect(x,y,widths[i],height,header?'0.91 0.95 0.90':undefined);l.forEach((v,j)=>text(v,x+5,y-10-j*10,8.2,header));if(attendance&&i===5){commands.push('0.25 0.35 0.28 RG 0.6 w '+(x+23)+' '+(y-height/2-4)+' 8 8 re S');}x+=widths[i];});y-=height;};
  const section=(title,headers,rows,total,attendance=false)=>{const heading=()=>{text(title,left,y,10,true);y-=15;row(headers,true);};if(y<95)page();heading();if(!rows.length)rows=[['Sin reservas','','','','','']];for(const cells of rows){const padded=[...cells,''].slice(0,6),h=rowHeight(padded);if(y-h<40){page();heading();}row(padded,false,attendance&&!!cells[0]&&cells[0]!=='Sin reservas');}if(total!==undefined){if(y-rowHeight(['SUBTOTAL '+title,'',String(total),'porciones a preparar','',''])<40){page();heading();}row(['SUBTOTAL '+title,'',String(total),'porciones a preparar','',''],true);}y-=17;};
  page();report.groups.forEach(g=>section(g.title.toUpperCase(),['Nombre','Condición','Porc','Restricciones','Modalidad','Asistió'],g.rows,g.portions,true));
  if(report.cancelled.length)section('CANCELACIONES - NO SUMAN AL TOTAL',['Nombre','Turno','Porc','Estado','',''],report.cancelled);
  pages.push(commands.join('\n'));
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'],refs=[];
  pages.forEach((content,i)=>{const id=objects.length+1;refs.push(id+' 0 R');objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+(id+1)+' 0 R >>');content+='\nBT /F1 9 Tf 36 24 Td (Pagina '+(i+1)+' de '+pages.length+') Tj ET';objects.push('<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');});
  objects[1]='<< /Type /Pages /Count '+pages.length+' /Kids ['+refs.join(' ')+'] >>';let output='%PDF-1.4\n',offsets=[];objects.forEach((obj,i)=>{offsets.push(output.length);output+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});const start=output.length;output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';return Uint8Array.from(output,c=>c.charCodeAt(0));
}
