import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {db} from './firebase';
import {libraryCodeId,storePdfVersion} from './library';
/** Universal document catalog: stable code, idempotent draft, origin ISO link.
 * Call from every ERP document generator. Catalog entry is NOT an archived PDF.
 */
export async function ensureCenterDraft(data,uid){
 const code=String(data.code||'').trim().toUpperCase();
 const id=libraryCodeId(code);if(!id||!uid)throw Error('Código y usuario requeridos.');
 const ref=doc(db,'sgcLibrary',id);
 return runTransaction(db,async tx=>{
  const current=await tx.get(ref);
  if(current.exists()){
   const old=current.data();
   if(String(old.code||'').toUpperCase()!==code)throw Error('Colisión de código documental.');
   // Never silently replace an approved edition, file or historical approval.
   return {created:false,id,document:old};
  }
  const ids=[...new Set([...(data.requirementIds||[]),data.originRequirement].filter(Boolean))];
  const payload={code,title:String(data.title||'').slice(0,240),version:String(data.version||'01').slice(0,20),responsible:String(data.responsible||'Coordinador de Calidad').slice(0,120),type:data.type||'FORMATO',description:String(data.description||'').slice(0,500),referenceUrl:'',referenceFileName:'',fileStored:false,requirementIds:ids,status:'REGISTERED',createdBy:uid,createdAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp()};
  tx.set(ref,payload);return {created:true,id,document:payload};
 });
}
export const personnelFormat={code:'PSI-MC1501',title:'Listado Maestro de Personal',version:'04',type:'FORMATO',responsible:'Coordinador de Calidad',description:'Formato institucional generado desde 6.2. La ficha no equivale al PDF archivado ni a una aprobación.',requirementIds:['6.2','8.3']};

/** Universal entry point for ERP-generated PDF files. Immutable edition storage. */
export async function archiveGeneratedDocument(metadata,file,uid){
 const result=await ensureCenterDraft(metadata,uid);
 const item={id:result.id,...result.document};
 if(item.approvalStatus==='APPROVED')throw Error('La edición está aprobada. Cree una nueva edición controlada antes de generar otro archivo.');
 try{await storePdfVersion(item,file,String(metadata.version),uid);return {...result,archived:true};}
 catch(err){if(/Esta edición ya existe/.test(err.message))return {...result,archived:false};throw err;}
}
