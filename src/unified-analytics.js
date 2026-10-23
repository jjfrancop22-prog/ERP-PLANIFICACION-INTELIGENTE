import {visualChart} from './visual-chart.js';
import {openGenericHistory,loadGenericHistory,loadGenericHistoryThrough} from './generic-history.js';
import {generateControlReport} from './control-report-pdf.js';
import {DQO360_ID,dqo360Config} from './dqo360.js';
import {BATH364_ID,bath364Config} from './bath364.js';
import {MICRO365_ID,micro365Config} from './micro365.js';
import {INC306_ID,inc306Config} from './incubator306.js';
import {OVEN316_ID} from './oven316.js';
import {MUFLA328_ID} from './mufla328.js';
import {N105_ID,n105Config} from './thermal105.js';
import {HACH_ID,renderHACHAnalytics} from './thermal161.js';
import {BALANCE227_ID,renderBalance227Analytics} from './balance227.js';
import {NTK_ID,renderNTKAnalytics} from './thermal154.js';
import {collection,getDocs,query,where} from 'firebase/firestore';
import {db} from './firebase.js';
import {mountControlAnalytics} from './control-analytics.js';
import {mountConductivityAnalytics} from './conductivity-analytics.js';
import {balanceEnvironmentalCardId,dboEnvironmentalCardId,microEnvironmentalCardId,fridgeEnvironmentalCardId,standardsFridgeEnvironmentalCardId,agarFridgeEnvironmentalCardId,freezerEnvironmentalCardId} from './environmental.js';
const ENV='MC1602-08-METALES-EI313';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const monthNow=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};

// Centralized historical correction policy: never interpret a missing correction as zero.
// If no dated historical correction is available, use the current configured value
// as an explicitly provisional estimate, preserving the original source unchanged.
function historicalThermalValue(record,raw,config){
 const scalar=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
 // Generic historical import writes corrected=raw and corrections=[0] as placeholders.
 // Those fields are NOT documented metrological zero corrections.
 const placeholder=record.correctionBasis==='NINGUNA' &&
   scalar(record.corrected?.[0])===raw && scalar(record.corrections?.[0])===0;
 const documented=placeholder?null:scalar(record.corrected?.[0]);
 const savedCorrection=placeholder?null:scalar(record.corrections?.[0]);
 if(documented!==null)return {value:documented,correction:documented-raw,estimated:false};
 if(savedCorrection!==null)return {value:raw+savedCorrection,correction:savedCorrection,estimated:false};
 const fallback=scalar(config?.correction);
 if(fallback!==null)return {value:raw+fallback,correction:fallback,estimated:true};
 return {value:raw,correction:null,estimated:true};
}

function graph(rows,key,label,low,high){
 return visualChart(rows,{key,label,low,high});
}

