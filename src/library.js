import {collection,doc,query,where,limit,onSnapshot,runTransaction,serverTimestamp,getDocs,getDoc,setDoc,updateDoc,writeBatch} from 'firebase/firestore';
import {db} from './firebase';
import {requirements} from './data';

const keywords={
 '4.1':['imparcialidad','conflicto de interes','independencia'],
 '5':['estructura organizacional','autoridad y responsabilidad','organigrama'],
 '4.2':['confidencialidad','informacion confidencial','proteccion de datos'],
 '6.2':['competencia','personal','capacitacion','autorizacion de personal'],
 '6.3':['instalaciones','condiciones ambientales'],
 '6.4':['equipamiento','mantenimiento','calibracion','equipos'],
 '6.5':['trazabilidad metrologica','patrones de referencia'],
 '6.6':['proveedores','compras','servicios externos'],
 '7.1':['contratos','solicitudes','ofertas'],
 '7.2':['validacion de metodos','verificacion de metodos','metodos de ensayo'],
 '7.3':['muestreo'], '7.4':['manipulacion de muestras','recepcion de muestras'],
 '7.5':['registros tecnicos'], '7.6':['incertidumbre'],
 '7.7':['validez de resultados','control de calidad','ensayos de aptitud'],
 '7.8':['informes de resultados','informe de ensayo'],
 '7.9':['quejas','reclamos'], '7.10':['trabajo no conforme'],
 '7.11':['gestion de informacion','sistema informatico','datos'],
 '8.2':['manual de calidad','politica de calidad'],
 '8.3':['control de documentos'], '8.4':['control de registros'],
 '8.5':['riesgos y oportunidades'], '8.6':['mejora continua'],
 '8.7':['acciones correctivas'], '8.8':['auditoria interna'],
 '8.9':['revision por la direccion']
};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function suggestRequirements(text){const t=norm(text).slice(0,30000);return requirements.filter(r=>(keywords[r.id]||[]).some(k=>t.includes(norm(k)))).map(r=>r.id);}
export function libraryCodeId(code){return norm(code).trim().replace(/[^a-z0-9_-]/g,'_').slice(0,90);}
export function watchLibrary(callback,error){return onSnapshot(query(collection(db,'sgcLibrary'),limit(50)),s=>callback(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.code).localeCompare(String(b.code)))),error);}
export function watchLibraryRequirement(id,callback,error){return onSnapshot(query(collection(db,'sgcLibrary'),where('requirementIds','array-contains',id),limit(30)),s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))),error);}
export async function createLibraryEntry(data,uid){const id=libraryCodeId(data.code);if(!id)throw Error('Código inválido');const ref=doc(db,'sgcLibrary',id);await runTransaction(db,async tx=>{const old=await tx.get(ref);if(old.exists())throw Error('Este código ya está registrado en la biblioteca. Utilice el documento existente.');tx.set(ref,{...data,requirementIds:data.requirementIds||[],status:'REGISTERED',createdBy:uid,createdAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp()});});}
// Metadata-only classification: preserves PDF versions, approvals and original identity.
export async function updateLibraryClassification(item,metadata,uid){
 const ref=doc(db,'sgcLibrary',item.id);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);if(!snap.exists())throw Error('Documento no encontrado');
  if(snap.data().code!==item.code)throw Error('El expediente cambió. Actualice la consulta.');
  tx.update(ref,{type:metadata.type,classification:metadata.classification,area:metadata.area,updatedBy:uid,updatedAt:serverTimestamp()});
 });
}
export async function updateLibraryLinks(item,requirementIds,uid){const ref=doc(db,'sgcLibrary',item.id);await runTransaction(db,async tx=>{const s=await tx.get(ref);if(!s.exists())throw Error('Documento no encontrado');tx.update(ref,{requirementIds,updatedBy:uid,updatedAt:serverTimestamp()});});}
export async function readLocalReference(file){if(!file)return '';if(file.size>5*1024*1024)throw Error('Para analizar texto, seleccione un archivo menor a 5 MB.');if(/\.(txt|md|csv)$/i.test(file.name))return (await file.text()).slice(0,30000);return '';}

