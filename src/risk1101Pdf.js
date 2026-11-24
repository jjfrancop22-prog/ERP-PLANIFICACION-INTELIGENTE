import {PSI_LOGO_BASE64} from './psiLogo.js';
// MC1101: constancia tabular de identificación. MC1102 conserva la evaluación técnica.
// Generador PDF sin dependencias, compatible con Firebase Spark y Netlify estático.
const clean = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
const escapePdf = value => clean(value).replace(/([\\()])/g, '\\$1');
const wrap = (value, limit) => {
  const words = clean(value ?? '').split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  for (const word of words) {
    if (word.length > limit) {
      if (line) { lines.push(line); line = ''; }
      for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit));
    } else if ((line ? line.length + 1 : 0) + word.length > limit) {
      lines.push(line); line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

export function risk1101Pdf(r) {
  const W = 595, H = 842, left = 35, right = 560, width = right - left;
  const cmd = [];
  const color = (rgb, stroke = false) => cmd.push(`${rgb} ${stroke ? 'RG' : 'rg'}`);
  const rect = (x, y, w, h, fill = false) => cmd.push(`${x} ${y} ${w} ${h} re ${fill ? 'f' : 'S'}`);
  const text = (x, y, value, size = 9, bold = false) => cmd.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
  const ink = () => color('0.12 0.23 0.37');
  let y = 807;
  color('0.09 0.31 0.53'); rect(left, y - 58, width, 58, true);
  color('1 1 1'); text(left + 14, y - 21, 'PSI  |  LABORATORIO DE ANALISIS AMBIENTAL', 11, true);
  text(left + 14, y - 41, 'REGISTRO DE RIESGOS Y OPORTUNIDADES', 10, true);
  text(right - 111, y - 20, 'PSI-MC1101-05', 9, true);
  text(right - 111, y - 37, 'VERSION 05', 8);
  y -= 79;
  const heading = title => {
    color('0.89 0.94 0.98'); rect(left, y - 24, width, 24, true);
    ink(); text(left + 10, y - 16, title, 10, true);
    y -= 30;
  };
  const row = (label, value, options = {}) => {
    const labelWidth = 155, lines = wrap(value, options.wide ? 93 : 66);
    const h = Math.max(30, 13 * lines.length + 14);
    color('0.78 0.84 0.90', true); cmd.push('0.55 w'); rect(left, y - h, width, h);
    color('0.96 0.98 1'); rect(left + 0.5, y - h + 0.5, labelWidth - 1, h - 1, true);
    color('0.78 0.84 0.90', true); cmd.push(`${left + labelWidth} ${y - h} m ${left + labelWidth} ${y} l S`);
    ink(); text(left + 9, y - 19, label, 8.6, true);
    lines.forEach((line, i) => text(left + labelWidth + 10, y - 19 - 13 * i, line, 8.8));
    y -= h;
  };
  const status = { PENDING: 'Pendiente de revision', LINKED: 'Aprobado para MC1102', NOT_LINKED: 'No incorporar', INFO_REQUIRED: 'Requiere informacion' };
  heading('01  IDENTIFICACION');
  row('Ano / fecha', `${r.identifiedYear || 'No registrado'}  |  ${r.identifiedDate || 'No registrada'}`);
  row('Tipo / fuente', `${r.kind || 'No registrado'}  |  ${r.source || 'No registrada'}`);
  row('Proceso o area', r.process);
  row('Identificado por', r.identifiedBy);
  row('Cargo / area', [r.identifiedPosition, r.identifiedArea].filter(Boolean).join('  /  ') || 'No registrado');
  row('Situacion identificada', r.description, { wide: true });
  if (r.reference) row('Registro relacionado', r.reference);
  y -= 12;
  heading('02  REVISION DE CALIDAD');
  row('Estado', status[r.status] || r.status || 'Pendiente de revision');
  if (r.reviewedByName) row('Revisado por', r.reviewedByName);
  if (r.reviewNote) row('Observacion de Calidad', r.reviewNote, { wide: true });
  // Los campos históricos permanecen en Firestore; no se duplican en la constancia de identificación.
  color('0.40 0.49 0.58');
  text(left + 2, 67, 'Registro de identificacion MC1101. La evaluacion y tratamiento corresponden a MC1102.', 8);
  text(left + 2, 51, `Generado: ${new Date().toLocaleString('es-EC')}  |  ID: ${clean(r.code || r.id || '').slice(0, 48)}`, 7.5);
  const stream = cmd.join('\n') + '\n';
  const encoder = new TextEncoder(); const bytes = value => encoder.encode(value).length;
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [5 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`,
    `<< /Length ${bytes(stream)} >>\nstream\n${stream}endstream`];
  let output = '%PDF-1.4\n'; const offsets = [0];
  for (let i = 1; i < objects.length; i++) { offsets[i] = bytes(output); output += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = bytes(output); output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([encoder.encode(output)], { type: 'application/pdf' });
}

/** Matriz horizontal de identificaciones: columnas esenciales, una fila por registro. */
export function risk1101MatrixPdf(records=[]) {
 const W=842,H=595, margin=26, widths=[43,65,95,111,286,110,80];
 const headers=['ANO','TIPO','FUENTE','PROCESO / AREA','DESCRIPCION R/O','REPORTADO POR','ESTADO'];
 const colors={blue:'0.09 0.31 0.53',pale:'0.89 0.94 0.98',ink:'0.12 0.23 0.37',line:'0.78 0.84 0.90'};
 const t=(x,y,str,size=7,bold=false)=>`BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(str)}) Tj ET`;
 const box=(x,y,w,h,fill=false)=>`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re ${fill?'f':'S'}`;
 const status={PENDING:'Pendiente',LINKED:'Aprobado MC1102',NOT_LINKED:'No incorporado',INFO_REQUIRED:'Requiere info.'};
 const values=r=>[r.identifiedYear||'',r.kind||'',r.source||'',r.process||'',r.description||'',r.identifiedBy||'',r.status==='EMPTY_TEMPLATE'?'':(status[r.status]||r.status||'Pendiente')];
 const pages=[];let cmds=[],y=0,number=0;
 function page(){if(cmds.length)pages.push(cmds.join('\n')+'\n');cmds=[];number++;cmds.push(`${colors.blue} rg`,box(margin,H-80,W-2*margin,54,true),'1 1 1 rg',box(margin+5,H-75,76,44,true),'q 70 0 0 43 32 521 cm /PSILogo Do Q',t(margin+90,H-49,'PSI | LABORATORIO DE ANALISIS AMBIENTAL',10,true),t(margin+90,H-67,'REGISTRO DE RIESGOS Y OPORTUNIDADES - MATRIZ',8.5,true),t(W-155,H-48,'PSI-MC1101-05',9,true),t(W-155,H-65,'VERSION 05',8),`${colors.pale} rg`,box(margin,H-111,W-2*margin,24,true),`${colors.ink} rg`);let x=margin;headers.forEach((h,i)=>{cmds.push(t(x+4,H-102,h,7,true));x+=widths[i]});y=H-111;}
 page();
 const data=records.length?records:[]; // Plantilla institucional sin filas ficticias ni signos de interrogación.
 for(const record of data){const vals=values(record);const lines=vals.map((v,i)=>wrap(v,Math.max(6,Math.floor((widths[i]-9)/4.2))));const height=Math.max(29,Math.max(...lines.map(a=>a.length))*10+12);if(y-height<46)page();let x=margin;cmds.push(`${colors.line} RG`,'0.5 w');vals.forEach((_,i)=>{cmds.push(box(x,y-height,widths[i],height));cmds.push(`${colors.ink} rg`);lines[i].forEach((line,j)=>cmds.push(t(x+4,y-12-j*10,line,7,i===0)));x+=widths[i]});y-=height;}
 pages.push(cmds.join('\n')+'\n');
 // PDF binario con imagen JPEG institucional incrustada; funciona sin red ni servicios externos.
 const encoder=new TextEncoder();
 const ascii=str=>encoder.encode(str);
 const logoBytes=Uint8Array.from(atob(PSI_LOGO_BASE64),c=>c.charCodeAt(0));
 const objects=[null,ascii('<< /Type /Catalog /Pages 2 0 R >>'),null,
   ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
   ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')];
 const concat=chunks=>{const size=chunks.reduce((n,a)=>n+a.length,0);const out=new Uint8Array(size);let pos=0;for(const chunk of chunks){out.set(chunk,pos);pos+=chunk.length;}return out;};
 const imgId=5;
 objects.push(concat([ascii(`<< /Type /XObject /Subtype /Image /Width 120 /Height 81 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`),logoBytes,ascii('\nendstream')]));
 const kids=[];
 for(const stream of pages){const pageId=objects.length,streamId=pageId+1;kids.push(`${pageId} 0 R`);
   objects.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /PSILogo ${imgId} 0 R >> >> /Contents ${streamId} 0 R >>`));
   const data=ascii(stream);objects.push(concat([ascii(`<< /Length ${data.length} >>\nstream\n`),data,ascii('endstream')]));
 }
 objects[2]=ascii(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`);
 const chunks=[ascii('%PDF-1.4\n')],offsets=[0];let length=chunks[0].length;
 for(let i=1;i<objects.length;i++){offsets[i]=length;const part=concat([ascii(`${i} 0 obj\n`),objects[i],ascii('\nendobj\n')]);chunks.push(part);length+=part.length;}
 const xref=length;let trailer=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
 for(let i=1;i<objects.length;i++)trailer+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
 trailer+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 chunks.push(ascii(trailer));return new Blob([concat(chunks)],{type:'application/pdf'});
}