function renderArchivedAnalytics(card,month,rows){
 const count=rows.length,good=rows.filter(r=>r.conforms===true).length,bad=rows.filter(r=>r.conforms===false).length;
 const length=Math.max(0,...rows.map(r=>Array.isArray(r.readings)?r.readings.length:0));
 const thermal=/digestor|hach|termorreactor|estufa|incubadora|mufla|baño|nevera|congelador/i.test(card.name);
 const limits=card.id===N105_ID?[103,107]:card.id===HACH_ID?[148,152]:[NaN,NaN];
 const charts=Array.from({length},(_,i)=>{
  const points=rows.filter(r=>r.readings?.[i]!==null&&r.readings?.[i]!==undefined&&r.readings?.[i]!==''&&Number.isFinite(Number(r.readings[i]))).map(r=>({date:r.date,value:Number.isFinite(Number(r.corrected?.[i]))&&r.corrected?.[i]!=null?Number(r.corrected[i]):Number(r.readings[i]),raw:r.readings[i],correction:r.corrections?.[i]}));
  if(!points.length)return '';
  const label=length===1?(thermal?'Temperatura (°C)':'Lectura'):card.kind==='CONDUCTIVIDAD'?['84 µS/cm','1413 µS/cm','12.88 mS/cm'][i]||`Nivel ${i+1}`:/ambiental|condiciones/i.test(card.name)?['Temperatura (°C)','Humedad relativa (%)'][i]||`Lectura ${i+1}`:`Lectura ${i+1}`;
  return `<article class="cc100-card"><h3>${esc(label)} · tendencia histórica</h3>${graph(points.map(p=>({...p,measurement:p.value})),'measurement',label,card.kind==='CONDUCTIVIDAD'?[84,1413,12.88][i]*.95:length===1?limits[0]:NaN,card.kind==='CONDUCTIVIDAD'?[84,1413,12.88][i]*1.05:length===1?limits[1]:NaN)}</article>`;
 }).join('');
 return `<section class="cc-generic-archive" style="margin-top:16px"><div class="cc100-kpis"><div><small>Registros históricos</small><strong>${count}</strong></div><div><small>Conformes documentados</small><strong>${good}</strong></div><div><small>No conformes documentados</small><strong>${bad}</strong></div><div><small>Cumplimiento físico</small><strong>${count?(good*100/count).toFixed(1)+'%':'—'}</strong></div></div><div class="cc107-status cc107-info" style="margin:12px 0"><b>Westgard · análisis exploratorio universal; pendiente de base estadística aprobada.</b> Las gráficas incluyen todas las mediciones históricas disponibles. Las señales exploratorias se muestran bajo cada gráfica; para decisiones de control se requieren media y desviación estándar de referencia validadas para cada nivel; los límites técnicos no son límites estadísticos. No se declara control estadístico con la media del mismo mes.</div><div class="cc100-charts">${charts}</div><article class="cc100-card"><h3>Histórico físico documentado · ${esc(month)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>Lecturas</th><th>Resultado documentado</th><th>Responsable</th><th>Referencia</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc((r.readings||[]).join(' · '))}</td><td>${r.conforms===true?'CONFORME':r.conforms===false?'NO CONFORME':esc(r.status)}</td><td>${esc(r.responsibleName)}</td><td>${esc(r.source)}</td></tr>`).join('')}</tbody></table></div></article></section>`;
}
export function mountUnifiedAnalytics(host,cards,profile){
 if(!host||profile?.role!=='JEFE')return;
 const available=cards.filter(c=>c.status!=='INACTIVO' && c.status!=='ELIMINADO').map(c=>({id:c.id,name:c.name,kind:c.kind}));
 for(const c of [{id:HACH_ID,name:'Carta de control del digestor HACH EI-161',kind:'THERMAL161'},{id:NTK_ID,name:'Carta de control digestor NTK EI-154',kind:'THERMAL154'},{id:BALANCE227_ID,name:'Carta de control de balanza EI-227 · PEC0104-06',kind:'BALANCE227'}])if(!available.some(x=>x.id===c.id))available.push(c);
 const legacy=[{id:ENV,name:'Condiciones ambientales – Metales EI-313'},{id:balanceEnvironmentalCardId,name:'Condiciones ambientales – Balanza EI-285'},{id:dboEnvironmentalCardId,name:'Condiciones ambientales – DBO5 EI-270'},{id:microEnvironmentalCardId,name:'Condiciones ambientales – Microbiología EI-347'},{id:fridgeEnvironmentalCardId,name:'Carta de control de nevera EI-269'}];
 for(const c of legacy)if(!available.some(x=>x.id===c.id))available.push({...c,kind:'ENV'});

 // Specialized cards are displayed separately in the master screen and do not
 // belong to controlCards. Include their real persistent IDs in the selector.
 const specialized=[
  [DQO360_ID,'Carta de control del termorreactor DQO EI-360'],
  [BATH364_ID,'Carta de control de baño María EI-364'],
  [MICRO365_ID,'Carta de control de incubadora de microbiología EI-365'],
  [INC306_ID,'Carta de control de incubadora DBO5 EI-306'],
  [OVEN316_ID,'Carta de control de estufa EI-316'],
  [MUFLA328_ID,'Carta de control de mufla EI-328'],
  [N105_ID,'Carta de control del digestor de nitrógeno EI-161 (105 °C)'],
  [standardsFridgeEnvironmentalCardId,'Carta de Control de Nevera de Patrones EI-344'],
  [agarFridgeEnvironmentalCardId,'Control de nevera de agares y cultivos EI-61'],
  [freezerEnvironmentalCardId,'Carta de control del congelador EI-349']
 ];
 for(const [id,name] of specialized)if(id&&!available.some(c=>c.id===id))available.push({id,name,kind:'ENV_SPECIAL'});
 // Include all existing configured cards; never invent records or duplicate identifiers.
 const previous=(()=>{try{return JSON.parse(sessionStorage.getItem('psi-analytics-choice')||'{}')}catch{return {}}})();
 host.innerHTML=`<section class="panel cc-unified"><div class="panel-heading"><div><span class="eyebrow">CALIDAD · ANÁLISIS ESTADÍSTICO</span><h2>Gestión inteligente de cartas de control</h2><p class="muted">Una carta y un mes a la vez · gráficas, diagnóstico e historial compartido</p></div></div><div class="cc-unified-toolbar"><label>Carta <span id="ccUnifiedCount" style="font-size:.8em;color:#58748d">(${available.length} disponibles)</span><select id="ccUnifiedCard">${available.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button class="outline" id="ccUnifiedShowAll" type="button" style="margin-top:6px;font-size:12px">Ver todas las ${available.length} cartas ▾</button></label><label>Mes<input id="ccUnifiedMonth" type="month" value="${monthNow()}"></label><button class="outline" id="ccUnifiedReload" type="button">Actualizar</button><button class="primary" id="ccUnifiedHistory" type="button" hidden>＋ Cargar histórico</button><button class="outline" id="ccUnifiedPreviewPdf" type="button">Ver PDF</button><button class="outline" id="ccUnifiedDownloadPdf" type="button">Descargar PDF</button></div><div id="ccUnifiedPicker" hidden style="margin:10px 0;padding:12px;border:1px solid #d8e5ef;border-radius:12px"><input id="ccUnifiedSearch" placeholder="Buscar carta por nombre o equipo…" style="width:100%;padding:10px;margin-bottom:8px"><div id="ccUnifiedList" style="max-height:340px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:6px"></div></div><div id="ccUnifiedResults" aria-live="polite"></div></section>`;
 const updateMasterCount=()=>{const summary=document.querySelector('.cc-master-collapse > summary');if(summary){const label=summary.firstChild;if(label&&label.nodeType===Node.TEXT_NODE)label.textContent=`📋 Cartas de control configuradas · ${available.length} cartas `;}};
 updateMasterCount();
 const result=host.querySelector('#ccUnifiedResults'),sel=host.querySelector('#ccUnifiedCard'),month=host.querySelector('#ccUnifiedMonth'),history=host.querySelector('#ccUnifiedHistory');let seq=0;
 const report=async(download)=>{const card=available.find(c=>c.id===sel.value);if(!card)return;const btn=host.querySelector(download?'#ccUnifiedDownloadPdf':'#ccUnifiedPreviewPdf');btn.disabled=true;const label=btn.textContent;btn.textContent='Preparando PDF…';try{await generateControlReport({card,month:month.value,container:result,download})}catch(e){alert('No se pudo generar el PDF: '+e.message)}finally{btn.disabled=false;btn.textContent=label}};
 host.querySelector('#ccUnifiedPreviewPdf').onclick=()=>report(false);
 host.querySelector('#ccUnifiedDownloadPdf').onclick=()=>report(true);
 const picker=host.querySelector('#ccUnifiedPicker'),search=host.querySelector('#ccUnifiedSearch'),list=host.querySelector('#ccUnifiedList'),showAll=host.querySelector('#ccUnifiedShowAll');
 const paintList=()=>{const term=search.value.trim().toLocaleLowerCase();list.replaceChildren();for(const c of available.filter(c=>`${c.name} ${c.id}`.toLocaleLowerCase().includes(term))){const b=document.createElement('button');b.type='button';b.className='outline';b.style.cssText='text-align:left;white-space:normal;padding:9px';b.textContent=c.name;b.onclick=()=>{sel.value=c.id;picker.hidden=true;showAll.textContent=`Ver todas las ${available.length} cartas ▾`;load()};list.appendChild(b)}if(!list.children.length)list.textContent='No hay cartas que coincidan con la búsqueda.'};
 showAll.onclick=()=>{picker.hidden=!picker.hidden;showAll.textContent=picker.hidden?`Ver todas las ${available.length} cartas ▾`:'Ocultar lista ▴';if(!picker.hidden){paintList();search.focus()}};
 search.addEventListener('input',paintList);
 if(previous.card&&available.some(c=>c.id===previous.card))sel.value=previous.card;
 if(/^\d{4}-(0[1-9]|1[0-2])$/.test(previous.month||''))month.value=previous.month;
 const load=async()=>{const ticket=++seq,card=available.find(c=>c.id===sel.value),m=month.value;try{sessionStorage.setItem('psi-analytics-choice',JSON.stringify({card:sel.value,month:m}))}catch{};host.querySelectorAll('.cc-generic-archive').forEach(x=>x.remove());result.innerHTML='<p class="muted">Consultando registros en Firebase…</p>';history.hidden=false;history.onclick=()=>openGenericHistory(card,m,load);if(!card)return;
 if(card.id!==N105_ID&&card.id!==DQO360_ID&&card.id!==BATH364_ID&&card.id!==MICRO365_ID&&card.id!==INC306_ID&&card.id!==BALANCE227_ID&&card.kind!=='ENV'&&card.kind!=='ENV_SPECIAL'&&!['MULTIPUNTO','THERMAL161','THERMAL154','CONDUCTIVIDAD'].includes(card.kind)){
  // Show archived readings independently of the specialized daily-record engine.
  // Never overwrite daily records or claim a validated Westgard baseline.
  loadGenericHistory(card,m).then(rows=>{
   if(ticket!==seq||!rows.length||!host.isConnected)return;
   host.querySelectorAll('.cc-generic-archive').forEach(x=>x.remove());
   const panel=document.createElement('div');panel.innerHTML=renderArchivedAnalytics(card,m,rows);
   const node=panel.firstElementChild;if(node)result.after(node);
  }).catch(e=>{if(ticket===seq){const note=document.createElement('p');note.className='form-error cc-generic-archive';note.textContent='No se pudo cargar el análisis histórico: '+e.message;result.after(note);}});
 }
 if(card.id===INC306_ID){
  try{
   const c=await inc306Config();
   const [snap,archive]=await Promise.all([
    getDocs(collection(db,'incubator306Records')),
    loadGenericHistoryThrough(card,m)
   ]);
   if(ticket!==seq)return;
   const scalar=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
   const map=new Map();
   for(const r of archive){
    if(typeof r.date!=='string'||r.date.slice(0,7)>m)continue;
    const raw=scalar(r.readings?.[0]);if(raw===null)continue;
    // Historical imports may store corrected=raw and correction=0 as placeholders.
    // Never treat these placeholders as a documented zero correction.
    const correctionInfo=historicalThermalValue(r,raw,{correction:c.patternCorrection});
    map.set(r.date,{date:r.date,raw,...correctionInfo,origin:'Histórico físico',responsible:r.responsibleName||''});
   }
   for(const d of snap.docs){
    const r=d.data();
    if(r.cardId!==INC306_ID||typeof r.date!=='string'||r.date.slice(0,7)>m)continue;
    const raw=scalar(r.pattern),saved=scalar(r.patternCorrected);
    if(raw===null)continue;
    const recordedCorrection=scalar(r.patternCorrection);
    const correction=saved!==null?saved-raw:recordedCorrection!==null?recordedCorrection:scalar(c.patternCorrection);
    const value=saved!==null?saved:correction!==null?raw+correction:raw;
    map.set(r.date,{date:r.date,raw,value,correction,estimated:saved===null&&recordedCorrection===null,origin:'Digital',responsible:r.responsibleName||''});
   }
   const series=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
   const monthly=series.filter(r=>r.date.slice(0,7)===m);
   const min=Number(c.min),max=Number(c.max);
   const good=monthly.filter(r=>r.value>=min&&r.value<=max).length;
   const chart=visualChart(monthly,{label:'Incubadora DBO5 EI-306 · temperatura corregida',low:min,high:max,unit:'°C',precision:3,analysisRows:series});
   result.innerHTML=`<div class="cc100-kpis"><div><small>Mediciones del mes</small><strong>${monthly.length}</strong></div><div><small>Conformes técnicos</small><strong>${good}</strong></div><div><small>No conformes técnicos</small><strong>${monthly.length-good}</strong></div><div><small>Mediciones acumuladas (físicas + digitales)</small><strong>${series.length}</strong></div><div><small>Equipo / patrón</small><strong>EI-306 · ${esc(c.reference||'PF/09')}</strong></div></div><p class="cc107-status cc107-info">Incubadora DBO5 EI-306 · objetivo ${esc(c.center)} °C; límites configurados: ${esc(c.min)}–${esc(c.max)} °C. La serie consolidada integra históricos físicos y controles digitales hasta ${esc(m)}; la gráfica muestra solo el mes seleccionado. Ante coincidencias de fecha prevalece el registro digital sin eliminar el histórico. Las señales Westgard son exploratorias y no equivalen a límites estadísticos aprobados. ${series.some(r=>r.estimated)?'⚠ Algunas correcciones se estimaron usando la configuración actual: verificar el certificado y su vigencia antes de aprobar resultados.':''}</p><article class="cc100-card"><h3>Temperatura corregida (°C) · ${esc(m)}</h3>${chart}</article><article class="cc100-card"><h3>Histórico consolidado · ${esc(m)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>Origen</th><th>Lectura PF/09</th><th>Corrección</th><th>Temperatura corregida</th><th>Conformidad técnica</th><th>Responsable</th></tr></thead><tbody>${monthly.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.origin)}</td><td>${esc(r.raw)}</td><td>${r.correction===null?'SIN DATO':esc(r.correction.toFixed(3))}${r.estimated?' ⚠ estimada':''}</td><td>${esc(r.value.toFixed(3))}</td><td>${r.value>=min&&r.value<=max?'CONFORME':'NO CONFORME'}</td><td>${esc(r.responsible)}</td></tr>`).join('')||'<tr><td colspan="7">Sin registros de este mes para EI-306.</td></tr>'}</tbody></table></div></article>`;
  }catch(e){if(ticket===seq)result.textContent='No se pudo cargar el análisis EI-306: '+e.message;}
  return;
 }
 if(card.id===DQO360_ID||card.id===BATH364_ID||card.id===MICRO365_ID){
  const isBath=card.id===BATH364_ID;
  const isMicro=card.id===MICRO365_ID;
  const controlId=isMicro?MICRO365_ID:(isBath?BATH364_ID:DQO360_ID);
  const equipment=isMicro?'EI-365':(isBath?'EI-364':'EI-360');
  const controlName=isMicro?'Incubadora de microbiología EI-365':(isBath?'Baño María EI-364':'Termorreactor DQO EI-360');
  try{
   const c=await (isMicro?micro365Config():isBath?bath364Config():dqo360Config());
   const [snap,archive]=await Promise.all([
    getDocs(query(collection(db,'thermalControlRecords'),where('cardId','==',controlId))),
    loadGenericHistoryThrough(card,m)
   ]);
   if(ticket!==seq)return;
   const map=new Map();
   for(const r of archive){
    if(typeof r.date!=='string'||r.date.slice(0,7)>m)continue;
    const reading=r.readings?.[0];if(reading==null||reading==='')continue;
    const raw=Number(reading);if(!Number.isFinite(raw))continue;
    const correctionInfo=historicalThermalValue(r,raw,c);
    map.set(r.date,{date:r.date,raw,...correctionInfo,origin:'Histórico físico',responsible:r.responsibleName||''});
   }
   for(const d of snap.docs){const r=d.data();
    if(typeof r.date!=='string'||r.date.slice(0,7)>m||!Number.isFinite(Number(r.corrected))||!Number.isFinite(Number(r.reading)))continue;
    map.set(r.date,{date:r.date,raw:Number(r.reading),value:Number(r.corrected),correction:Number(r.corrected)-Number(r.reading),origin:'Digital',responsible:r.responsibleName||''});
   }
   const series=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
   const monthly=series.filter(r=>r.date.slice(0,7)===m);
   const min=Number(c.min),max=Number(c.max),good=monthly.filter(r=>r.value>=min&&r.value<=max).length;
   const chart=visualChart(monthly,{label:controlName+' · temperatura corregida',low:min,high:max,unit:'°C',precision:2,analysisRows:series});
   result.innerHTML=`<div class="cc100-kpis"><div><small>Mediciones del mes</small><strong>${monthly.length}</strong></div><div><small>Conformes técnicos</small><strong>${good}</strong></div><div><small>No conformes técnicos</small><strong>${monthly.length-good}</strong></div><div><small>Mediciones acumuladas (físicas + digitales)</small><strong>${series.length}</strong></div><div><small>Equipo / patrón</small><strong>${equipment} · ${esc(c.reference||'PF/09')}</strong></div></div><p class="cc107-status cc107-info">${controlName} · límites configurados: ${esc(c.min)}–${esc(c.max)} °C. Serie acumulada hasta ${esc(m)}, con histórico físico y registros digitales. La gráfica muestra únicamente el mes seleccionado. Registros digitales prevalecen ante coincidencias de fecha, sin eliminar históricos. Westgard exploratorio: no equivale a límites estadísticos aprobados. ${series.some(r=>r.estimated)?'⚠ Correcciones históricas estimadas con la configuración actual: verificar certificado y vigencia antes de aprobar resultados.':''}</p><article class="cc100-card"><h3>Temperatura corregida (°C) · ${esc(m)}</h3>${chart}</article><article class="cc100-card"><h3>Histórico consolidado · ${esc(m)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>Origen</th><th>Lectura</th><th>Corrección</th><th>Resultado corregido</th><th>Conformidad técnica</th><th>Responsable</th></tr></thead><tbody>${monthly.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.origin)}</td><td>${esc(r.raw)}</td><td>${r.correction===null?'SIN DATO':esc(r.correction.toFixed(3))}${r.estimated?' ⚠ estimada':''}</td><td>${esc(r.value.toFixed(3))}</td><td>${r.value>=min&&r.value<=max?'CONFORME':'NO CONFORME'}</td><td>${esc(r.responsible)}</td></tr>`).join('')||'<tr><td colspan="7">Sin registros de este mes para ${equipment}.</td></tr>'}</tbody></table></div></article>`;
  }catch(e){if(ticket===seq)result.textContent='No se pudo cargar el análisis '+equipment+': '+e.message;}
  return;
 }
 if(card.id===N105_ID){
  try{
   const c=await n105Config();
   // Fetch the complete digital series for this exact card, not HACH EI-161 (150 °C).
   const snap=await getDocs(query(collection(db,'thermalControlRecords'),where('cardId','==',N105_ID)));
   if(ticket!==seq)return;
   const digital=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>typeof r.date==='string'&&r.date.slice(0,7)<=m);
   const archive=await loadGenericHistoryThrough(card,m);
   if(ticket!==seq)return;
   // The documented and digital records form ONE chronological series for this
   // exact 105 °C control. Digital entries take precedence on the same date.
   const map=new Map();
   for(const r of archive){
    if(typeof r.date!=='string')continue;
    const reading=r.readings?.[0];if(reading==null||reading==='')continue;
    const raw=Number(reading);if(!Number.isFinite(raw))continue;
    const documented=r.corrected?.[0];
    const corrected=documented!=null&&documented!==''&&Number.isFinite(Number(documented))?Number(documented):raw;
    map.set(r.date,{date:r.date,raw,correction:corrected-raw,value:corrected,origin:'Histórico físico',responsible:r.responsibleName||'',source:r.source||''});
   }
   for(const r of digital){
    if(typeof r.date!=='string')continue;
    const raw=Number(r.reading),value=Number(r.corrected);
    if(!Number.isFinite(value)||!Number.isFinite(raw))continue;
    map.set(r.date,{date:r.date,raw,correction:value-raw,value,origin:'Digital',responsible:r.responsibleName||'',source:r.evidence||''});
   }
   const series=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
   const monthly=series.filter(r=>r.date.slice(0,7)===m);
   const accumulated=series.map(r=>({date:r.date,value:r.value,raw:r.raw,correction:r.correction}));
   const good=monthly.filter(r=>r.value>=Number(c.min)&&r.value<=Number(c.max)).length;
   const chart=visualChart(monthly,{label:'Nitrógeno EI-161 · 105 °C',low:Number(c.min),high:Number(c.max),unit:'°C',precision:2,analysisRows:accumulated});
   result.innerHTML=`<div class="cc100-kpis"><div><small>Mediciones del mes</small><strong>${monthly.length}</strong></div><div><small>Conformes técnicos</small><strong>${good}</strong></div><div><small>No conformes técnicos</small><strong>${monthly.length-good}</strong></div><div><small>Mediciones acumuladas (físicas + digitales)</small><strong>${accumulated.length}</strong></div><div><small>Equipo / patrón</small><strong>EI-161 · ${esc(c.reference||'PF/09')}</strong></div></div><p class="cc107-status cc107-info">Control de nitrógeno total a 105 °C. Límites obtenidos de la configuración vigente: ${esc(c.min)}–${esc(c.max)} °C. El análisis acumulativo integra los registros físicos y digitales hasta el mes seleccionado, sin mezclar el control de 150 °C. Si coinciden en fecha, se utiliza la medición digital sin borrar la evidencia física. La evaluación Westgard es exploratoria, no una declaración de control aprobado.</p><article class="cc100-card"><h3>Temperatura corregida (°C) · ${esc(m)}</h3>${chart}</article><article class="cc100-card"><h3>Historial consolidado · ${esc(m)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>Origen</th><th>Lectura</th><th>Corrección</th><th>Corregido</th><th>Evaluación técnica</th><th>Responsable</th></tr></thead><tbody>${monthly.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.origin)}</td><td>${esc(r.raw)}</td><td>${r.correction===null?'SIN DATO':esc(r.correction.toFixed(3))}${r.estimated?' ⚠ estimada':''}</td><td>${esc(r.value.toFixed(3))}</td><td>${r.value>=Number(c.min)&&r.value<=Number(c.max)?'CONFORME':'NO CONFORME'}</td><td>${esc(r.responsible)}</td></tr>`).join('')||'<tr><td colspan="7">Sin mediciones en este mes.</td></tr>'}</tbody></table></div></article>`;
  }catch(e){if(ticket===seq)result.textContent='No se pudo cargar el control de 105 °C: '+e.message;}
  return;
 }
 if(card.kind==='THERMAL161'){try{const archived=await loadGenericHistory(card,m);if(ticket!==seq)return;await renderHACHAnalytics(result,m,archived);}catch(e){if(ticket===seq)result.textContent='Error consultando el historial unificado: '+e.message;}return;}
 if(card.kind==='THERMAL154'){try{const archived=await loadGenericHistory(card,m);if(ticket!==seq)return;await renderNTKAnalytics(result,m,archived);}catch(e){if(ticket===seq)result.textContent='Error consultando el historial unificado: '+e.message;}return;}
 if(card.kind==='BALANCE227'){await renderBalance227Analytics(result,m);return;}
 if(card.kind==='MULTIPUNTO'||card.kind==='CONDUCTIVIDAD'){
  // Mount into the connected results container: event handlers query their mount root.
  // A detached temporary root loses its children when moved and breaks both charts and history.
  result.replaceChildren();
  if(card.kind==='MULTIPUNTO')mountControlAnalytics(result,cards,profile,{deferInitialLoad:true});else mountConductivityAnalytics(result,cards);
  const internal=result.querySelector(card.kind==='MULTIPUNTO'?'#cc100Card':'#condCard'),internalMonth=result.querySelector(card.kind==='MULTIPUNTO'?'#cc100Month':'#condMonth');
  if(!internal||!internalMonth){result.textContent='No se pudo inicializar la carta.';return;}
  internal.value=card.id;internalMonth.value=m;
  const section=result.querySelector('section');section?.querySelector('.panel-heading')?.remove();
  // La selección visible del mes y la carta es la única fuente de verdad.
  // Los filtros internos quedan ocultos, pero permanecen montados para el histórico.
  if(section){for(const child of [...section.children]){if(child.id==='cc100Results'||child.id==='condResults')continue;child.classList.add('cc-unified-internal');}}
  if(card.kind==='MULTIPUNTO'){
    const internalHistory=result.querySelector('#cc110History');
    if(internalHistory){history.hidden=false;history.onclick=()=>{
      const selectedMonth=result.querySelector('#cc100Month');
      if(selectedMonth)selectedMonth.value=month.value;
      internalHistory.click();
    };}
  }
  internal.dispatchEvent(new Event('change')); // refresh after selected card/month are applied
  return;
 }
 if(card.kind!=='ENV'&&card.kind!=='ENV_SPECIAL'){result.innerHTML=`<div class="cc107-status cc107-info">${esc(card.name)}: esta familia utiliza un registro especializado. Puede consultar su historial desde «Cartas de control configuradas»; no se sustituyen sus cálculos por gráficos genéricos.</div>`;return;}
 try{
  // V352: one shared pipeline for environmental, refrigerator and freezer cards.
  // Read through the selected month so statistical analysis has an accumulated series.
  const [snap,archived,configsSnap]=await Promise.all([
   getDocs(query(collection(db,'environmentalRecords'),where('cardId','==',card.id))),
   loadGenericHistoryThrough(card,m),
   getDocs(query(collection(db,'environmentalConfigs'),where('cardId','==',card.id)))
  ]);
  if(ticket!==seq)return;
  const digital=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>typeof r.date==='string'&&r.date.slice(0,7)<=m);
  const configs=configsSnap.docs.map(d=>d.data()).filter(c=>typeof c.validFrom==='string').sort((a,b)=>b.validFrom.localeCompare(a.validFrom));
  const configFor=date=>configs.find(c=>c.validFrom<=date)||null;
  const calibrated=(points,reading)=>{
   if(reading===null||!Array.isArray(points))return {factor:null,review:true};
   if(points.length===1&&Number.isFinite(Number(points[0].factor))){const p=points[0];return reading>=Number(p.from)&&reading<Number(p.to)?{factor:Number(p.factor),review:false}:{factor:null,review:true};}
   const sorted=points.filter(p=>Number.isFinite(Number(p.indication))&&Number.isFinite(Number(p.error))).sort((a,b)=>Number(a.indication)-Number(b.indication));
   if(sorted.length<2)return {factor:null,review:true};
   if(reading<Number(sorted[0].indication)||reading>Number(sorted.at(-1).indication)){
    const edge=reading<Number(sorted[0].indication)?sorted[0]:sorted.at(-1);
    return {factor:-Number(edge.error),review:true};
   }
   for(let i=1;i<sorted.length;i++)if(reading<=Number(sorted[i].indication)){
    const a=sorted[i-1],b=sorted[i],dx=Number(b.indication)-Number(a.indication);
    return dx>0?{factor:-Number(a.error)-(Number(b.error)-Number(a.error))*(reading-Number(a.indication))/dx,review:false}:{factor:null,review:true};
   }
   return {factor:null,review:true};
  };
  const byDate=new Map();
  const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
  for(const r of archived){
   if(typeof r.date!=='string'||r.date.slice(0,7)>m)continue;
   const rawT=finite(r.readings?.[0]),rawRH=finite(r.readings?.[1]);
   if(rawT===null)continue;
   const cfg=configFor(r.date);
   const t=cfg?calibrated(cfg.tempRanges,rawT):{factor:null,review:true};
   const rh=rawRH===null?null:(cfg?calibrated(cfg.rhRanges,rawRH):{factor:null,review:true});
   const valid=!!cfg&&!t.review&&(rh===null||!rh.review);
   byDate.set(r.date,{date:r.date,tempRead:rawT,tempFactor:t.factor,tempCorrected:t.factor===null?rawT:rawT+t.factor,rhRead:rawRH,rhFactor:rh?.factor??null,rhCorrected:rh===null?null:rh.factor===null?rawRH:rawRH+rh.factor,estimated:!valid,origin:'Histórico físico',responsibleName:r.responsibleName||'',certificate:cfg?.certificate||r.certificate||'',source:r.source||'',minT:cfg?.minT??null,maxT:cfg?.maxT??null,minRH:cfg?.minRH??(cfg?.temperatureOnly?null:0),maxRH:cfg?.maxRH??null});
  }
  for(const r of digital){
   if(!r.date)continue;
   byDate.set(r.date,{...r,origin:'Digital',estimated:r.status==='REVISION_METROLOGICA',source:r.certificate||''});
  }
  const accumulated=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const rows=accumulated.filter(r=>r.date.slice(0,7)===m);
  const tempOnly=accumulated.every(r=>r.rhRead==null);
  // A historical record without date-valid limits or documented correction is not
  // silently certified using the latest configuration.
  const evaluate=r=>{
   if(r.estimated)return 'REVISION_METROLOGICA';
   const t=finite(r.tempCorrected),lo=finite(r.minT),hi=finite(r.maxT);
   if(t===null||lo===null||hi===null)return 'REVISION_METROLOGICA';
   if(t<lo||t>hi)return 'NO_CONFORME';
   if(r.rhRead!=null){const h=finite(r.rhCorrected),l=finite(r.minRH),u=finite(r.maxRH);if(h===null||l===null||u===null)return 'REVISION_METROLOGICA';if(h<l||h>u)return 'NO_CONFORME';}
   return 'CONFORME';
  };
  const good=rows.filter(r=>evaluate(r)==='CONFORME').length,bad=rows.filter(r=>evaluate(r)==='NO_CONFORME').length,review=rows.length-good-bad;
  const latest=[...rows].reverse().find(r=>finite(r.minT)!==null&&finite(r.maxT)!==null);
  const low=latest?.minT,high=latest?.maxT,rhLow=latest?.minRH,rhHigh=latest?.maxRH;
  const chart=(key,label,lo,hi)=>visualChart(rows.filter(r=>finite(r[key])!==null).map(r=>({date:r.date,value:Number(r[key])})),{label,low:finite(lo)??NaN,high:finite(hi)??NaN,analysisRows:accumulated.filter(r=>finite(r[key])!==null).map(r=>({date:r.date,value:Number(r[key])}))});
  const fmt=x=>finite(x)===null?'—':Number(x).toFixed(3);
  result.innerHTML=`<div class="cc100-kpis"><div><small>Controles del mes</small><strong>${rows.length}</strong></div><div><small>Conformes</small><strong>${good}</strong></div><div><small>No conformes</small><strong>${bad}</strong></div><div><small>Revisión metrológica</small><strong>${review}</strong></div><div><small>Acumuladas hasta ${esc(m)}</small><strong>${accumulated.length}</strong></div></div><p class="cc107-status cc107-info">Histórico físico y digital consolidado. Se muestra un registro por fecha; prevalece el digital en coincidencias, sin borrar el físico. Para históricos se aplica automáticamente la configuración metrológica vigente desde su fecha de inicio, con interpolación por lectura. Fuera del rango calibrado o sin configuración válida se indica REVISIÓN METROLÓGICA. Westgard: análisis exploratorio hasta aprobar una referencia estadística independiente.</p><div class="cc100-charts"><article class="cc100-card"><h3>Temperatura corregida (°C)</h3>${chart('tempCorrected','Temperatura',low,high)}</article>${tempOnly?'':`<article class="cc100-card"><h3>Humedad relativa corregida (%)</h3>${chart('rhCorrected','Humedad relativa',rhLow,rhHigh)}</article>`}</div><article class="cc100-card"><h3>Historial único y trazabilidad · ${esc(m)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>Origen</th><th>Responsable</th><th>T leída</th><th>Corrección T</th><th>T corregida</th>${tempOnly?'':'<th>HR leída</th><th>Corrección HR</th><th>HR corregida</th>'}<th>Decisión técnica</th><th>Certificado / fuente</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.origin)}</td><td>${esc(r.responsibleName||r.completedBy||'—')}</td><td>${fmt(r.tempRead)}</td><td>${fmt(r.tempFactor)}</td><td>${fmt(r.tempCorrected)}</td>${tempOnly?'':`<td>${fmt(r.rhRead)}</td><td>${fmt(r.rhFactor)}</td><td>${fmt(r.rhCorrected)}</td>`}<td>${esc(evaluate(r).replaceAll('_',' '))}</td><td>${esc(r.certificate||r.source||'—')}</td></tr>`).join('')||`<tr><td colspan="${tempOnly?8:11}">Sin mediciones en el mes seleccionado.</td></tr>`}</tbody></table></div></article>`;
 }catch(e){if(ticket===seq)result.innerHTML=`<p class="form-error">No se pudo consultar Firebase: ${esc(e.message)}. Revise las reglas de lectura de environmentalRecords.</p>`}
 };
 const syncCards=async()=>{try{const snapshot=await getDocs(collection(db,'environmentalCards'));const selected=sel.value;for(const d of snapshot.docs){const data=d.data();const entry=available.find(c=>c.id===d.id);if(entry){entry.name=data.name||entry.name;}else available.push({id:d.id,name:data.name||d.id,kind:'ENV'});}sel.innerHTML=available.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');if(available.some(c=>c.id===selected))sel.value=selected;const count=host.querySelector('#ccUnifiedCount');if(count)count.textContent=`(${available.length} disponibles)`;showAll.textContent=`Ver todas las ${available.length} cartas ▾`;updateMasterCount();}catch(e){console.warn('No se pudo sincronizar el catálogo de cartas ambientales',e);}};
 sel.onchange=load;month.onchange=load;host.querySelector('#ccUnifiedReload').onclick=async()=>{await syncCards();await load()};
 const onChanged=async()=>{if(!host.isConnected)return;await syncCards();await load()};window.addEventListener('psi-environmental-changed',onChanged);
 syncCards().then(load);

}
