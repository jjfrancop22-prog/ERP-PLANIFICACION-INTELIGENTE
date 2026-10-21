import {HACH_ID,renderHACHAnalytics} from './thermal161.js';
import {BALANCE227_ID,renderBalance227Analytics} from './balance227.js';
import {NTK_ID,renderNTKAnalytics} from './thermal154.js';
import {collection,getDocs,query,where} from 'firebase/firestore';
import {db} from './firebase.js';
import {mountControlAnalytics} from './control-analytics.js';
import {mountConductivityAnalytics} from './conductivity-analytics.js';
import {balanceEnvironmentalCardId,dboEnvironmentalCardId,microEnvironmentalCardId,fridgeEnvironmentalCardId} from './environmental.js';
const ENV='MC1602-08-METALES-EI313';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const monthNow=()=>new Date().toLocaleDateString('en-CA').slice(0,7);
function graph(rows,key,label,low,high){
 const points=rows.filter(r=>Number.isFinite(Number(r[key]))&&r[key]!=null).map(r=>({date:r.date,value:Number(r[key])}));
 if(!points.length)return '<p class="muted">Sin registros para graficar en el mes seleccionado.</p>';
 const vals=points.map(p=>p.value),mean=vals.reduce((a,b)=>a+b,0)/vals.length,sd=vals.length>1?Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/(vals.length-1)):0;
 const min=Math.min(...vals,...[low,high].filter(Number.isFinite)),max=Math.max(...vals,...[low,high].filter(Number.isFinite)),span=max-min||1,pad=span*.12;
 const y=v=>210-(v-(min-pad))/(span+2*pad)*170,x=i=>45+i*585/Math.max(1,points.length-1);
 const rule=(v,name)=>Number.isFinite(v)?`<line x1="45" x2="630" y1="${y(v)}" y2="${y(v)}" stroke="#c07b35" stroke-dasharray="5 5"/><text x="635" y="${y(v)}" font-size="10">${name}</text>`:'';
 return `<svg viewBox="0 0 710 245" style="width:100%" role="img" aria-label="Tendencia ${esc(label)}">${rule(low,'Mín.')}${rule(high,'Máx.')}<line x1="45" x2="630" y1="${y(mean)}" y2="${y(mean)}" stroke="#7d91a8" stroke-dasharray="3 4"/><polyline fill="none" stroke="#1474a4" stroke-width="2.5" points="${points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' ')}"/>${points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="white" stroke="#1474a4"><title>${esc(p.date)}: ${p.value}</title></circle>`).join('')}</svg><p class="muted">Media ${mean.toFixed(2)} · s ${vals.length>1?sd.toFixed(2):'—'} · ${vals.length} registro(s). ${vals.length<10?'Datos insuficientes para análisis estadístico concluyente.':'Interpretación estadística orientativa; requiere límites de control validados.'}</p>`;
}
export function mountUnifiedAnalytics(host,cards,profile){
 if(!host||profile?.role!=='JEFE')return;
 const available=cards.filter(c=>c.status==='ACTIVO'&&['MULTIPUNTO','CONDUCTIVIDAD'].includes(c.kind)).map(c=>({id:c.id,name:c.name,kind:c.kind}));
 available.push({id:HACH_ID,name:'Carta de control del digestor HACH EI-161',kind:'THERMAL161'});
 available.push({id:NTK_ID,name:'Carta de control digestor NTK EI-154',kind:'THERMAL154'});
 available.push({id:BALANCE227_ID,name:'Carta de control de balanza EI-227 · PEC0104-06',kind:'BALANCE227'});
 const legacy=[{id:ENV,name:'Condiciones ambientales – Metales EI-313'},{id:balanceEnvironmentalCardId,name:'Condiciones ambientales – Balanza EI-285'},{id:dboEnvironmentalCardId,name:'Condiciones ambientales – DBO5 EI-270'},{id:microEnvironmentalCardId,name:'Condiciones ambientales – Microbiología EI-347'},{id:fridgeEnvironmentalCardId,name:'Carta de control de nevera EI-269'}];
 for(const c of legacy)available.push({...c,kind:'ENV'});
 host.innerHTML=`<section class="panel cc-unified"><div class="panel-heading"><div><span class="eyebrow">CALIDAD · ANÁLISIS ESTADÍSTICO</span><h2>Gestión inteligente de cartas de control</h2><p class="muted">Una carta y un mes a la vez · gráficas, diagnóstico e historial compartido</p></div></div><div class="cc-unified-toolbar"><label>Carta<select id="ccUnifiedCard">${available.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label>Mes<input id="ccUnifiedMonth" type="month" value="${monthNow()}"></label><button class="outline" id="ccUnifiedReload" type="button">Actualizar</button></div><div id="ccUnifiedResults" aria-live="polite"></div></section>`;
 const result=host.querySelector('#ccUnifiedResults'),sel=host.querySelector('#ccUnifiedCard'),month=host.querySelector('#ccUnifiedMonth');let seq=0;
 const load=async()=>{const ticket=++seq,card=available.find(c=>c.id===sel.value),m=month.value;result.innerHTML='<p class="muted">Consultando registros en Firebase…</p>';if(!card)return;
 if(card.kind==='THERMAL161'){await renderHACHAnalytics(result,m);return;}
 if(card.kind==='THERMAL154'){await renderNTKAnalytics(result,m);return;}
 if(card.kind==='BALANCE227'){await renderBalance227Analytics(result,m);return;}
 if(card.kind!=='ENV'){
  const temp=document.createElement('div');
  if(card.kind==='MULTIPUNTO')mountControlAnalytics(temp,cards,profile);else mountConductivityAnalytics(temp,cards);
  const internal=temp.querySelector(card.kind==='MULTIPUNTO'?'#cc100Card':'#condCard'),internalMonth=temp.querySelector(card.kind==='MULTIPUNTO'?'#cc100Month':'#condMonth');
  if(!internal||!internalMonth){result.textContent='No se pudo inicializar la carta.';return;}
  internal.value=card.id;internalMonth.value=m;
  const section=temp.querySelector('section');section.querySelector('.panel-heading')?.remove();section.querySelector(card.kind==='MULTIPUNTO'?'.cc100-filters':'label')?.classList.add('cc-unified-internal');
  result.replaceChildren(...Array.from(temp.childNodes));
  internal.dispatchEvent(new Event('change'));
  return;
 }
 try{
  const snap=await getDocs(query(collection(db,'environmentalRecords'),where('month','==',m)));
  if(ticket!==seq)return;
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.cardId===card.id).sort((a,b)=>a.date.localeCompare(b.date));
  const good=rows.filter(r=>r.status==='COMPLETADA').length,reviewCount=rows.filter(r=>r.status==='REVISION_METROLOGICA').length,badCount=rows.filter(r=>r.status==='NO_CONFORME').length,latest=rows.at(-1);
  const tempOnly=rows.length?rows.every(r=>r.rhRead==null):!([ENV,balanceEnvironmentalCardId,dboEnvironmentalCardId,microEnvironmentalCardId].includes(card.id));const defaults=tempOnly?[0,6,null,null]:card.id===microEnvironmentalCardId?[15,25,80,0]:card.id===dboEnvironmentalCardId?[17,23,80,20]:card.id===balanceEnvironmentalCardId?[10,30,60,0]:[10,30,60,0];const low=latest?.minT??defaults[0],high=latest?.maxT??defaults[1],rh=latest?.maxRH??defaults[2],rhMin=latest?.minRH??defaults[3];
  result.innerHTML=`<div class="cc100-kpis"><div><small>Controles del mes</small><strong>${rows.length}</strong></div><div><small>Cumplimiento técnico</small><strong>${rows.length?(100*good/rows.length).toFixed(1)+'%':'—'}</strong></div><div><small>Conformes</small><strong>${good}</strong></div><div><small>No conformes</small><strong>${badCount}</strong></div><div><small>Revisión metrológica</small><strong>${reviewCount}</strong></div><div><small>Base estadística</small><strong>${rows.length<10?'Insuficiente':'Exploratoria'}</strong></div></div><p class="cc-unified-diagnosis">${!rows.length?'Sin registros del mes.':badCount?'⚠ Existen mediciones no conformes; requieren revisión de Calidad.':reviewCount?'⚠ Hay mediciones con corrección estimada pendientes de revisión metrológica.':rows.length<10?'✓ Mediciones técnicamente conformes. Historial insuficiente para conclusiones estadísticas.':'✓ Mediciones técnicamente conformes; revisar tendencias antes de concluir estabilidad.'}</p><div class="cc100-charts"><article class="cc100-card"><h3>Temperatura corregida (°C)</h3><p>Límites del último registro: ${esc(low)}–${esc(high)} °C. Los criterios históricos se conservan por registro.</p>${graph(rows,'tempCorrected','Temperatura',Number(low),Number(high))}</article>${tempOnly?'':`<article class="cc100-card"><h3>Humedad relativa corregida (%)</h3><p>Límite máximo del último registro: ${esc(rh)} %.</p>${graph(rows,'rhCorrected','Humedad relativa',Number(rhMin),Number(rh))}</article>`}</div><h3>Historial y trazabilidad · ${esc(m)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>Responsable</th><th>T leída</th><th>Factor T</th><th>T corregida</th>${tempOnly?'':'<th>HR leída</th><th>Factor HR</th><th>HR corregida</th>'}<th>Estado</th><th>Certificado</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.responsibleName||r.completedBy)}</td><td>${esc(r.tempRead)}</td><td>${esc(r.tempFactor)}</td><td>${esc(r.tempCorrected)}</td>${tempOnly?'':`<td>${esc(r.rhRead)}</td><td>${esc(r.rhFactor)}</td><td>${esc(r.rhCorrected)}</td>`}<td>${esc(r.status==='COMPLETADA'?'CONFORME':r.status==='REVISION_METROLOGICA'?'REVISIÓN METROLÓGICA':'NO CONFORME')}</td><td>${esc(r.certificate)}</td></tr>`).join('')||'<tr><td colspan="${tempOnly?7:10}">Sin registros para este mes.</td></tr>'}</tbody></table></div><p class="muted">Para registrar mediciones o consultar configuraciones metrológicas, utilice los botones de la carta en el listado superior. La carga histórica ambiental requiere un flujo de importación con trazabilidad y no se habilita hasta implementarlo.</p>`;
 }catch(e){if(ticket===seq)result.innerHTML=`<p class="form-error">No se pudo consultar Firebase: ${esc(e.message)}. Revise las reglas de lectura de environmentalRecords.</p>`}
 };
 const syncCards=async()=>{try{const snapshot=await getDocs(collection(db,'environmentalCards'));const selected=sel.value;for(const d of snapshot.docs){const data=d.data();const entry=available.find(c=>c.id===d.id);if(entry){entry.name=data.name||entry.name;}else available.push({id:d.id,name:data.name||d.id,kind:'ENV'});}sel.innerHTML=available.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');if(available.some(c=>c.id===selected))sel.value=selected;}catch(e){console.warn('No se pudo sincronizar el catálogo de cartas ambientales',e);}};
 sel.onchange=load;month.onchange=load;host.querySelector('#ccUnifiedReload').onclick=async()=>{await syncCards();await load()};
 const onChanged=async()=>{if(!host.isConnected)return;await syncCards();await load()};window.addEventListener('psi-environmental-changed',onChanged);
 syncCards().then(load);

}
