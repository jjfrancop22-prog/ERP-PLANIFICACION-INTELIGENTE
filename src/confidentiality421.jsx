import React,{useCallback,useEffect,useState} from 'react';
import {auth,db} from './firebase';
import {addDoc,collection,query,where,limit,getDocs,serverTimestamp} from 'firebase/firestore';

const checks=[
 ['agreement','Acuerdo contractual','MC0408 V12 y evidencia de aceptación, orden de trabajo o contrato.'],
 ['scope','Información protegida','Información proporcionada por el cliente y obtenida o generada por PSI.'],
 ['notice','Comunicación previa','Información que PSI pretenda hacer pública y evidencia de aviso previo al cliente, cuando aplique.'],
 ['exceptions','Excepciones y divulgación','Información pública por el cliente, acuerdo entre partes y obligaciones legales aplicables.']
];
const initial=()=>Object.fromEntries(checks.map(([id])=>[id,'PENDIENTE']));
const labels={PENDIENTE:'Pendiente',VERIFICADO:'Verificado',ATENCION:'Requiere atención',NO_APLICA:'No aplica (justificado)'};
const timestamp=r=>r.createdAt?.toMillis?.()||r.createdAt?.seconds*1000||0;
export default function Confidentiality421({documents=[],onLibrary}){
 const [values,setValues]=useState(initial),[evidence,setEvidence]=useState(''),[conclusion,setConclusion]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[history,setHistory]=useState([]),[historyOpen,setHistoryOpen]=useState(false),[latest,setLatest]=useState(null),[editing,setEditing]=useState(false);
 const linked=documents.filter(d=>(d.requirementIds||[]).includes('4.2.1'));
 const approved=linked.filter(d=>d.approvalStatus==='APPROVED');
 const savedChecks=latest?.checks||initial();
 const verified=Object.values(savedChecks).filter(x=>x==='VERIFICADO').length;
 const load=useCallback(async({showHistory=false}={})=>{
  setLoading(true);
  try{
   const s=await getDocs(query(collection(db,'sgcConfidentiality421'),where('requirementId','==','4.2.1'),limit(100)));
   const rows=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>timestamp(b)-timestamp(a));
   setLatest(rows[0]||null);setHistory(rows);
   if(showHistory)setHistoryOpen(true);
   setMessage('');
  }catch(e){setMessage('No fue posible recuperar las evaluaciones: '+e.message)}finally{setLoading(false)}
 },[]);
 useEffect(()=>{load()},[load]);
 const begin=()=>{setValues(latest?.checks?{...initial(),...latest.checks}:initial());setEvidence(latest?.evidence||'');setConclusion(latest?.conclusion||'');setEditing(true);setMessage('Nueva evaluación en preparación. La anterior permanece en el historial.');};
 const save=async()=>{
  if(!evidence.trim()||!conclusion.trim()){setMessage('Registre evidencia objetiva y conclusión antes de guardar.');return}
  if(Object.values(values).some(v=>v==='NO_APLICA')&&!/no aplica|no se (ha |han )?(previsto|realizado|presentado|requerido)|sin divulgaci[oó]n|no hubo/i.test(evidence+' '+conclusion)){setMessage('Justifique expresamente los criterios marcados «No aplica» en la evidencia o conclusión.');return}
  if(!auth.currentUser){setMessage('Inicie sesión para guardar la evaluación.');return}
  setBusy(true);setMessage('');
  try{
   await addDoc(collection(db,'sgcConfidentiality421'),{requirementId:'4.2.1',checks:{...values},evidence:evidence.trim().slice(0,2000),conclusion:conclusion.trim().slice(0,2000),createdBy:auth.currentUser.uid,createdAt:serverTimestamp()});
   setEditing(false);await load();setMessage('Evaluación guardada. Se conserva el historial y se muestra la última evaluación registrada.');
  }catch(e){setMessage('No se pudo guardar: '+e.message)}finally{setBusy(false)}
 };
 const shown=editing?values:savedChecks;
 return <div className="psi421">
  <div className="psi421Intro"><div><span className="psi41Label">CONTROL DOCUMENTAL · 4.2.1</span><h4>Responsabilidad y protección de la información</h4><p>MC-02 Ed. 25 (PDF vigente) y MC0408 V12 (PDF maestro de cotización). La oferta individual y su aceptación se gestionarán en Comercial; no se duplican en Biblioteca.</p></div><button className="outline" onClick={onLibrary}>▤ Biblioteca</button></div>
  <div className="psi421Metrics"><div><b>4</b><span>Criterios</span></div><div><b>{verified}/4</b><span>Verificados · última evaluación</span></div><div><b>{linked.length}</b><span>Documentos vinculados</span></div><div><b>{approved.length}</b><span>Aprobados en Biblioteca</span></div></div>
  <div className="psi421Card"><div className="psi41PanelHead"><h4>{editing?'Nueva evaluación':'Última evaluación registrada'}</h4><span className="psi41MiniTag">{loading?'Consultando…':editing?'Edición manual':latest?'Solo lectura':'Sin evaluaciones'}</span></div>
   <p className="psi41Small">{editing?'Registre los resultados y la evidencia real. «No aplica» requiere justificación.':'Los valores visibles corresponden a la última evaluación guardada, no a selecciones temporales.'}</p>
   {checks.map(([id,title,detail],i)=><div className="psi421Check" key={id}><div><small>0{i+1}</small><strong>{title}</strong><p>{detail}</p></div><select disabled={!editing||busy} aria-label={'Estado de '+title} value={shown[id]||'PENDIENTE'} onChange={e=>setValues(v=>({...v,[id]:e.target.value}))}><option value="PENDIENTE">Pendiente</option><option value="VERIFICADO">Verificado</option><option value="ATENCION">Requiere atención</option><option value="NO_APLICA">No aplica</option></select></div>)}
   <div className="psi421Fields"><label>Evidencia objetiva<textarea disabled={!editing||busy} maxLength={2000} rows={2} placeholder="Acuerdo aceptado, controles aplicados, comunicaciones y referencias documentales…" value={editing?evidence:latest?.evidence||''} onChange={e=>setEvidence(e.target.value)}/></label><label>Conclusión y seguimiento<textarea disabled={!editing||busy} maxLength={2000} rows={2} placeholder="Conclusión, justificación de no aplica, brechas y próximas acciones…" value={editing?conclusion:latest?.conclusion||''} onChange={e=>setConclusion(e.target.value)}/></label></div>
   <div className="psi421Actions">{editing?<><button disabled={busy} onClick={save}>{busy?'Guardando…':'Guardar nueva evaluación'}</button><button className="outline" disabled={busy} onClick={()=>{setEditing(false);setMessage('Edición cancelada; no se alteró el historial.')}}>Cancelar</button></>:<button disabled={loading||busy} onClick={begin}>+ Nueva evaluación</button>}<button className="outline" disabled={loading||busy} onClick={()=>setHistoryOpen(v=>!v)}>{historyOpen?'Ocultar historial':'Consultar historial'}</button></div>
   {message&&<p role="status" className="psi421Message">{message}</p>}
   {historyOpen&&<div className="psi421History"><h4>Historial de evaluaciones · solo lectura</h4>{history.length?history.map(h=><div key={h.id}><strong>{h.createdAt?.toDate?.().toLocaleString('es-EC')||'Fecha pendiente de sincronización'}</strong><span>{checks.map(([id,title])=>`${title}: ${labels[h.checks?.[id]]||'Pendiente'}`).join(' · ')}</span><p><b>Evidencia:</b> {h.evidence}</p><p><b>Conclusión:</b> {h.conclusion}</p><small>Usuario: {h.createdBy}</small></div>):<p className="psi41Small">No existen evaluaciones registradas.</p>}</div>}
  </div><p className="psi41Small">* Los resultados se basan en la última evaluación registrada. MC0408 V12 se incorpora como PDF maestro controlado; las cotizaciones individuales no se cargan como formatos maestros.</p>
 </div>;
}
