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
  const cancelled=rows.filter(r=>reservationStatus(r,day)!=='Confirmada');
  if(!cancelled.length)lines.push('Sin cancelaciones.');
  for(const r of cancelled)lines.push(r.name+' | '+shiftLabel(r.shift)+' | '+r.portions+' porciones',reservationStatus(r,day),'');
  return lines.filter(line=>line!==undefined);
}

// PDF A4 con texto WinAnsi, saltos de página y sin dependencias externas.
export function pdfBytes(lines){
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