// PDF immutable version blobs: chunks are read only on explicit preview.
const MAX_PDF=600*1024, CHUNK=12000;
export async function storePdfVersion(item,file,version,uid){
 if(!file||file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw Error('Seleccione un PDF.');
 if(file.size>MAX_PDF)throw Error('El PDF supera el máximo permitido de 600 KB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('El archivo no tiene una cabecera PDF válida.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const key=libraryCodeId(version);if(!key)throw Error('Edición inválida');
 const vr=doc(db,'sgcLibrary',item.id,'versions',key);
 if((await getDoc(vr)).exists())throw Error('Esta edición ya existe o quedó una carga incompleta. No se sobrescriben versiones históricas; revise el expediente antes de continuar.');
 const parts=[];for(let i=0;i<bytes.length;i+=CHUNK){let str='';for(const b of bytes.subarray(i,i+CHUNK))str+=String.fromCharCode(b);parts.push(btoa(str));}
 await setDoc(vr,{version,filename:file.name,size:file.size,sha256:digest,parts:parts.length,status:'UPLOADING',createdBy:uid,createdAt:serverTimestamp()});
 try{
  for(let i=0;i<parts.length;i+=10){const batch=writeBatch(db);for(let j=i;j<Math.min(i+10,parts.length);j++)batch.set(doc(db,'sgcLibrary',item.id,'versions',key,'chunks',String(j).padStart(4,'0')),{data:parts[j],index:j});await batch.commit();}
  await updateDoc(vr,{status:'READY',completedAt:serverTimestamp()});
  await updateDoc(doc(db,'sgcLibrary',item.id),{version,fileStored:true,referenceFileName:file.name,approvalStatus:'REGISTERED',updatedBy:uid,updatedAt:serverTimestamp()});
 }catch(e){throw Error('Carga incompleta; la edición no se activó. '+e.message)}
}
export async function listPdfVersions(item){const snap=await getDocs(query(collection(db,'sgcLibrary',item.id,'versions'),limit(50)));return snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==='READY').sort((a,b)=>String(b.version).localeCompare(String(a.version),undefined,{numeric:true}));}
export async function previewPdf(item,version,revisionId=null){const key=revisionId||libraryCodeId(version);const v=await getDoc(doc(db,'sgcLibrary',item.id,'versions',key));if(!v.exists()||v.data().status!=='READY')throw Error('Edición no disponible');const count=v.data().parts;if(!Number.isInteger(count)||count<1||count>52)throw Error('Archivo inválido');const blocks=await Promise.all(Array.from({length:count},(_,i)=>getDoc(doc(db,'sgcLibrary',item.id,'versions',key,'chunks',String(i).padStart(4,'0')))));if(blocks.some(b=>!b.exists()))throw Error('PDF incompleto');const raw=blocks.map(b=>atob(b.data().data));const length=raw.reduce((n,s)=>n+s.length,0);const bytes=new Uint8Array(length);let offset=0;for(const part of raw){for(let i=0;i<part.length;i++)bytes[offset++]=part.charCodeAt(i)}const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');if(digest!==v.data().sha256)throw Error('La integridad del archivo no coincide');return URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));}

// Approval is independent of the upload: authorized ADMIN or CALIDAD can review and approve, including their own review request.
export async function decideLibraryApproval(item,action,uid,role,note=''){
 const ref=doc(db,'sgcLibrary',item.id);
 const clean=String(note||'').trim().slice(0,500);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);if(!snap.exists())throw Error('El documento ya no existe.');
  const d=snap.data(),state=d.approvalStatus||'REGISTERED';
  if(String(d.version)!==String(item.version))throw Error('La edición cambió. Cierre y vuelva a abrir el expediente antes de decidir.');
  const isReady=d.fileStored===true||String(d.code).toUpperCase()==='PG0201';
  let changes,event;
  if(action==='REVIEW'){
   if(!['ADMIN','CALIDAD'].includes(role)||!['REGISTERED','RETURNED'].includes(state))throw Error('No es posible enviar este documento a revisión.');
   if(!isReady)throw Error('Incorpore el archivo antes de solicitar revisión.');
   changes={approvalStatus:'IN_REVIEW',reviewRequestedBy:uid,reviewRequestedAt:serverTimestamp(),decisionNote:clean};event='REVIEW';
  }else if(action==='APPROVE'||action==='RETURN'){
   if(!['ADMIN','CALIDAD'].includes(role)||state!=='IN_REVIEW')throw Error('La decisión requiere un usuario autorizado y un documento en revisión.');
   if(action==='RETURN'&&!clean)throw Error('Indique el motivo de devolución.');
   changes=action==='APPROVE'?{approvalStatus:'APPROVED',approvedBy:uid,approvedAt:serverTimestamp(),approvalVersion:d.version,decisionNote:clean}:{approvalStatus:'RETURNED',decisionNote:clean};event=action;
  }else throw Error('Acción desconocida');
  const audit=doc(collection(db,'sgcLibrary',item.id,'approvalEvents'));
  tx.update(ref,{...changes,updatedBy:uid,updatedAt:serverTimestamp()});
  tx.set(audit,{action:event,version:d.version,actor:uid,at:serverTimestamp(),note:clean});
 });
}
export async function listLibraryApprovalEvents(item){
 const s=await getDocs(query(collection(db,'sgcLibrary',item.id,'approvalEvents'),limit(100)));
 return s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));
}

