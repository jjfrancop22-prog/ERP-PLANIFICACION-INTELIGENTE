// Cálculos deterministas: no se redondean datos intermedios.
const number = v => v === '' || v == null ? NaN : Number(v);
const stats = values => {const n=values.length,mean=values.reduce((a,b)=>a+b,0)/n;return {n,mean,sd:n>1?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null};};
export function calculateAnalytical(data,config={}){
 const mode=data.mode,decimals=Math.max(0,Math.min(8,Number(config.analyticalDecimals??3)));
 const fmt=v=>v==null?'—':Number(v).toFixed(decimals);
 if(mode==='NONE')return {mode,message:'Sin cálculo configurado.'};
 const rows=(data.rows||[]).map(row=>({nominal:number(row.nominal),readings:(row.readings||[]).filter(v=>String(v).trim()!=='').map(number)}));
 if(rows.some(r=>r.readings.some(v=>!Number.isFinite(v))))throw Error('Existen lecturas no numéricas.');
 if(!rows.some(r=>r.readings.length))return {mode,status:'PENDIENTE',message:'Ingrese lecturas para calcular.'};
 if(mode==='DIRECT'){
  const values=rows.flatMap(r=>r.readings),result=stats(values);
  return {mode,status:'CALCULADO',...result,message:`n=${result.n} · Promedio ${fmt(result.mean)} ${config.analyticalUnit||''} · Desviación estándar muestral ${fmt(result.sd)}`};
 }
 if(mode!=='CURVE')throw Error('Modalidad no reconocida.');
 const points=rows.filter(r=>r.readings.length);
 if(points.some(p=>!Number.isFinite(p.nominal)))throw Error('Los puntos requieren concentración nominal válida.');
 if(new Set(points.map(p=>p.nominal)).size<2)return {mode,status:'PENDIENTE',message:'Se requieren al menos dos concentraciones nominales distintas con lecturas.'};
 const pairs=points.flatMap(p=>p.readings.map(y=>({x:p.nominal,y})));
 const mx=stats(pairs.map(p=>p.x)).mean,my=stats(pairs.map(p=>p.y)).mean;
 const xx=pairs.reduce((s,p)=>s+(p.x-mx)**2,0),xy=pairs.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
 if(xx<=0)throw Error('La curva requiere al menos dos concentraciones diferentes.');
 const slope=xy/xx,intercept=my-slope*mx;
 const ssTot=pairs.reduce((s,p)=>s+(p.y-my)**2,0),ssRes=pairs.reduce((s,p)=>s+(p.y-(slope*p.x+intercept))**2,0);
 const r2=ssTot>0?1-ssRes/ssTot:null;
 const min=config.analyticalMinR2==null||config.analyticalMinR2===''?null:Number(config.analyticalMinR2);
 const status=min!==null&&r2!==null&&r2<min?'REVISAR':'CALCULADO';
 return {mode,status,n:pairs.length,slope,intercept,r2,points:points.map(p=>({nominal:p.nominal,...stats(p.readings)})),message:`${status==='REVISAR'?'⚠ R² inferior al mínimo · ':''}y = ${fmt(slope)}x + ${fmt(intercept)} · R² = ${r2==null?'No definido':r2.toFixed(6)} · ${pairs.length} lecturas. Para muestras: concentración = (respuesta − intercepto) / pendiente.`};
}
export function analyticalInputHTML(mode,config={},saved={}){
 if(mode==='NONE')return '<p>Este método no tiene cálculo analítico configurado. El JEFE puede habilitarlo en Catálogo Maestro.</p>';
 const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const points=mode==='CURVE'?(config.curveStandards||[]):[{nominal:'',replicas:Math.max(1,saved.rows?.[0]?.readings?.length||3)}];
 if(mode==='CURVE'&&!points.length)return '<p>Configure los puntos nominales en el Catálogo Maestro antes de registrar lecturas.</p>';
 return points.map((p,i)=>{const previous=saved.rows?.[i],n=Math.max(1,Math.min(30,Number(p.replicas)||3));return `<div data-analytical-row class="analytical-row"><strong>${mode==='CURVE'?`Punto ${i+1} · ${escape(p.nominal)} ${escape(config.curveUnit||'')}`:'Lecturas de muestra'}</strong><input type="hidden" data-nominal value="${escape(p.nominal)}"><div class="analytical-readings">${Array.from({length:n},(_,j)=>`<label>Réplica ${j+1}<input type="number" step="any" data-reading value="${escape(previous?.readings?.[j]||'')}" placeholder="Lectura real"></label>`).join('')}</div></div>`}).join('');
}
