import {PSI_LOGO_BASE64} from './psiLogo.js';
// Plantilla MC1102 V04: mismas 24 columnas y agrupaciones del Excel.
// Documento maestro vacío; los expedientes individuales permanecen independientes.
const normalize=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');
const esc=v=>normalize(v).replace(/([\\()])/g,'\\$1');
const wrap=(v,max)=>{const words=normalize(v).split(/\s+/).filter(Boolean),out=[];let line='';for(const w of words){if(w.length>max){if(line)out.push(line);line='';for(let i=0;i<w.length;i+=max)out.push(w.slice(i,i+max));}else if((line.length?line.length+1:0)+w.length>max){out.push(line);line=w;}else line=line?line+' '+w:w;}if(line)out.push(line);return out.length?out:[''];};
export function risk1102MatrixPdf(records=[]){
 const heads=['ANO','TIPO R/O','FUENTE','DESCRIPCION INTEGRA','PROCESO','CAUSA ASOCIADA','CONSECUENCIA ASOCIADA','CLASIFICACION','PROBABILIDAD','IMPACTO','FACTOR P x I','NIVEL DE RIESGO','TRATAMIENTO','ACCION / PLAN COMPLETO','PLAZO / COMPROMISO','RESPONSABLE','ESTADO DE ACCION','ULTIMA REVISION','FRECUENCIA','EVIDENCIA DE EFICACIA','EFICACIA (SI/NO)','PROXIMA REVISION','SEGUIMIENTO / OBSERVACIONES','ESTADO (ABIERTO/CERRADO)'];
 const widths=[75,85,140,280,160,240,240,120,95,80,95,115,130,290,125,155,130,125,100,280,140,125,260,155];
 const margin=32,W=widths.reduce((a,b)=>a+b,0)+margin*2,H=900;
 const groups=[['IDENTIFICACION DE RIESGOS Y/U OPORTUNIDADES',0,7],['VALORACION DE RIESGOS Y OPORTUNIDADES',7,12],['TRATAMIENTO DE RIESGOS Y OPORTUNIDADES',12,17],['SEGUIMIENTO Y EFICACIA',17,23],['CIERRE',23,24]];
 const col={ink:'0.11 0.19 0.27',line:'0.68 0.72 0.76',pale:'0.92 0.94 0.96',white:'1 1 1'};
 const t=(x,y,v,s=12,b=false)=>`BT /${b?'F2':'F1'} ${s} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(v)}) Tj ET`;
 const rect=(x,y,w,h,fill=false)=>`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re ${fill?'f':'S'}`;
 const pages=[];let commands=[],y=0;
 function start(){if(commands.length)pages.push(commands.join('\n')+'\n');commands=[];
 // Encabezado blanco, logo PSI y nombre/titulo centrados, como Excel.
 commands.push('1 1 1 rg',rect(margin,H-150,W-2*margin,120,true),`${col.line} RG`,rect(margin,H-150,W-2*margin,120),'q 104 0 0 72 45 773 cm /PSILogo Do Q',`${col.ink} rg`);
 commands.push(t(W/2-390,H-72,'LABORATORIO DE ANALISIS AMBIENTAL DE PRODUCTOS Y SERVICIOS INDUSTRIALES C. LTDA.',17,true));
 commands.push(t(W/2-225,H-110,'MATRIZ DE RIESGOS Y OPORTUNIDADES',24,true));
 commands.push(t(W-365,H-58,'CODIGO: PSI-MC1102',13,true),t(W-365,H-82,'VERSION: 04',13,true),t(W-365,H-106,'FECHA: ____ / ____ / ______',12));
 let x=margin;commands.push(`${col.pale} rg`);
 for(const [label,a,b] of groups){const width=widths.slice(a,b).reduce((s,v)=>s+v,0);commands.push(rect(x,H-196,width,42,true),`${col.line} RG`,rect(x,H-196,width,42),`${col.ink} rg`,t(x+12,H-180,label,13,true),`${col.pale} rg`);x+=width;}
 x=margin;commands.push(`${col.pale} rg`);for(let i=0;i<heads.length;i++){commands.push(rect(x,H-255,widths[i],59,true),`${col.line} RG`,rect(x,H-255,widths[i],59),`${col.ink} rg`);wrap(heads[i],Math.max(9,Math.floor((widths[i]-12)/8))).slice(0,3).forEach((line,j)=>commands.push(t(x+7,H-215-j*15,line,11,true)));commands.push(`${col.pale} rg`);x+=widths[i];}y=H-255;}
 function vals(r){const f=(r.followups||[]).at(-1)||{},e=r.effectiveness||{};return [r.identifiedYear||r.year||'',r.kind||'',r.source||'',r.description||'',r.process||'',r.cause||'',r.consequence||r.benefit||'',r.classification||'',r.probability||'',r.impact||'',r.score??'',r.level||'',r.treatment||'',r.action||'',r.deadline||'',r.owner||'',r.actionStatus||'',r.lastReviewAt||'',r.frequencyMonths===12?'ANUAL':r.frequencyMonths===6?'SEMESTRAL':r.frequencyMonths===3?'TRIMESTRAL':'',e.evidence||r.evidenceExpected||'',e.result||'',r.nextReviewAt||'',[f.result,f.evidence,r.closure?.note].filter(Boolean).join(' / '),r.status||''];}
 start();
 if(!records.length){for(let k=0;k<4;k++){let x=margin;for(const w of widths){commands.push(`${col.line} RG`,rect(x,y-105,w,105));x+=w;}y-=105;}}
 for(const r of records){const lines=vals(r).map((v,i)=>wrap(v,Math.max(8,Math.floor((widths[i]-14)/7.1))));const height=Math.max(100,Math.max(...lines.map(z=>z.length))*15+20);if(y-height<45)start();let x=margin;lines.forEach((ls,i)=>{commands.push(`${col.line} RG`,rect(x,y-height,widths[i],height),`${col.ink} rg`);ls.forEach((line,j)=>commands.push(t(x+6,y-17-j*15,line,11)));x+=widths[i];});y-=height;}
 pages.push(commands.join('\n')+'\n');
 const encoder=new TextEncoder(),ascii=s=>encoder.encode(s),logo=Uint8Array.from(atob(PSI_LOGO_BASE64),c=>c.charCodeAt(0));
 const concat=arr=>{const result=new Uint8Array(arr.reduce((n,b)=>n+b.length,0));let offset=0;for(const a of arr){result.set(a,offset);offset+=a.length;}return result;};
 const objects=[null,ascii('<< /Type /Catalog /Pages 2 0 R >>'),null,ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')];
 objects.push(concat([ascii(`<< /Type /XObject /Subtype /Image /Width 120 /Height 81 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`),logo,ascii('\nendstream')]));
 const kids=[];for(const stream of pages){const id=objects.length;kids.push(`${id} 0 R`);objects.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /PSILogo 5 0 R >> >> /Contents ${id+1} 0 R >>`));const bytes=ascii(stream);objects.push(concat([ascii(`<< /Length ${bytes.length} >>\nstream\n`),bytes,ascii('\nendstream')]));}
 objects[2]=ascii(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`);
 const chunks=[ascii('%PDF-1.4\n')],offsets=[0];let length=chunks[0].length;for(let i=1;i<objects.length;i++){offsets[i]=length;const b=concat([ascii(`${i} 0 obj\n`),objects[i],ascii('\nendobj\n')]);chunks.push(b);length+=b.length;}
 const xref=length;let trailer=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)trailer+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;trailer+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;chunks.push(ascii(trailer));return new Blob([concat(chunks)],{type:'application/pdf'});
}
