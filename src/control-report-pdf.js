import {jsPDF} from 'jspdf';

const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const latin=s=>clean(s).replace(/[\u2013\u2014]/g,'-').replace(/[\u2022]/g,'·').replace(/[\u2713\u2714]/g,'OK').replace(/[\u26a0]/g,'!').replace(/[^\u0000-\u00ff]/g,'');
const safe=s=>clean(s).replace(/[^a-z0-9_-]+/gi,'_').slice(0,80);
async function svgImage(svg){
 try{
  const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const vb=svg.viewBox?.baseVal,w=vb?.width||720,h=vb?.height||265;
  copy.setAttribute('width',w);copy.setAttribute('height',h);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}));
  try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(2,2);ctx.drawImage(image,0,0,w,h);return {data:canvas.toDataURL('image/png'),ratio:h/w};}
  finally{URL.revokeObjectURL(url)}
 }catch(e){console.warn('Gráfico no exportable',e);return null}
}
export async function generateControlReport({card,month,container,download=false}){
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 const L=12,R=198,W=R-L,BOTTOM=280;let y=15,page=1;
 const navy=[25,55,79],blue=[22,102,148],pale=[237,245,250];
 const font=(size=8,bold=false,color=navy)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(...color)};
 const footer=()=>{pdf.setDrawColor(213,225,235);pdf.line(L,285,R,285);font(7,false,[100,116,130]);pdf.text('LAB-PSI | Consulta del ERP - Verificar contra registros originales',L,290);pdf.text(`Página ${page}`,R,290,{align:'right'})};
 const next=()=>{footer();pdf.addPage();page++;y=14};
 const room=h=>{if(y+h>BOTTOM)next()};
 const line=(value,size=8,bold=false,space=3.7)=>{font(size,bold);const lines=pdf.splitTextToSize(latin(value)||'-',W);room(lines.length*space+2);pdf.text(lines,L,y);y+=lines.length*space+2};
 const section=title=>{room(11);y+=2;pdf.setFillColor(...pale);pdf.roundedRect(L,y-4,W,8,1,1,'F');font(9,true);pdf.text(latin(title),L+3,y+1.5);y+=9};
 pdf.setFillColor(...blue);pdf.rect(0,0,210,5,'F');font(14,true,blue);pdf.text('LAB-PSI | REPORTE MENSUAL DE CARTA DE CONTROL',L,y);y+=7;
 line(card.name,10,true);line(`Periodo: ${month}   |   Emisión: ${new Date().toLocaleDateString('es-EC')}`,8);
 const root=container;
 const metrics=[...root.querySelectorAll('.cc100-kpis > div')].map(el=>latin(el.textContent)).filter(Boolean);
 if(metrics.length){section('RESUMEN TÉCNICO');const colW=W/2;for(let i=0;i<metrics.length;i+=2){const items=metrics.slice(i,i+2);const lines=items.map(t=>pdf.splitTextToSize(t,colW-6));const rh=Math.max(...lines.map(a=>a.length))*3.7+4;room(rh);items.forEach((t,j)=>{font(8,j===0);pdf.text(lines[j],L+j*colW+2,y)});y+=rh;}}
 const warning=root.querySelector('.cc107-status,.cc-unified-diagnosis,.form-error');
 if(warning){section('DIAGNÓSTICO DEL PERIODO');line(warning.textContent,8)}
 const tables=[...root.querySelectorAll('table')].filter(t=>t.querySelector('tbody tr'));
 if(tables.length){section('TRAZABILIDAD DEL PERIODO');
  for(const table of tables){const heads=[...table.querySelectorAll('thead th')].map(x=>latin(x.textContent));const rows=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(x=>latin(x.textContent)));
   const n=Math.max(heads.length,...rows.map(r=>r.length));if(!n)continue;
   const widths=Array(n).fill(W/n);if(n>=4){widths[0]=W*.17;widths[1]=W*.18;const remaining=W-widths[0]-widths[1];for(let i=2;i<n;i++)widths[i]=remaining/(n-2)}
   const renderRow=(cells,header=false)=>{const pad=1.4;const wrapped=widths.map((w,i)=>{font(header?7:6.8,header);return pdf.splitTextToSize(latin(cells[i]||'-'),w-pad*2)});const h=Math.max(6,...wrapped.map(a=>a.length*3.2+2));room(h);if(header){pdf.setFillColor(...pale);pdf.rect(L,y-3.1,W,h,'F')}else{pdf.setDrawColor(226,235,242);pdf.line(L,y+h-3.1,R,y+h-3.1)}let x=L;wrapped.forEach((lines,i)=>{font(header?7:6.8,header);pdf.text(lines,x+pad,y);x+=widths[i]});y+=h};
   if(heads.length)renderRow(heads,true);for(const row of rows){if(y>268&&heads.length){next();renderRow(heads,true)}renderRow(row)}y+=3;
  }
 }else{section('TRAZABILIDAD DEL PERIODO');line('Sin tabla de registros disponible en el panel para esta carta y periodo.',8)}
 const charts=[...root.querySelectorAll('.cc100-card')].filter(el=>el.querySelector('svg'));
 if(charts.length){section('GRÁFICOS Y TENDENCIAS');for(const chart of charts){const title=latin(chart.querySelector('h3')?.textContent)||'Control';const img=await svgImage(chart.querySelector('svg'));const notes=[...chart.querySelectorAll('.cc100-sub,.cc107-note,.cc107-warning')].map(el=>latin(el.textContent)).filter(Boolean);const h=img?Math.min(42,W*img.ratio):0;room(h+18);line(title,8,true);if(img){pdf.addImage(img.data,'PNG',L,y,W,h);y+=h+2}else line('Gráfico no exportable.',7);notes.slice(0,2).forEach(t=>line(t,7));}}
 section('OBSERVACIONES Y ALCANCE');line('Informe de consulta generado con los datos visibles del periodo seleccionado. El cumplimiento técnico y las señales estadísticas son evaluaciones distintas. Los registros originales y la decisión técnica autorizada prevalecen.',7);
 footer();const filename=`LABPSI_CC_${safe(card.name)}_${safe(month)}.pdf`;
 if(download)pdf.save(filename);else{const url=URL.createObjectURL(pdf.output('blob'));const win=window.open(url,'_blank');if(!win){URL.revokeObjectURL(url);throw new Error('El navegador bloqueó la vista previa. Permita ventanas emergentes o descargue el PDF.')}setTimeout(()=>URL.revokeObjectURL(url),120000)}
 return filename;
}
