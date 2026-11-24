import {mc0203} from './mc0203Content';
// Plantilla institucional sin datos personales. PDF A4, contenido fijo, sin firma.
const latin=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');
const escape=s=>latin(s).replace(/([\\()])/g,'\\$1');
const bytes=s=>new TextEncoder().encode(s);
export function mc0203TemplatePdf(){
 const W=595,H=842,margin=43,max=W-margin*2,pages=[];let cmds=[],y=H-42;
 const text=(s,x,yy,size=10,bold=false)=>cmds.push(`BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${escape(s)}) Tj ET`);
 const header=()=>{cmds=['0.4 w 0.12 0.26 0.42 RG'];cmds.push(`${margin} ${H-92} ${max} 56 re S`);text('PSI',margin+10,H-69,20,true);text('LABORATORIO DE ANALISIS AMBIENTAL',margin+78,H-55,9,true);text('PRODUCTOS Y SERVICIOS INDUSTRIALES C. LTDA.',margin+78,H-69,8);text('PSI-MC0203',W-144,H-55,9,true);text('VERSION 03',W-144,H-72,9,true);y=H-111;text('COMPROMISO DE CONFIDENCIALIDAD',margin,y,13,true);y-=25;text('FORMATO INSTITUCIONAL EN BLANCO - SIN ACEPTACION INDIVIDUAL',margin,y,8);y-=25};
 const newPage=()=>{pages.push(cmds);header()};
 const wrap=(s,size=10,indent=0)=>{const maxChars=Math.floor((max-indent)/(size*.51));let line='';for(const word of latin(s).split(/\s+/)){if((line+' '+word).trim().length>maxChars&&line){if(y<65)newPage();text(line,margin+indent,y,size);y-=size*1.55;line=word}else line=line?line+' '+word:word}if(line){if(y<65)newPage();text(line,margin+indent,y,size);y-=size*1.55}y-=5};
 const heading=s=>{if(y<100)newPage();y-=7;text(s,margin,y,11,true);y-=21};
 const list=(arr,prefix)=>arr.forEach((v,i)=>wrap(`${prefix==='number'?i+1+'.':'-'} ${v}`,9.5,10));
 header();heading('DECLARACION DE COMPROMISO DE CONFIDENCIALIDAD');wrap(mc0203.intro);wrap('En cumplimiento de lo anterior, me comprometo a:');list(mc0203.pledges,'number');heading('CLAUSULA DE EJECUCION LEGAL');wrap(mc0203.legal);y-=10;wrap('Lugar y fecha: __________________________________________________________',9.5);wrap('Nombre completo: _______________________________________________________',9.5);wrap('Cedula / Pasaporte: __________________________ Firma: ______________________',9.5);wrap('Cargo o funcion: _______________________________________________________',9.5);pages.push(cmds);
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];const refs=[];
 pages.forEach((p,i)=>{p.push(`BT /F1 8 Tf ${W-115} 30 Td (Pagina ${i+1} / ${pages.length}) Tj ET`);const stream=p.join('\n')+'\n';const cid=objects.length;objects.push(`<< /Length ${bytes(stream).length} >>\nstream\n${stream}endstream`);const pid=objects.length;objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`);refs.push(`${pid} 0 R`)});
 objects[2]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${refs.length} >>`;
 let pdf='%PDF-1.4\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=bytes(pdf).length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`};const start=bytes(pdf).length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return new File([bytes(pdf)],'PSI-MC0203_V03_PLANTILLA.pdf',{type:'application/pdf'});
}
