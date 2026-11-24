import React,{useState} from 'react';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isPolicy = doc => {
 const text=normalize([doc.code,doc.title,doc.description].join(' '));
 return /politic|objetiv|capitulo 0|capitulo cero|sistema de gestion/.test(text);
};
const hasFile = doc => Boolean(doc && (doc.fileStored===true || doc.activePdfId || doc.pdfSignedStatus==='SIGNED'));
const isApproved = doc => Boolean(doc?.approvalStatus==='APPROVED' && String(doc.approvalVersion||doc.version)===String(doc.version));
const evidence = [
 {title:'Compromiso explícito de la Alta Dirección',page:1,detail:'La política declara la protección de la imparcialidad, independencia y confidencialidad.'},
 {title:'Objetivo de imparcialidad y confidencialidad',page:2,detail:'Meta documental: 100 % de cumplimiento de las políticas aplicables.'},
 {title:'Prevención de presiones y conflictos',page:3,detail:'La política aborda presiones comerciales, financieras, políticas y personales.'},
 {title:'Seguimiento y revisión por la Dirección',page:3,detail:'Análisis semestral de riesgos y revisión anual de la eficacia de la política.'}
];
export default function Impartiality412({documents=[],onLibrary,onOpenDocument}) {
 const [showEvidence,setShowEvidence]=useState(false);
 const linkedDocs=documents.filter(d=>(d.requirementIds||[]).includes('4.1.2'));
 const candidates=linkedDocs.filter(isPolicy);
 const fallback=documents.filter(isPolicy);
 const rank=d=>(hasFile(d)?4:0)+(isApproved(d)?2:0)+((d.requirementIds||[]).includes('4.1.2')?8:0);
 const document=[...candidates,...fallback].sort((a,b)=>rank(b)-rank(a))[0];
 const hasPdf=hasFile(document);
 const approved=isApproved(document);
 const linked=Boolean(document?.requirementIds?.includes('4.1.2'));
 const otherLinked=linkedDocs.filter(d=>d.id!==document?.id);
 return <div className="psi412">
  <div className="psi412Hero"><div><span className="psi41Label">EVIDENCIA INSTITUCIONAL · 4.1.2</span><h4>Compromiso de la Alta Dirección</h4><p>Documentos controlados y vinculados directamente desde Biblioteca.</p></div><button onClick={onLibrary}>▤ Abrir Biblioteca</button></div>
  <div className="psi412Metrics"><div><b>{document?'01':'00'}</b><span>Documento identificado</span></div><div><b>{document?(hasPdf?'Sí':'No'):'—'}</b><span>PDF archivado</span></div><div><b>{document?(approved?'Aprobado':document.approvalStatus==='IN_REVIEW'?'En revisión':'Por verificar'):'—'}</b><span>Control documental 8.3</span></div><div><b>{linked?'Vinculado':'Por vincular'}</b><span>Relación con 4.1.2</span></div></div>
  <section className="psi412Card"><div className="psi412CardTop"><div><small>DOCUMENTO INSTITUCIONAL · BIBLIOTECA</small><h4>{document?`${document.code} · ${document.title}`:'Política y Objetivos de Calidad · Edición 26'}</h4><p>{document?`Edición ${document.version||'—'} · ${document.type||'Documento'} · ${document.responsible||'Responsable no registrado'}`:'Registre o vincule el documento desde Biblioteca para consultar su estado.'}</p></div><span className={'psi412Pill '+(approved?'ok':'wait')}>{!document?'Sin documento identificado':approved?'✓ Aprobado en 8.3':hasPdf?'PDF disponible · aprobación por verificar':'PDF no confirmado'}</span></div>
   <div className="psi412Actions">{document&&<button onClick={()=>onOpenDocument?.(document)}>Consultar expediente y PDF</button>}<button className="outline" onClick={onLibrary}>{document?'Gestionar vínculos en Biblioteca':'Registrar documento en Biblioteca'}</button></div>
   {!linked&&<p className="psi412Hint">Vincule expresamente este documento al subnumeral 4.1.2. La vinculación no supone aprobación ni conformidad automática.</p>}
   {otherLinked.length>0&&<details className="psi412Other"><summary>Otros documentos vinculados a 4.1.2 · {otherLinked.length}</summary>{otherLinked.map(d=><div key={d.id} className="psi412OtherRow"><span>{d.code} · {d.title}</span><button className="outline" onClick={()=>onOpenDocument?.(d)}>Consultar</button></div>)}</details>}
  </section>
  <section className="psi412Card psi412Collapsible"><button type="button" className="psi412Disclosure" aria-expanded={showEvidence} onClick={()=>setShowEvidence(v=>!v)}><span><b>Matriz de evidencias del Capítulo 0</b><small>4 referencias documentales · 1 PDF · Consulta bajo demanda</small></span><strong>{showEvidence?'Ocultar ▲':'Ver evidencias ▼'}</strong></button>
   {showEvidence&&<><p className="psi412Hint">Referencias orientativas del documento facilitado. Compruebe las páginas de la edición archivada.</p><div className="psi412Evidence">{evidence.map((item,i)=><div key={i}><span className="psi412Page">Pág. {item.page}</span><div><b>{item.title}</b><p>{item.detail}</p></div>{document&&hasPdf&&<button className="outline" onClick={()=>onOpenDocument?.(document)}>Ver PDF ↗</button>}</div>)}</div></>}
  </section>
  <details className="psi412Foot psi412Other"><summary>Vinculaciones transversales y criterio de evaluación</summary><p>MC0201 y PSI-MC0201 identifican el mismo formato controlado (V06); sus declaraciones firmadas son registros individuales. El seguimiento de riesgos corresponde también a 4.1.4–4.1.5 y la revisión de la Dirección a 8.9.</p><p><b>Evaluación:</b> la política aprobada respalda el compromiso documentado, pero la conformidad requiere verificar su aplicación.</p></details>
 </div>;
}
