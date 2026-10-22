// Motor común de cribado exploratorio. Nunca declara control estadístico aprobado
// sin parámetros de referencia independientes y validados.
export function evaluateWestgard(points, baseline=null){
 const vals=points.map(p=>Number(p.v));const n=vals.length;
 const historicalMean=n?vals.reduce((a,b)=>a+b,0)/n:NaN;
 const historicalSd=n>1?Math.sqrt(vals.reduce((a,b)=>a+(b-historicalMean)**2,0)/(n-1)):NaN;
 const approved=baseline?.approved===true&&Number.isFinite(Number(baseline.mean))&&Number.isFinite(Number(baseline.sd))&&Number(baseline.sd)>0;
 const mean=approved?Number(baseline.mean):historicalMean,sd=approved?Number(baseline.sd):historicalSd;
 const hits=[];if(n<2||!Number.isFinite(sd)||sd<=0)return {hits,approved,mean,sd,n};
 const z=vals.map(v=>(v-mean)/sd);
 const add=(i,rule,severity)=>hits.push({date:points[i].date,value:vals[i],rule,severity,index:i});
 for(let i=0;i<n;i++){
  const v=z[i];if(Math.abs(v)>=3)add(i,'1₃s','reject');else if(Math.abs(v)>=2)add(i,'1₂s','warn');
  if(i>=1&&Math.abs(v)>=2&&Math.abs(z[i-1])>=2&&Math.sign(v)===Math.sign(z[i-1]))add(i,'2₂s','reject');
  if(i>=3&&(z.slice(i-3,i+1).every(t=>t>=1)||z.slice(i-3,i+1).every(t=>t<=-1)))add(i,'4₁s','reject');
  if(i>=9&&(z.slice(i-9,i+1).every(t=>t>0)||z.slice(i-9,i+1).every(t=>t<0)))add(i,'10x','reject');
  if(i>=6){const a=vals.slice(i-6,i+1);if(a.every((t,j)=>j===0||t>a[j-1])||a.every((t,j)=>j===0||t<a[j-1]))add(i,'7T','warn');}
 }
 // R4s necesita pares de controles de una misma corrida: no inferirlo de series aisladas.
 return {hits,approved,mean,sd,n};
}
