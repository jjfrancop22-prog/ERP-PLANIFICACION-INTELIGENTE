import React from 'react';
import './resources61.css';

const RESOURCE_ROWS = [
  {name:'Personal', target:'6.2', detail:'Competencia, autorizaciones y disponibilidad', source:'Capítulo 15 · Personal · Ed. 29'},
  {name:'Instalaciones', target:'6.3', detail:'Áreas y condiciones ambientales', source:'Capítulo 16 · Instalaciones · Ed. 9'},
  {name:'Equipamiento', target:'6.4', detail:'Equipos, mantenimiento y calibraciones', source:'Documento rector pendiente de vincular'},
  {name:'Sistemas', target:'7.11', detail:'Control de datos e información del laboratorio', source:'Documentación del sistema pendiente de vincular'},
  {name:'Servicios de apoyo', target:'6.6', detail:'Productos y servicios suministrados externamente', source:'Documento rector pendiente de vincular'},
];

export default function Resources61({linked=[],onLibrary,onOpenDocument,onNavigate}) {
 const relevant = linked.filter(d=> (d.requirementIds||[]).includes('6.1'));
 return <section className="psi61" aria-label="6.1 Generalidades">
  <div className="psi61Head"><div><span className="psi61Eyebrow">ISO/IEC 17025:2017 · 6.1</span><h3>Generalidades · Recursos del laboratorio</h3><p>Acceso a las fuentes controladas. Los registros se mantienen en sus módulos de origen.</p></div><span className="psi61Tag">Consulta documental</span></div>
  <div className="psi61Refs"><strong>Documentos rectores</strong><span>MC-01 · Estructura organizacional</span><span>Cap. 15 · Personal · Ed. 29</span><span>Cap. 16 · Instalaciones · Ed. 9</span><button className="outline" type="button" onClick={onLibrary}>Biblioteca ↗</button></div>
  <div className="psi61Table"><div className="psi61TableTitle"><strong>Recursos necesarios para las actividades</strong><small>5 componentes · acceso bajo demanda</small></div>{RESOURCE_ROWS.map(r=><div className="psi61Row" key={r.name}><div><strong>{r.name}</strong><small>{r.detail}</small></div><span className="psi61Source">{r.source}</span><button type="button" className="outline" onClick={()=>onNavigate(r.target)}>Consultar {r.target} ↗</button></div>)}</div>
  <details className="psi61Fold"><summary><strong>Evidencias específicas vinculadas a 6.1</strong><span>{relevant.length} documento(s) · Ver ▾</span></summary>{relevant.length?relevant.map(d=><div className="psi61Doc" key={d.id}><div><strong>{d.code} · {d.title}</strong><small>Ed. {d.version||'—'} · {d.approvalStatus==='APPROVED'?'Aprobación registrada':'Aprobación no verificada'}</small></div><button className="outline" type="button" onClick={()=>onOpenDocument(d)}>Consultar</button></div>):<p className="psi61Empty">No hay documentos vinculados específicamente al 6.1. Vincúlelos desde la Biblioteca, sin crear copias.</p>}</details>
  <details className="psi61Fold"><summary><strong>Criterio de aplicación</strong><span>Ver alcance ▾</span></summary><p>El laboratorio debe disponer del personal, las instalaciones, el equipamiento, los sistemas y los servicios de apoyo necesarios para gestionar y realizar sus actividades. La presencia de una referencia documental no constituye por sí sola evidencia de disponibilidad ni conformidad.</p><p>Los capítulos 15 y 16 son referencias de trabajo; sus futuras ediciones se gestionarán en Biblioteca con control de versión, sin alterar los registros de origen.</p></details>
 </section>
}
