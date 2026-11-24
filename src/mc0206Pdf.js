// PSI-MC0206 V04: PDF A4 institucional con logo y texto Unicode.
// PDF maestro y registros individuales comparten el mismo diseño; sin alterar registros Firestore.
export const mc0206Questions=[
 ['Relaciones externas','¿Usted o un miembro de su familia (hasta segundo grado de afinidad o cuarto grado de consanguinidad) mantiene relación laboral, contractual, comercial o de consultoría con clientes, proveedores o competidores de LAB-PSI?'],
 ['Participación en otras entidades','¿Es usted socio, accionista, representante legal o miembro de la junta directiva de alguna entidad (con o sin fines de lucro) que tenga intereses relacionados con los servicios o actividades del laboratorio?'],
 ['Información confidencial','¿Ha compartido, revelado o divulgado información técnica, administrativa o confidencial de LAB-PSI sin autorización formal?'],
 ['Actividades paralelas','¿Desempeña actividades externas (consultoría, asesoría, servicios técnicos o académicos) que puedan interferir o influir en su juicio profesional dentro del laboratorio?'],
 ['Otras situaciones','¿Existe alguna circunstancia adicional que pudiera ser considerada como potencial conflicto de interés no mencionada en las preguntas anteriores?']
];
export const mc0206Commitment='Declaro que la información consignada en este formulario es veraz y completa. Me comprometo a informar inmediatamente al Coordinador de Calidad o a la Dirección de LAB-PSI sobre cualquier cambio que pudiera representar un conflicto de interés. Asimismo, reconozco que el incumplimiento de esta declaración puede conllevar acciones disciplinarias o legales, conforme al Sistema de Gestión de la Calidad y la legislación vigente.';
const W=595.28,H=841.89,M=39,RIGHT=W-M,BLUE='#175985',DARK='#16324c',PALE='#eaf3f9',BORDER='#d2e2ed';
const encoder=new TextEncoder();
const pdfDate=v=>{try{return v?.toDate?.()?.toLocaleString('es-EC')||'No disponible'}catch{return 'No disponible'}};
function buildPdfFromJpegs(images){
 const parts=[],offsets=[0];let pos=0;
 const add=b=>{const v=typeof b==='string'?encoder.encode(b):b;parts.push(v);pos+=v.length};
 const objs=[];const refs=[];
 objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
 images.forEach((im,i)=>{const imageId=3+i*3,pageId=4+i*3,streamId=5+i*3;refs.push(`${pageId} 0 R`);
  objs[imageId]=[`<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`,im.data,'\nendstream'];
  objs[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${streamId} 0 R >>`;
  const stream=`q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q\n`;
  objs[streamId]=`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`;
 });
 objs[2]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${refs.length} >>`;
 add('%PDF-1.4\n%PSI\n');
 for(let i=1;i<objs.length;i++){offsets[i]=pos;add(`${i} 0 obj\n`);const ob=objs[i];if(Array.isArray(ob))ob.forEach(add);else add(ob);add('\nendobj\n')}
 const xref=pos;add(`xref\n0 ${objs.length}\n0000000000 65535 f \n`);
 for(let i=1;i<objs.length;i++)add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
 add(`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(parts,{type:'application/pdf'});
}
function imageBytes(dataUrl){const binary=atob(dataUrl.split(',')[1]),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out}
function drawDocument(record,person,logo){
 const pages=[];const scale=1.4;let canvas,ctx,y,page=0;
 const savePage=()=>{if(!canvas)return;ctx.strokeStyle=BORDER;ctx.beginPath();ctx.moveTo(M,H-43);ctx.lineTo(RIGHT,H-43);ctx.stroke();text('PSI · Sistema de Gestión de Calidad · PSI-MC0206 V04',M,H-29,7.5,false,'#6a8294');text(`Página ${page}`,RIGHT-44,H-29,7.5,false,'#6a8294');pages.push({data:imageBytes(canvas.toDataURL('image/jpeg',.76)),width:canvas.width,height:canvas.height})};
 const font=(size=10,bold=false)=>{ctx.font=`${bold?'700':'400'} ${size}px Arial, Helvetica, sans-serif`;ctx.fillStyle=DARK};
 const text=(str,x,at,size=10,bold=false,color=DARK)=>{font(size,bold);ctx.fillStyle=color;ctx.fillText(String(str??''),x,at)};
 const box=(x,top,w,h,fill=PALE,stroke=BORDER)=>{ctx.fillStyle=fill;ctx.fillRect(x,top,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.strokeRect(x+.4,top+.4,w-.8,h-.8)}};
 const rule=(top)=>{ctx.strokeStyle=BORDER;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(M,top);ctx.lineTo(RIGHT,top);ctx.stroke()};
 const lines=(value,size=9.5,maxWidth=RIGHT-M)=>{font(size);const result=[];for(const para of String(value??'').split('\n')){let line='';for(const word of para.split(/\s+/)){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){result.push(line);line=word}else line=test}result.push(line)}return result};
 const wrap=(value,x,size=9.5,maxWidth=RIGHT-x,leading=size*1.52,bold=false,color=DARK)=>{const l=lines(value,size,maxWidth);l.forEach(s=>{ensure(leading+8);text(s,x,y,size,bold,color);y+=leading});return l.length*leading};
 const newPage=()=>{
  if(canvas)savePage()
  canvas=document.createElement('canvas');canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);page++;
  box(M,35,RIGHT-M,69,'#fff',BLUE);
  if(logo){const maxW=75,maxH=55,ratio=Math.min(maxW/logo.width,maxH/logo.height);const w=logo.width*ratio,h=logo.height*ratio;ctx.drawImage(logo,M+8+(maxW-w)/2,42+(maxH-h)/2,w,h)}else text('PSI',M+23,76,22,true,BLUE);
  ctx.fillStyle=BLUE;ctx.fillRect(M+93,46,2,47);
  text('PRODUCTOS Y SERVICIOS',M+103,59,9.2,true);text('INDUSTRIALES C. LTDA.',M+103,72,9.2,true);text('Laboratorio de Análisis Ambiental',M+103,86,8,false,'#52728c');
  text('PSI-MC0206',RIGHT-101,59,10,true,BLUE);text('VERSIÓN 04',RIGHT-101,75,9,true);
  ctx.fillStyle=BLUE;ctx.fillRect(M,112,RIGHT-M,3);
  text('DECLARACIÓN DE CONFLICTO DE INTERÉS',M,137,14,true);
  text(record?'REGISTRO INDIVIDUAL · CONTROL ANUAL':'FORMATO INSTITUCIONAL · PLANTILLA EN BLANCO',M,153,8.5,true,BLUE);
  y=177;
 };
 const ensure=(height)=>{if(y+height>H-58)newPage()};
 const heading=(label)=>{ensure(34);box(M,y-11,RIGHT-M,26,PALE,null);text(label,M+10,y+6,10.5,true,BLUE);y+=32};
 newPage();
 box(M,y-8,RIGHT-M,record?66:68,'#f5f9fc',BORDER);y+=8;
 if(record){wrap('TRABAJADOR: '+record.personName,M+10,9.2,RIGHT-M-20,13,true);wrap('CARGO / ÁREA: '+(person?.position||'No registrado')+' · '+(person?.area||'No registrada'),M+10,8.8,RIGHT-M-20,13);wrap('PERÍODO: '+record.year+'     FECHA: '+pdfDate(record.createdAt),M+10,8.8,RIGHT-M-20,13)}
 else{wrap('TRABAJADOR: ______________________________________________________',M+10,9,RIGHT-M-20,14);wrap('CARGO / ÁREA: ______________________________________________________',M+10,9,RIGHT-M-20,14);wrap('PERÍODO: ____________       FECHA: ____________________',M+10,9,RIGHT-M-20,14)}
 y+=24;
 mc0206Questions.forEach(([title,q],i)=>{
  const a=record?.answers?.[i];const qlines=lines(q,9.3,RIGHT-M-23);const detail=a?.detail?lines('Descripción: '+a.detail,8.7,RIGHT-M-23):[];
  const estimated=34+qlines.length*14+28+detail.length*14+(record?0:25)+14;
  ensure(estimated);
  text(`${i+1}. ${title}`,M,y,10.5,true,BLUE);y+=18;
  wrap(q,M+2,9.3,RIGHT-M-9,14);
  y+=4;
  if(record){box(M,y-10,RIGHT-M,25,'#f1f7fb',null);text('RESPUESTA',M+10,y+6,8,true,'#59758c');text(a?.answer==='SI'?'SÍ':a?.answer==='NO'?'NO':'NO REGISTRADA',M+95,y+6,10,true,BLUE);y+=30;if(a?.detail)wrap('Descripción: '+a.detail,M+6,8.7,RIGHT-M-15,14)}
  else{box(M,y-10,RIGHT-M,24,'#f7fafc',null);text('☐  SÍ       ☐  NO',M+10,y+6,10,true,BLUE);y+=28;text('Observaciones: ______________________________________________________',M+5,y,8.5);y+=22}
  rule(y);y+=23;
 });
 heading('DECLARACIÓN Y COMPROMISO');
 wrap(mc0206Commitment,M+7,9.2,RIGHT-M-14,14.2);y+=13;
 if(record){heading('CONSTANCIA DE REGISTRO INTERNO');wrap('Aceptación del compromiso: SÍ',M+6,9.3,RIGHT-M-12,14,true);wrap('Fecha del registro: '+pdfDate(record.createdAt),M+6,9.1,RIGHT-M-12,14);wrap('Identificador: '+(record.id||`${record.year}_${record.personId}`),M+6,8.8,RIGHT-M-12,14);wrap('Usuario que registró (UID): '+(record.createdBy||'No disponible'),M+6,8.1,RIGHT-M-12,13);wrap('Constancia de registro interno. No equivale a firma electrónica certificada ni acredita autenticación personal mediante PIN.',M+6,8.1,RIGHT-M-12,12.5);y+=12;heading('EVALUACIÓN DE CALIDAD');wrap('Estado: '+(record.reviewStatus||'Sin evaluar').replaceAll('_',' '),M+6,9.1,RIGHT-M-12,14);if(record.assessment)wrap('Análisis: '+record.assessment,M+6,9,RIGHT-M-12,14);if(record.measures)wrap('Medidas: '+record.measures,M+6,9,RIGHT-M-12,14)}
 else{ensure(65);box(M,y-8,RIGHT-M,55,'#f5f9fc',BORDER);text('☐ Declaro que mis respuestas son veraces y acepto el compromiso.',M+9,y+9,9.2);text('Firma: ___________________________     Fecha: __________________',M+9,y+31,9);y+=65}
 savePage();
 return pages;
}
let logoCache=null,logoPending=false;
function getLogo(){if(logoCache)return logoCache;if(!logoPending&&typeof Image!=='undefined'){logoPending=true;const im=new Image();im.onload=()=>{logoCache=im};im.src='/logo-psi.jpg'}return logoCache}
export function mc0206Pdf(record=null,person=null){
 const pages=drawDocument(record,person,getLogo());const blob=buildPdfFromJpegs(pages);
 return new File([blob],record?`PSI-MC0206_V04_${record.year}_${String(record.personId).replace(/[^a-z0-9_-]/gi,'')}.pdf`:'PSI-MC0206_V04_PLANTILLA.pdf',{type:'application/pdf'});
}
export function openMc0206Pdf(record=null,person=null){const file=mc0206Pdf(record,person),url=URL.createObjectURL(file),win=window.open(url,'_blank');if(!win){URL.revokeObjectURL(url);throw Error('Permita ventanas emergentes para abrir el PDF.')}setTimeout(()=>URL.revokeObjectURL(url),120000)}