// V1.0.44: immutable PDF replacement within the same controlled edition.
// The original PDF remains archived; only the active PDF pointer changes.
export async function replaceWithSignedPdf(item,file,uid,confirmation){
 if(!confirmation)throw Error('Confirme que el contenido y la edición no han cambiado.');
 if(!file||(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'))throw Error('Seleccione un PDF firmado.');
 if(file.size>MAX_PDF)throw Error('El PDF supera el máximo permitido de 600 KB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('El archivo no es un PDF válido.');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const version=String(item.version),key=libraryCodeId(version);
 const base=await getDoc(doc(db,'sgcLibrary',item.id,'versions',key));
 if(!base.exists()||base.data().status!=='READY')throw Error('Primero registre el PDF original de esta edición.');
 if(base.data().sha256===sha256)throw Error('El PDF seleccionado es idéntico al archivado.');
 const revId=key+'__firma_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
 const ref=doc(db,'sgcLibrary',item.id,'versions',revId);
 const parts=[];for(let i=0;i<bytes.length;i+=CHUNK){let str='';for(const b of bytes.subarray(i,i+CHUNK))str+=String.fromCharCode(b);parts.push(btoa(str));}
 await setDoc(ref,{version,filename:file.name,size:file.size,sha256,parts:parts.length,status:'UPLOADING',createdBy:uid,createdAt:serverTimestamp(),revisionOf:key,reason:'PDF firmado recibido; mismo contenido y edición (declaración del responsable)'});
 try{
  for(let i=0;i<parts.length;i+=10){const batch=writeBatch(db);for(let j=i;j<Math.min(i+10,parts.length);j++)batch.set(doc(db,'sgcLibrary',item.id,'versions',revId,'chunks',String(j).padStart(4,'0')),{data:parts[j],index:j});await batch.commit();}
  await updateDoc(ref,{status:'READY',completedAt:serverTimestamp()});
  await runTransaction(db,async tx=>{const main=doc(db,'sgcLibrary',item.id);const snap=await tx.get(main);if(!snap.exists()||String(snap.data().version)!==version)throw Error('La edición cambió durante la carga.');tx.update(main,{activePdfId:revId,pdfSignatureState:'SIGNED',referenceFileName:file.name,updatedBy:uid,updatedAt:serverTimestamp()});});
  return revId;
 }catch(e){throw Error('No se activó el PDF firmado: '+e.message)}
}
