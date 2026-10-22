import {visualChart} from './visual-chart.js';
import {loadGenericHistory} from './generic-history.js';
import {readMonthlyControlRecords,readControlResponsibleNames} from './sync';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nom=[84,1413,12.88],units=['µS/cm','µS/cm','mS/cm'];
function graph(rows,i){
 const points=rows.filter(r=>Array.isArray(r.readings)&&r.readings[i]!=null&&r.readings[i]!==''&&Number.isFinite(Number(r.readings[i]))).map(r=>({date:r.date,value:r.corrected?.[i]!=null&&Number.isFinite(Number(r.corrected[i]))?Number(r.corrected[i]):Number(r.readings[i]),raw:r.readings[i],correction:r.corrections?.[i]}));
 return visualChart(points,{key:'value',label:`Control ${nom[i]} ${units[i]}`,low:nom[i]*.95,high:nom[i]*1.05,unit:units[i]});
}

// Los registros físicos y digitales se consolidan por fecha y nivel, sin escribir en Firebase.
// Si ambos orígenes registran una misma fecha, el registro digital prevalece y se
// informa el solapamiento para revisión, en lugar de duplicar puntos.
function consolidate(daily,archive){
 const dates=new Map();let overlaps=0;
 for(const r of archive){if(r.date)dates.set(r.date,{...r,origin:'HISTÓRICO FÍSICO'});}
 for(const r of daily){if(!r.date)continue;if(dates.has(r.date))overlaps++;dates.set(r.date,{...r,origin:'REGISTRO DIGITAL'});}
 return {rows:[...dates.values()].sort((a,b)=>a.date.localeCompare(b.date)),overlaps};
}
export function mountConductivityAnalytics(host,cards){
 const active=cards.filter(c=>c.kind==='CONDUCTIVIDAD'&&c.status==='ACTIVO');if(!host||!active.length)return;
 const section=document.createElement('section');section.className='panel';
 section.innerHTML=`<div class="panel-heading"><div><span class="eyebrow">PEC0404-05 · CALIDAD</span><h2>Conductividad EI-104 · Gestión estadística</h2><p>Histórico físico y digital consolidado · criterio técnico ±5 %.</p></div></div><label>Carta <select id="condCard">${active.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label> <label>Mes <input type="month" id="condMonth" value="${new Date().toISOString().slice(0,7)}"></label> <button type="button" class="outline" id="condReload">Actualizar</button><div id="condResults" aria-live="polite"></div>`;
 host.append(section);const out=section.querySelector('#condResults');let seq=0;
 const load=async()=>{const ticket=++seq,cardId=section.querySelector('#condCard').value,month=section.querySelector('#condMonth').value,card=active.find(c=>c.id===cardId);out.textContent='Consultando Firebase…';
 try{
  const [daily,archive,users]=await Promise.all([readMonthlyControlRecords(cardId,month),loadGenericHistory(card,month),readControlResponsibleNames()]);
  if(ticket!==seq||!out.isConnected)return;
  const {rows,overlaps}=consolidate(daily,archive);
  const names=new Map(users.map(u=>[u.uid,u.name||u.displayName||u.email||u.uid]));
  const good=rows.filter(r=>r.conforms===true||r.conforms==null&&r.status==='COMPLETADA').length;
  const bad=rows.filter(r=>r.conforms===false||r.status==='NO_CONFORME').length;
  out.innerHTML=`<h3>Controles consolidados: ${rows.length} · Conformes: ${good} · No conformes: ${bad}</h3><p class="muted">${daily.length} registros digitales · ${archive.length} registros físicos.${overlaps?` ⚠ ${overlaps} fecha(s) coincidentes: se representa el registro digital; revisar la trazabilidad.`:''} La vista mensual y su histórico usan los mismos datos y criterios.</p><div class="cc100-charts">${nom.map((n,i)=>`<article class="cc100-card"><h3>Control ${n} ${units[i]}</h3><p>Intervalo: ${(n*.95).toFixed(3)}–${(n*1.05).toFixed(3)} ${units[i]}</p>${graph(rows,i)}</article>`).join('')}</div><h3>Historial consolidado y trazabilidad · ${esc(month)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>84 µS/cm</th><th>1413 µS/cm</th><th>12.88 mS/cm</th><th>Resultado</th><th>Responsable</th><th>Origen</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td>${[0,1,2].map(i=>`<td>${esc(r.corrected?.[i]??r.readings?.[i])}</td>`).join('')}<td>${esc(r.status|| (r.conforms?'COMPLETADA':'NO_CONFORME'))}</td><td>${esc(r.responsibleName||names.get(r.completedBy)||r.completedBy)}</td><td>${esc(r.origin)}</td></tr>`).join('')||'<tr><td colspan="7">Sin registros en este mes.</td></tr>'}</tbody></table></div>`;
 }catch(e){if(ticket===seq)out.textContent='No se pudo consultar Firebase: '+e.message}
 };
 section.querySelector('#condCard').onchange=load;section.querySelector('#condMonth').onchange=load;section.querySelector('#condReload').onclick=load;load();
}
