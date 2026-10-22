import {visualChart} from './visual-chart.js';
import {readMonthlyControlRecords,readManualControlHistory,readControlResponsibleNames,saveManualControlHistory,correctManualControlHistory} from './sync';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?n.toFixed(3):'—';
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const std=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)):NaN;
// Westgard screening with month-derived reference: provisional until an independent baseline is approved.
function rules(values,mu,sigma){
 const hits=[];
 if(values.length<2||!Number.isFinite(sigma)||sigma<=0)return hits;
 const z=values.map(v=>(v-mu)/sigma);
 const add=(rule,kind,i)=>hits.push({rule,kind,index:i});
 for(let i=0;i<z.length;i++){
  const v=z[i],prev=z[i-1];
  if(Math.abs(v)>=3)add('1₃s','reject',i);
  else if(Math.abs(v)>=2)add('1₂s','warn',i);
  if(i>=1&&Math.abs(v)>=2&&Math.abs(prev)>=2&&Math.sign(v)===Math.sign(prev))add('2₂s','reject',i);
  if(i>=3&&(z.slice(i-3,i+1).every(t=>t>=1)||z.slice(i-3,i+1).every(t=>t<=-1)))add('4₁s','reject',i);
  if(i>=9&&(z.slice(i-9,i+1).every(t=>t>0)||z.slice(i-9,i+1).every(t=>t<0)))add('10x','reject',i);
  if(i>=6&&(values.slice(i-6,i+1).every((t,j,a)=>j===0||t>a[j-1])||values.slice(i-6,i+1).every((t,j,a)=>j===0||t<a[j-1])))add('7T','warn',i);
 }
 return hits;
}
function plot(rows,idx,nominal,tol){
 const series=rows.filter(r=>Array.isArray(r.readings)).map(r=>({date:r.date,value:r.readings[idx],raw:r.rawReadings?.[idx]??r.readings[idx],correction:r.corrections?.[idx]}));
 return visualChart(series,{label:`Control pH ${nominal.toFixed(2)}`,low:nominal-tol,high:nominal+tol,unit:'pH',precision:3});
}

