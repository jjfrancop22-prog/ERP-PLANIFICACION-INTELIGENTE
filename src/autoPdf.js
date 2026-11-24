/** Shared browser PDF generator: no print dialog, deterministic A4 landscape bytes. */
const enc=new TextEncoder();
const ascii=s=>enc.encode(s);
const win=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');
const esc=s=>win(s).replace(/([\\()])/g,'\\$1');
const fmt=n=>Number(n).toFixed(2);
export async function personnelPdfFile(records,{generatedBy='',logoUrl=''}={}){
 const width=842,height=595,margin=27, cols=[25,124,124,87,112,91,72,72,61],sum=cols.reduce((a,b)=>a+b,0),scale=(width-2*margin)/sum,ws=cols.map(x=>x*scale);
 const rows=[...records].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
 const chunks=[];let page=[],y=height-112;
 const text=(x,yy,s,size=8,bold=false)=>{page.push(`BT /${bold?'F2':'F1'} ${size} Tf ${fmt(x)} ${fmt(yy)} Td (${esc(s)}) Tj ET`)};
 const line=(x1,y1,x2,y2)=>page.push(`${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S`);
 const cell=(x,top,w,h)=>{page.push(`${fmt(x)} ${fmt(top-h)} ${fmt(w)} ${fmt(h)} re S`)};
 const wrap=(s,w,size=7)=>{const out=[];let cur='';for(const word of win(s).split(/\s+/)){if((cur+' '+word).length*size*.48>w&&cur){out.push(cur);cur=word}else cur=cur?cur+' '+word:word}out.push(cur);return out};
 const head=()=>{page=[];page.push('0.4 w 0.12 0.2 0.3 RG');cell(margin,height-24,width-2*margin,60);line(margin+92,height-24,margin+92,height-84);line(width-margin-145,height-24,width-margin-145,height-84);text(margin+19,height-55,'PSI',19,true);text(margin+102,height-46,'LABORATORIO DE ANALISIS AMBIENTAL DE PRODUCTOS Y SERVICIOS',10,true);text(margin+244,height-63,'INDUSTRIALES C. LTDA.',10,true);text(width-margin-137,height-42,'Codigo: PSI-MC1501',9,true);text(width-margin-137,height-57,'Version: 04',9,true);text(width-margin-137,height-72,'ISO: 6.2',9);text(margin,height-100,'LISTADO MAESTRO DE PERSONAL',12,true);y=height-112;let x=margin;const names=['N.','NOMBRE','CARGO / PUESTO','AREA','TIPO CONTRATO','VINCULO','INGRESO','SALIDA','ESTADO'];names.forEach((n,i)=>{cell(x,y,ws[i],22);text(x+3,y-14,n,6.4,true);x+=ws[i]});y-=22};
 head();let idx=0;for(const p of rows){const values=[++idx,p.name,p.position,p.area,p.contract,p.linkType,p.joined||'-',p.left||'-',p.active?'ACTIVO':'INACTIVO'];const lines=values.map((v,i)=>wrap(v,ws[i]-7,7));const rh=Math.max(27,...lines.map(a=>a.length*10+8));if(y-rh<48){chunks.push(page);head()}let x=margin;lines.forEach((arr,i)=>{cell(x,y,ws[i],rh);arr.forEach((s,j)=>text(x+3,y-12-j*10,s,7));x+=ws[i]});y-=rh}
 chunks.push(page);
 const stamp=new Date().toLocaleString('es-EC');chunks.forEach((p,i)=>{p.push(`0.5 0.5 0.5 RG`);p.push(`27 36 m 815 36 l S`);p.push(`BT /F1 7 Tf 27 23 Td (${esc('Generado: '+stamp+' | '+generatedBy+' | Total: '+rows.length)}) Tj ET`);p.push(`BT /F1 7 Tf 755 23 Td (${esc('Pagina '+(i+1)+' / '+chunks.length)}) Tj ET`)});
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];const refs=[];
 for(const commands of chunks){const stream=commands.join('\n')+'\n';const contentId=objects.length;objects.push(`<< /Length ${ascii(stream).length} >>\nstream\n${stream}endstream`);const pageId=objects.length;objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);refs.push(`${pageId} 0 R`)}
 objects[2]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${refs.length} >>`;
 let output='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=ascii(output).length;output+=`${i} 0 obj\n${objects[i]}\nendobj\n`};const start=ascii(output).length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)output+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;output+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 const blob=new Blob([ascii(output)],{type:'application/pdf'});return new File([blob],'PSI-MC1501_V04.pdf',{type:'application/pdf'});
}
