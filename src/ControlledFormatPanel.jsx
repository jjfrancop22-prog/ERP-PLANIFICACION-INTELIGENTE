import React from 'react';
/** Panel universal para formatos controlados. Reutilizar en nuevos módulos. */
export default function ControlledFormatPanel({code,version,title,description,status,onArchive,onPreview,onLibrary,busy=false,canArchive=true,previewLabel="Vista previa PDF"}){
 return <section className="controlledFormatPanel" aria-label={`Control documental ${code}`}>
  <div className="controlledFormatInfo"><span className="eyebrow">FORMATO CONTROLADO · {code} · V{version}</span><h3>{title}</h3><p>{description}</p>{status&&<small className="controlledFormatStatus">{status}</small>}</div>
  <div className="controlledFormatButtons">{canArchive&&<button type="button" disabled={busy} onClick={onArchive}>{busy?'Archivando…':'Generar y archivar plantilla'}</button>}<button type="button" className="outline" onClick={onPreview}>{previewLabel}</button><button type="button" className="outline" onClick={onLibrary}>▤ Biblioteca</button></div>
 </section>
}