function render(root,card,month,rows,names){
 const tolerance=Number(card.tolerance)||.1;
 const valid=rows.filter(r=>r.kind==='MULTIPUNTO'&&Array.isArray(r.readings)&&r.readings.length===3);
 const good=rows.filter(r=>r.status==='COMPLETADA').length;
 const details=[4,7,10].map((n,i)=>{
  const series=valid.map(r=>({date:r.date,value:Number(r.readings[i])})).filter(x=>Number.isFinite(x.value));
  const values=series.map(x=>x.value),latest=values.at(-1),mu=values.length?mean(values):NaN,sigma=std(values);
  const hits=values.length>=10?rules(values,mu,sigma).map(h=>({...h,date:series[h.index].date,value:values[h.index]})):[];
  const compliant=Number.isFinite(latest)&&Math.abs(latest-n)<=tolerance+1e-9;
  return {n,i,values,latest,mu,sigma,hits,compliant};
 });
 const hits=details.flatMap(d=>d.hits.map(h=>({...h,level:d.n})));
 const rejects=hits.filter(h=>h.kind==='reject'),warns=hits.filter(h=>h.kind==='warn');
 const complete=details.filter(d=>d.compliant).length;
 const technicalBad=rows.some(r=>r.status==='NO_CONFORME');
 const status=technicalBad?'danger':rejects.length?'warn':warns.length?'warn':'info';
 const diagnosis=technicalBad?'No conformidad técnica':rejects.length?'Señales de rechazo para revisar':warns.length?'Advertencias para revisar':details.some(d=>d.values.length<10)?'Datos insuficientes':'Sin señales detectadas';
 root.innerHTML=`<div class="cc107-status cc107-${status}" role="status"><b>Westgard · ${esc(diagnosis)}</b> · Evaluación provisional con media y s del período; requiere límites de referencia independientes para decisiones definitivas.</div>
 <div class="cc100-kpis cc107-kpis"><div><small>Controles del mes</small><strong>${rows.length}</strong></div><div><small>Cumplimiento técnico</small><strong>${rows.length?(100*good/rows.length).toFixed(1)+'%':'—'}</strong></div><div><small>Últimos niveles conformes</small><strong>${valid.length?complete+'/3':'—'}</strong></div><div><small>Alertas Westgard</small><strong>${rejects.length} rechazo · ${warns.length} aviso</strong></div><div><small>Equipo</small><strong class="cc107-equipment">${esc(card.equipment)}</strong></div></div>
 <div class="cc100-charts">${details.map(d=>{const reject=d.hits.some(h=>h.kind==='reject'),warn=d.hits.some(h=>h.kind==='warn');const label=!d.compliant&&d.values.length?'🔴 NO CONFORME':reject?'🟠 REVISAR':warn?'🟡 ADVERTENCIA':d.values.length<10?'🔵 SIN BASE':'🟢 SIN SEÑALES*';return `<article class="cc100-card cc107-plot"><div class="cc107-cardhead"><h3>Control pH ${d.n.toFixed(2)}</h3><span class="cc100-badge ${!d.compliant&&d.values.length?'cc107-red':reject||warn?'cc107-yellow':''}">${label}</span></div><div class="cc107-levels"><span>Nominal <b>${d.n.toFixed(2)}</b></span><span>Última lectura <b>${Number.isFinite(d.latest)?fmt(d.latest):'—'}</b></span><span>Media <b>${fmt(d.mu)}</b></span><span>s <b>${fmt(d.sigma)}</b></span><span>Tolerancia <b>±${tolerance.toFixed(2)}</b></span></div>${plot(valid,d.i,d.n,tolerance)}${d.hits.length?`<p class="cc107-warning">${d.hits.length} señal(es): ${[...new Set(d.hits.map(h=>h.rule))].join(', ')}. Ver fechas abajo.</p>`:''}</article>`}).join('')}</div>
 <div class="cc100-charts cc107-bottom"><article class="cc100-card"><h3>Diagnóstico Westgard · ${esc(month)}</h3><p><b>${esc(diagnosis)}</b> · ${hits.length} activación(es) en todo el período.</p>${hits.length?`<div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>Nivel</th><th>Lectura</th><th>Regla</th><th>Tipo</th></tr></thead><tbody>${hits.map(h=>`<tr><td>${esc(h.date)}</td><td>pH ${h.level}</td><td>${fmt(h.value)}</td><td>${esc(h.rule)}</td><td>${h.kind==='reject'?'Revisión de rechazo':'Advertencia'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Sin activaciones en los puntos evaluados.</p>'}<p class="cc100-sub">* Evaluación provisional: media y s calculadas con los datos del mes, no con una referencia histórica aprobada. Los límites ±${tolerance} pH son técnicos. R₄s no se calcula sin identificar niveles de una misma corrida y establecer su diseño. La ausencia de señales no demuestra control estadístico.</p></article><article class="cc100-card"><h3>Historial y trazabilidad · ${esc(month)}</h3><div class="cc100-tablewrap"><table><thead><tr><th>Fecha</th><th>pH 4</th><th>pH 7</th><th>pH 10</th><th>Resultado</th><th>Responsable</th><th>Origen</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td>${[0,1,2].map(i=>`<td>${Array.isArray(r.readings)?fmt(Number(r.readings[i])):'—'}</td>`).join('')}<td>${esc(r.status)}</td><td>${esc(r.responsibleName||names.get(r.completedBy)||'No identificado')}</td><td>${r.origin==='HISTORICO_MANUAL'?'Histórico manual':'Registro diario'}</td></tr>`).join('')||'<tr><td colspan="7">Sin registros para el mes seleccionado.</td></tr>'}</tbody></table></div></article></div>`;
}

export function mountControlAnalytics(host,cards,profile,options={}){
 if(!host||profile?.role!=='JEFE')return;
 const multi=cards.filter(c=>c.status==='ACTIVO'&&c.kind==='MULTIPUNTO');
 if(!multi.length)return;
 const month=new Date().toISOString().slice(0,7);
 host.innerHTML=`<section class="panel cc100-section"><div class="panel-heading"><div><span class="eyebrow">CALIDAD · ANÁLISIS ESTADÍSTICO</span><h2>Gestión inteligente de cartas de control</h2><p class="muted">Historial mensual, tres gráficos independientes y reglas estadísticas explicables.</p></div></div><div class="cc100-filters"><label>Carta<select id="cc100Card">${multi.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label>Mes<input type="month" id="cc100Month" value="${month}"></label><button class="outline" id="cc100Reload" type="button">Actualizar</button><button class="primary" id="cc110History" type="button">＋ Cargar hojas físicas</button></div><div id="cc100Results" aria-live="polite">Seleccione una carta para consultar sus registros.</div></section>`;
 const load=async()=>{const id=host.querySelector('#cc100Card')?.value,m=host.querySelector('#cc100Month')?.value,card=multi.find(c=>c.id===id),out=host.querySelector('#cc100Results');if(!card||!out)return;out.innerHTML='<p class="muted">Consultando registros confirmados en Firebase…</p>';try{const [daily,manual,users]=await Promise.all([readMonthlyControlRecords(id,m),readManualControlHistory(id,m),readControlResponsibleNames()]);const names=new Map(users.map(u=>[u.uid,u.name||u.displayName||u.fullName||u.email||'No identificado']));const rows=[...daily,...manual].sort((a,b)=>a.date.localeCompare(b.date));if(out.isConnected)render(out,card,m,rows,names)}catch(e){if(out.isConnected)out.innerHTML=`<p class="form-error">No fue posible consultar el historial: ${esc(e.message)}. Verifique conexión, permisos e índices de Firestore.</p>`}};
 host.querySelector('#cc110History').onclick=()=>openManualHistory(host,multi,load);host.querySelector('#cc100Card').onchange=load;host.querySelector('#cc100Month').onchange=load;host.querySelector('#cc100Reload').onclick=load;if(!options.deferInitialLoad)load();
}

async function openManualHistory(host,cards,reload){
 const card=cards.find(c=>c.id===host.querySelector('#cc100Card').value),month=host.querySelector('#cc100Month').value;
 if(!card)return;
 const overlay=document.createElement('div');
 overlay.className='cc110-overlay';
 overlay.innerHTML='<section class="cc110-modal" role="status" style="padding:24px">Consultando analistas autorizados…</section>';
 document.body.append(overlay);
 let users;try{users=await readControlResponsibleNames()}catch(e){overlay.innerHTML='<section class="cc110-modal" style="padding:24px"><p>No se pudo consultar la lista de analistas: '+esc(e.message)+'</p><button class="outline" type="button">Cerrar</button></section>';overlay.querySelector('button').onclick=()=>overlay.remove();return;}
overlay.className='cc110-overlay';
 const [year,mo]=month.split('-').map(Number),days=new Date(year,mo,0).getDate();
 const opts=users.filter(u=>u.status==='ACTIVO'&&u.role==='ANALISTA').map(u=>`<option value="${esc(u.uid)}">${esc(u.name||u.displayName||u.fullName||u.email||u.uid)}</option>`).join('');
 overlay.innerHTML=`<section class="cc110-modal" role="dialog" aria-modal="true"><header class="cc110-head"><div><small>LAB-PSI · CALIDAD Y TRAZABILIDAD</small><h2>Carga histórica de controles</h2><p>${esc(card.name)} · ${esc(card.code)} · ${esc(card.equipment)}</p><p>Mes ${esc(month)} · Registre únicamente mediciones documentadas en hojas físicas.</p></div><button class="outline" id="cc110Close" type="button">✕ Cerrar</button></header><div class="cc110-tools"><label>Mes <input type="month" id="cc110Month" value="${esc(month)}"></label><label><input type="checkbox" id="cc110Weekend"> Incluir fines de semana</label><label>Referencia de hoja física <input id="cc110Source" placeholder="Ej. CC-pH carpeta julio 2026" maxlength="200"></label></div><p id="cc110Message" role="status"></p><div class="cc110-batch-actions"><button type="button" class="primary" id="cc110Submit">✓ Finalizar y sincronizar histórico</button><span id="cc110Count">Complete las filas necesarias; las filas vacías no se enviarán.</span></div><div class="cc110-scroll"><table class="cc110-table"><thead><tr><th>Fecha</th><th>Responsable</th><th>pH 4</th><th>pH 7</th><th>pH 10</th><th>Observación</th><th>Estado</th></tr></thead><tbody>${Array.from({length:days},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),weekend=[0,6].includes(new Date(year,mo-1,i+1).getDay());return `<tr data-date="${date}" data-weekend="${weekend}"><td>${date}</td><td><select class="cc110-user"><option value="">Seleccione…</option>${opts}</select></td>${[4,7,10].map(n=>`<td><input class="cc110-value" type="number" step="0.001" min="0" max="14" placeholder="${n.toFixed(2)}"></td>`).join('')}<td><input class="cc110-notes" maxlength="1000" placeholder="Opcional"></td><td class="cc110-rowstatus">Pendiente</td></tr>`}).join('')}</tbody></table></div><footer>El responsable es quien realizó el control; Firebase identifica por separado a quien digitaliza. Los originales se conservan. Toda corrección genera una revisión con usuario, fecha del servidor, motivo y valores anteriores; no modifica el cumplimiento diario.</footer></section>`;
 const toggle=()=>overlay.querySelectorAll('tr[data-weekend="true"]').forEach(tr=>tr.hidden=!overlay.querySelector('#cc110Weekend').checked);toggle();
 overlay.querySelector('#cc110Weekend').onchange=toggle;
 overlay.querySelector('#cc110Close').onclick=()=>overlay.remove();
 overlay.querySelector('#cc110Month').onchange=e=>{host.querySelector('#cc100Month').value=e.target.value;overlay.remove();openManualHistory(host,cards,reload)};
 const existing=await Promise.all([readMonthlyControlRecords(card.id,month),readManualControlHistory(card.id,month)]);
 const existingByDate=new Map(existing.flat().map(r=>[r.date,r]));
 overlay.querySelectorAll('tr[data-date]').forEach(row=>{if(existingByDate.has(row.dataset.date)){const record=existingByDate.get(row.dataset.date);row.dataset.existing='true';row.dataset.manual=record.origin==='HISTORICO_MANUAL'?'true':'false';row.querySelector('.cc110-rowstatus').innerHTML=row.dataset.manual==='true'?'✓ Registrado <button type="button" class="outline cc110-edit" style="padding:4px 9px">Editar</button>':'✓ Registro diario (bloqueado)';row.querySelectorAll('input,select').forEach(el=>el.disabled=true);if(row.dataset.manual==='true'){row.querySelector('.cc110-user').value=record.responsibleUid||'';row.querySelectorAll('.cc110-value').forEach((el,i)=>el.value=record.readings?.[i]??'');row.querySelector('.cc110-notes').value=record.observations||'';row.querySelector('.cc110-edit').onclick=()=>{if(row.dataset.editing==='true')return;row.dataset.editing='true';row.querySelectorAll('input,select').forEach(el=>el.disabled=false);const cell=row.querySelector('.cc110-rowstatus');cell.innerHTML='<input class="cc110-reason" placeholder="Motivo obligatorio (10 caracteres)" maxlength="500" style="min-width:190px"><button type="button" class="primary cc110-save-edit">Guardar corrección</button><button type="button" class="outline cc110-cancel-edit">Cancelar</button>';cell.querySelector('.cc110-cancel-edit').onclick=()=>{row.dataset.editing='false';row.querySelectorAll('input,select').forEach(el=>el.disabled=true);row.querySelector('.cc110-user').value=record.responsibleUid||'';row.querySelectorAll('.cc110-value').forEach((el,i)=>el.value=record.readings?.[i]??'');row.querySelector('.cc110-notes').value=record.observations||'';cell.textContent='Recargue para volver a editar';};cell.querySelector('.cc110-save-edit').onclick=async()=>{const reason=cell.querySelector('.cc110-reason').value.trim(),responsibleUid=row.querySelector('.cc110-user').value,user=users.find(u=>u.uid===responsibleUid),values=[...row.querySelectorAll('.cc110-value')].map(el=>el.value.trim()===''?NaN:Number(el.value)),source=overlay.querySelector('#cc110Source').value.trim()||record.source;if(!user){overlay.querySelector('#cc110Message').textContent='Seleccione responsable.';return;}if(!confirm('Se conservará el original y se registrará una nueva revisión auditada. ¿Confirmar?'))return;const button=cell.querySelector('.cc110-save-edit');button.disabled=true;try{await correctManualControlHistory(card,row.dataset.date,values,{uid:responsibleUid,name:user.name||user.displayName||user.fullName||user.email},source,row.querySelector('.cc110-notes').value,reason);cell.textContent='✓ Corrección registrada con auditoría';row.dataset.editing='false';row.querySelectorAll('input,select').forEach(el=>el.disabled=true);await reload();}catch(e){button.disabled=false;overlay.querySelector('#cc110Message').textContent='Error: '+e.message;}};};}}});
 const submit=overlay.querySelector('#cc110Submit');
 submit.onclick=async()=>{
  const msg=overlay.querySelector('#cc110Message'),source=overlay.querySelector('#cc110Source').value.trim();
  const selected=[...overlay.querySelectorAll('tr[data-date]')].filter(row=>!row.hidden&&!row.dataset.existing&&!row.dataset.saved).map(row=>{
   const uid=row.querySelector('.cc110-user').value;
   const inputs=[...row.querySelectorAll('.cc110-value')];
   const raw=inputs.map(el=>el.value.trim());
   return {row,uid,raw,values:raw.map(v=>v===''?NaN:Number(v)),notes:row.querySelector('.cc110-notes').value};
  }).filter(item=>item.uid||item.raw.some(Boolean)||item.notes.trim());
  if(!selected.length){msg.textContent='No hay filas nuevas completas para sincronizar.';return;}
  if(source.length<3){msg.textContent='⚠ Identifique la hoja física de origen (mínimo 3 caracteres).';return;}
  const invalid=selected.find(item=>!item.uid||item.values.some(v=>!Number.isFinite(v)||v<0||v>14));
  if(invalid){msg.textContent='⚠ Complete analista y tres lecturas válidas para '+invalid.row.dataset.date+'. No se ha enviado nada.';return;}
  if(!confirm(`Se enviarán ${selected.length} registros históricos a Firebase. Los registros confirmados son inmutables. ¿Continuar?`))return;
  submit.disabled=true;overlay.querySelector('#cc110Close').disabled=true;
  let done=0,errors=0;
  for(const item of selected){
   const user=users.find(u=>u.uid===item.uid),name=user?.name||user?.displayName||user?.fullName||user?.email;
   const status=item.row.querySelector('.cc110-rowstatus');status.textContent='Sincronizando…';
   try{await saveManualControlHistory(card,item.row.dataset.date,item.values,{uid:item.uid,name},source,item.notes);item.row.dataset.saved='true';item.row.querySelectorAll('input,select').forEach(el=>el.disabled=true);status.textContent='✓ Confirmado';done++;}
   catch(e){errors++;status.textContent='⚠ '+e.message;}
   msg.textContent=`Firebase: ${done} confirmados, ${errors} con error, ${selected.length-done-errors} pendientes.`;
  }
  submit.disabled=false;overlay.querySelector('#cc110Close').disabled=false;
  msg.textContent+=errors?' Revise las filas marcadas y reintente únicamente las fallidas.':' Histórico sincronizado correctamente.';
  await reload();
 };
}
