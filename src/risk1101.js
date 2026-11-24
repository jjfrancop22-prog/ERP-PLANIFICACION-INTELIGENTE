import {collection,doc,query,where,orderBy,limit,getDocs,addDoc,updateDoc,serverTimestamp} from 'firebase/firestore';
import {db} from './firebase';
const col=collection(db,'sgcRiskIdentifications');
// Paginación real: 30 filas visibles y una fila adicional para detectar página siguiente.
export async function listRisk1101(uid,manager=false,cursor=null){
 const {startAfter}=await import('firebase/firestore');
 const constraints=manager?[orderBy('createdAt','desc')]:[where('createdBy','==',uid),orderBy('createdAt','desc')];
 if(cursor)constraints.push(startAfter(cursor));
 constraints.push(limit(31));
 const snap=await getDocs(query(col,...constraints));
 const shown=snap.docs.slice(0,30);
 return {rows:shown.map(d=>({id:d.id,...d.data()})),nextCursor:snap.docs.length>30?shown[shown.length-1]:null};
}
export async function createRisk1101(data,user){const year=Number(data.identifiedYear);if(!Number.isInteger(year)||year<2000||year>2100)throw Error('Indique un año válido');if(!/^\d{4}-\d{2}-\d{2}$/.test(data.identifiedDate)||Number(data.identifiedDate.slice(0,4))!==year)throw Error('El año y la fecha de identificación deben coincidir');if(!data.identifiedBy?.trim())throw Error('Indique quién identificó el riesgo u oportunidad');if(!data.source?.trim()||!data.process?.trim()||!data.description?.trim())throw Error('Complete fuente, proceso y situación identificada');const payload={...data,cause:'',effect:'',controls:'',followUpPersonId:'',followUpOwner:'',identifiedYear:year,identifiedBy:data.identifiedBy.trim(),identifiedPersonId:data.identifiedPersonId||'',identifiedPosition:data.identifiedPosition||'',identifiedArea:data.identifiedArea||'',followUpPersonId:data.followUpPersonId||'',followUpOwner:(data.followUpOwner||'').trim(),formCode:'PSI-MC1101-05',formVersion:'05',status:'PENDING',createdBy:user.uid,createdByName:user.displayName||user.email||user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),reviewedBy:'',reviewedByName:'',reviewNote:'',reviewedAt:null,mc1102Id:''};return (await addDoc(col,payload)).id;}
export async function reviewRisk1101(record,decision,note,user){if(!['LINKED','NOT_LINKED','INFO_REQUIRED'].includes(decision))throw Error('Decisión no válida');if(decision!=='LINKED'&&!note.trim())throw Error('Indique la justificación o información requerida');await updateDoc(doc(db,'sgcRiskIdentifications',record.id),{status:decision,reviewNote:note.trim().slice(0,1000),reviewedBy:user.uid,reviewedByName:user.displayName||user.email||user.uid,reviewedAt:serverTimestamp(),updatedAt:serverTimestamp()});}

// Consulta explícita de la matriz operativa; sin listener ni sobrescritura del PDF controlado.
export async function listAllRisk1101(uid,manager=false){
 const {startAfter}=await import('firebase/firestore');
 const rows=[];let cursor=null;
 do{
  const constraints=manager?[orderBy('createdAt','desc')]:[where('createdBy','==',uid),orderBy('createdAt','desc')];
  if(cursor)constraints.push(startAfter(cursor));
  constraints.push(limit(100));
  const snap=await getDocs(query(col,...constraints));
  rows.push(...snap.docs.map(d=>({id:d.id,...d.data()})));
  cursor=snap.size===100?snap.docs[snap.docs.length-1]:null;
 }while(cursor);
 return rows;
}
