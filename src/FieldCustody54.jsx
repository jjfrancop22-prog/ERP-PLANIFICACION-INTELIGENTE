import React,{useEffect,useState} from 'react';
import {collection,doc,getDoc,getDocs,query,orderBy,limit,startAfter,setDoc,updateDoc,serverTimestamp} from 'firebase/firestore';
import {db,auth} from './firebase';
import './fieldCustody54.css';

const ROOT='sgcFieldCustody54';
const CODE='PET0103';
const EDITION='07';
const DISPLAY_CODE='PET0103-07';
const normalize=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
// El catálogo guarda el código maestro PET0103 y la edición V07 por separado.
// Se acepta el identificador histórico PET0103-07 únicamente cuando la edición coincide.
const isMaster=d=>{
 const code=normalize(d?.code);
 const version=String(d?.version??'').replace(/[^0-9]/g,'').padStart(2,'0');
 return (code===normalize(CODE)||code===normalize(DISPLAY_CODE)) && version===EDITION;
};
const MAX=400*1024;
const CHUNK=11000;
const toB64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)};
const fromB64=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
const hex=buffer=>Array.from(new Uint8Array(buffer)).map(x=>x.toString(16).padStart(2,'0')).join('');
const dateText=v=>v?.toDate?.().toLocaleString('es-EC')||'Pendiente';

export default function FieldCustody54({documents=[],canEdit=false,onLibrary,onOpenDocument}){
 const master=documents.find(isMaster);
 const [opened,setOpened]=useState(false),[rows,setRows]=useState([]),[last,setLast]=useState(null),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [files,setFiles]=useState([]),[sampleDate,setSampleDate]=useState(''),[sampleCode,setSampleCode]=useState(''),[client,setClient]=useState(''),[confirmed,setConfirmed]=useState(false),[selected,setSelected]=useState(null),[pdfUrl,setPdfUrl]=useState('');
 const [allHashes,setAllHashes]=useState([]);
 const load=async(reset=true)=>{setLoading(true);setError('');try{const base=[collection(db,ROOT),orderBy('createdAt','desc'),limit(10)];if(!reset&&last)base.push(startAfter(last));const snap=await getDocs(query(...base));setRows(prev=>reset?snap.docs.map(d=>({id:d.id,...d.data()})):[...prev,...snap.docs.map(d=>({id:d.id,...d.data()}))]);setLast(snap.docs.at(-1)||null);setMore(snap.size===10)}catch(e){setError('No se pudo consultar el historial: '+e.message)}finally{setLoading(false)}};
 useEffect(()=>{if(opened)load(true)},[opened]);
 useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl)},[pdfUrl]);
 const close=()=>{setOpened(false);setFiles([]);setError('');setSuccess('');setSelected(null);setPdfUrl('')};
 const save=async()=>{if(!canEdit||!auth.currentUser)return setError('Solo Calidad o Administración puede archivar registros.');if(!files.length)return setError('Seleccione al menos un PDF.');if(!confirmed)return setError('Confirme que son registros completados del formato PET0103-07.');if(!sampleDate)return setError('Ingrese la fecha del muestreo.');setBusy(true);setError('');setSuccess('');let count=0;try{
  for(const file of files){if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw Error('Solo se admiten archivos PDF.');if(file.size>MAX||file.size<10)throw Error(`${file.name}: máximo 400 KB por PDF.`);const bytes=new Uint8Array(await file.arrayBuffer());if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error(`${file.name}: el archivo no parece ser PDF.`);const sha=hex(await crypto.subtle.digest('SHA-256',bytes));const dup=await getDoc(doc(db,ROOT,sha));if(dup.exists()){setSuccess(s=>s+`\n${file.name}: ya archivado, no se duplicó.`);continue}
   const encoded=toB64(bytes),chunks=Array.from({length:Math.ceil(encoded.length/CHUNK)},(_,i)=>encoded.slice(i*CHUNK,(i+1)*CHUNK));const ref=doc(db,ROOT,sha);
   await setDoc(ref,{masterCode:CODE,masterDisplayCode:DISPLAY_CODE,masterId:master?.id||'',masterVersion:master?.version||'',filename:file.name,size:file.size,sha256:sha,parts:chunks.length,status:'UPLOADING',sampleDate,client:client.trim().slice(0,120),sampleCode:sampleCode.trim().slice(0,100),createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});
   for(let i=0;i<chunks.length;i++)await setDoc(doc(ref,'chunks',String(i).padStart(3,'0')),{index:i,data:chunks[i]});
   await updateDoc(ref,{status:'READY',completedAt:serverTimestamp()});count++;
  }
  setSuccess(s=>`${count} registro(s) archivado(s)${master?.fileStored?'':' · pendiente de registrar el formato maestro en Biblioteca'}.${s}`);setFiles([]);setConfirmed(false);await load(true);
 }catch(e){setError('Carga interrumpida: '+e.message+' Si quedó un registro incompleto, consulte a Calidad antes de reintentar.')}finally{setBusy(false)}};
 const view=async(row)=>{setLoading(true);setError('');try{if(row.status!=='READY')throw Error('Registro incompleto: no se puede visualizar.');const parts=[];for(let i=0;i<row.parts;i++){const snap=await getDoc(doc(db,ROOT,row.id,'chunks',String(i).padStart(3,'0')));if(!snap.exists())throw Error('Falta un fragmento del archivo.');parts.push(snap.data().data)}const bytes=fromB64(parts.join(''));const hash=hex(await crypto.subtle.digest('SHA-256',bytes));if(hash!==row.sha256)throw Error('La huella del archivo no coincide.');if(pdfUrl)URL.revokeObjectURL(pdfUrl);setPdfUrl(URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})));setSelected(row)}catch(e){setError('No se pudo abrir: '+e.message)}finally{setLoading(false)}};
 const codeWarning=files.some(f=>{const n=normalize(f.name);return /PET0\d{3}/.test(n)&&!n.includes(normalize(CODE))});
 return <>
  <article className="psi54CustodyCard"><strong>{CODE} · V{EDITION} · Muestreo y cadena de custodia</strong><small>Formato maestro controlado · registros de campo completados</small><div className="psi5LegalButtons">{master?.fileStored?<><span className="psi5Pill">En Biblioteca · V{EDITION}</span><button className="outline" type="button" onClick={()=>onOpenDocument?.(master)}>Ver formato</button></>:<span className="psi5Pill pending">{master?'Ficha sin PDF':'Formato pendiente en Biblioteca'}</span>}<button className="outline" type="button" onClick={onLibrary}>{master?'Biblioteca ↗':'Registrar formato ↗'}</button><button type="button" className="outline" onClick={()=>setOpened(true)}>Evidencias / historial</button></div><span className="psi54Muted">Las cadenas completadas se archivan como registros, no como ediciones del formato maestro.</span></article>
  {opened&&<div className="psi54CustodyOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="psi54CustodyModal" role="dialog" aria-modal="true" aria-label="Registros de cadena de custodia"><header><div><span className="psi41Label">5.4 · EVIDENCIAS DE CAMPO</span><h3>{CODE} · Cadena de custodia</h3><p>Un formato maestro en Biblioteca; múltiples registros reales con historial inmutable.</p></div><button type="button" className="outline" onClick={close}>Cerrar ✕</button></header>
   <div className="psi54CustodyStatus"><strong>Formato maestro</strong><span>{master?`${master.code} · Ed. ${master.version} · ${master.fileStored?'PDF disponible':'PDF pendiente'}`:'No registrado en Biblioteca'}</span><button className="outline" onClick={onLibrary}>Gestionar en Biblioteca ↗</button></div>
   {!master?.fileStored&&<p className="psi54CustodyWarn" role="status">El formato maestro PET0103 · V07 aún no tiene PDF archivado en Biblioteca. Puede guardar registros reales ahora; quedarán identificados por el código PET0103-07 y deberán asociarse documentalmente al maestro cuando se registre. Esto no equivale a aprobar el formato.</p>}
   {canEdit&&<div className="psi54CustodyForm"><h4>+ Incorporar registros reales</h4><p>Seleccione uno o varios PDF completados. La identificación por nombre es orientativa: confirme el formato antes de archivar.</p><div className="psi54CustodyFields"><label>Fecha de muestreo *<input type="date" value={sampleDate} onChange={e=>setSampleDate(e.target.value)}/></label><label>Código de muestra / OT<input maxLength={100} value={sampleCode} onChange={e=>setSampleCode(e.target.value)} placeholder="Opcional"/></label><label>Cliente<input maxLength={120} value={client} onChange={e=>setClient(e.target.value)} placeholder="Opcional"/></label></div><label>PDF completados (máximo 400 KB por archivo)<input type="file" accept=".pdf,application/pdf" multiple onChange={e=>{setFiles(Array.from(e.target.files||[]));setConfirmed(false)}}/></label>{files.length>0&&<div className="psi54CustodyFiles">{files.map((f,i)=><div key={i}>{f.name} · {(f.size/1024).toFixed(1)} KB <span>{normalize(f.name).includes(normalize(CODE))?'Código sugerido: PET0103 · V07':'Verificar código manualmente'}</span></div>)}</div>}{codeWarning&&<p className="psi54CustodyWarn">Se detectó otro código en el nombre de algún archivo. Revise el PDF antes de confirmar.</p>}<label className="psi54CustodyConfirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo que los PDF son cadenas de custodia completadas correspondientes al formato PET0103-07, y no nuevas ediciones del formato maestro.</label><button type="button" disabled={busy||!files.length||!confirmed} onClick={save}>{busy?'Archivando…':'Archivar evidencias'}</button></div>}
   {error&&<p className="psi54CustodyWarn" role="alert">{error}</p>}{success&&<p className="psi54CustodyOk" role="status">{success}</p>}
   <div className="psi54CustodyHistory"><div className="psi54CustodyHistoryHead"><h4>Historial de registros</h4><button type="button" className="outline" onClick={()=>load(true)}>Actualizar</button></div><div className="psi54CustodyTable"><div className="psi54CustodyTH"><span>Archivo / muestra</span><span>Fecha de muestreo</span><span>Estado</span><span>Acción</span></div>{rows.map(r=><div className="psi54CustodyTR" key={r.id}><span><b>{r.filename}</b><small>{r.sampleCode||'Sin código de muestra'} · {r.client||'Cliente no indicado'}<br/>{r.masterVersion?'Ed. maestra '+r.masterVersion:'Formato maestro pendiente'} · {dateText(r.createdAt)}</small></span><span>{r.sampleDate}</span><span>{r.status==='READY'?'Archivado':'Carga incompleta'}</span><span>{r.status==='READY'&&<button type="button" className="outline" disabled={loading} onClick={()=>view(r)}>Ver PDF</button>}</span></div>)}{!rows.length&&!loading&&<p className="psi54CustodyEmpty">Aún no hay evidencias archivadas.</p>}</div>{more&&<button type="button" className="outline" disabled={loading} onClick={()=>load(false)}>Mostrar 10 más</button>}{loading&&<p>Consultando…</p>}</div>
   {pdfUrl&&selected&&<div className="psi54CustodyViewer"><div><strong>{selected.filename}</strong><a href={pdfUrl} download={selected.filename}>Descargar PDF verificado</a><button className="outline" onClick={()=>{setPdfUrl('');setSelected(null)}}>Cerrar vista</button></div><iframe src={pdfUrl} title="Registro de cadena de custodia"/></div>}
  </section></div>}
 </>;
}
