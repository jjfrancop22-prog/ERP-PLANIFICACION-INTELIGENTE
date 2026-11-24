import {collection,doc,getDoc,limit,orderBy,query,where,onSnapshot,runTransaction,serverTimestamp,addDoc,setDoc,updateDoc} from 'firebase/firestore';
import {db} from './firebase';
// Única puerta de acceso a Firestore para todos los módulos.
const state={queries:0,activeListeners:0,listenerStarts:0,listenerEvents:0,docsReceived:0,writes:0,cacheHits:0,errors:0,serverEvents:0,localEvents:0};
export const metrics=state;
const shared=new Map(),subscribers=new Set();
export function diagnostics(){return {...state,sharedQueries:shared.size};}
export function onDiagnostics(fn){subscribers.add(fn);fn(diagnostics());return()=>subscribers.delete(fn);}
function notify(){for(const fn of subscribers)fn(diagnostics());}
function count(k,n=1){state[k]+=n;notify();}
function fail(e){count('errors');throw e;}
function observe(key,target,convert,callback,onError){
 let entry=shared.get(key);
 if(!entry){
  entry={listeners:new Set(),value:undefined,stop:null,closed:false};shared.set(key,entry);
  count('listenerStarts');count('activeListeners');
  entry.stop=onSnapshot(target,{includeMetadataChanges:true},snapshot=>{
   if(entry.closed)return;
   count('listenerEvents');
   const changes=typeof snapshot.docChanges==='function'?snapshot.docChanges({includeMetadataChanges:false}).length:Number(snapshot.exists());
   if(changes)count('docsReceived',changes);
   count(snapshot.metadata.fromCache?'localEvents':'serverEvents');
   entry.value=convert(snapshot);
   for(const listener of entry.listeners)listener.callback(entry.value,{fromCache:snapshot.metadata.fromCache,hasPendingWrites:snapshot.metadata.hasPendingWrites});
  },error=>{
   if(entry.closed)return;
   count('errors');entry.closed=true;entry.stop?.();shared.delete(key);state.activeListeners=Math.max(0,state.activeListeners-1);notify();
   for(const listener of entry.listeners)listener.onError?.(error);
  });
 }
 const listener={callback,onError};entry.listeners.add(listener);
 if(entry.value!==undefined)callback(entry.value,{replayed:true});
 return()=>{entry.listeners.delete(listener);if(!entry.listeners.size&&!entry.closed){entry.closed=true;entry.stop?.();shared.delete(key);state.activeListeners=Math.max(0,state.activeListeners-1);notify();}};
}
export async function profile(uid){try{count('queries');const s=await getDoc(doc(db,'users',uid));count('docsReceived',Number(s.exists()));return s.exists()?{id:s.id,...s.data()}:null;}catch(e){return fail(e);}}
export function watchSummary(callback,onError){return observe('dashboard:global',doc(db,'dashboards','global'),s=>s.exists()?s.data():null,callback,onError);}
export function watchInbox(uid,callback,onError){const q=query(collection(db,'notifications'),where('recipientId','==',uid),where('status','==','OPEN'),orderBy('createdAt','desc'),limit(15));return observe('inbox:'+uid,q,s=>s.docs.map(d=>({id:d.id,...d.data()})),callback,onError);}
// Escuchas activas SOLO en el numeral abierto. Mismo índice para todos los numerales.
export function watchRequirement(type,requirementId,callback,onError){
 if(!['sgcDocuments','sgcRecords'].includes(type))throw Error('Colección no permitida');
 const q=query(collection(db,type),where('requirementId','==',requirementId),orderBy('createdAt','desc'),limit(10));
 return observe(`requirement:${type}:${requirementId}`,q,s=>s.docs.map(d=>({id:d.id,...d.data(),type})),callback,onError);
}
export async function createRecord(type,data,user){
 if(!['sgcDocuments','sgcRecords'].includes(type))throw Error('Colección no permitida');
 try{const fields=type==='sgcDocuments'?{code:data.code,version:data.version,responsible:data.responsible,description:data.description||''}:{};const result=await addDoc(collection(db,type),{title:data.title,requirementId:data.requirementId,createdAt:serverTimestamp(),createdBy:user.uid,status:'DRAFT',...fields});count('writes');return result;}catch(e){return fail(e);}
}
export async function closeNotification(id,uid){try{await runTransaction(db,async tx=>{const ref=doc(db,'notifications',id);const snap=await tx.get(ref);if(!snap.exists()||snap.data().recipientId!==uid||snap.data().status!=='OPEN')throw Error('Notificación no disponible');tx.update(ref,{status:'RESOLVED',resolvedAt:serverTimestamp(),resolvedBy:uid});});count('writes');}catch(e){return fail(e);}}
export function resetSessionCache(){for(const entry of shared.values()){entry.closed=true;entry.stop?.();entry.listeners.clear();}shared.clear();state.activeListeners=0;notify();}

// Punto de entrada único para avisos del SGC. En Spark solo se permite crear
// avisos para el propio usuario; no se habilita mensajería arbitraria a terceros.
// Los módulos futuros usarán una clave estable por evento para evitar duplicados.
export async function createSelfNotification(uid,{eventKey,title,message,requirementId=''}){
 if(!uid||!eventKey||!title)throw Error('Datos incompletos para la notificación');
 const safeKey=String(eventKey).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,110);
 const ref=doc(db,'notifications',`${uid}_${safeKey}`);
 try{
  await setDoc(ref,{recipientId:uid,createdBy:uid,eventKey:safeKey,title:String(title).slice(0,160),message:String(message||'').slice(0,500),requirementId:String(requirementId).slice(0,12),status:'OPEN',createdAt:serverTimestamp()});
  count('writes');return ref.id;
 }catch(e){return fail(e);}
}

// Transiciones transaccionales: la seguridad real se valida también en firestore.rules.
export async function changeDocument(id,action,user,payload={}){
 const ref=doc(db,'sgcDocuments',id);
 try{await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);if(!snap.exists())throw Error('Documento no encontrado');
  const old=snap.data();const allowed={EDIT:['DRAFT'],REVIEW:['DRAFT'],APPROVE:['IN_REVIEW'],RETURN:['IN_REVIEW']};
  if(!allowed[action]?.includes(old.status))throw Error('El estado del documento cambió. Actualice la vista.');
  const patch=action==='EDIT'?{title:payload.title,code:payload.code,version:payload.version,responsible:payload.responsible,description:payload.description,updatedAt:serverTimestamp(),updatedBy:user.uid}:
   {status:action==='REVIEW'?'IN_REVIEW':action==='APPROVE'?'APPROVED':'DRAFT',updatedAt:serverTimestamp(),updatedBy:user.uid,decisionNote:String(payload.note||'').slice(0,500)};
  if(action==='APPROVE'&&old.createdBy===user.uid)throw Error('La aprobación requiere un usuario distinto al creador.');
  tx.update(ref,patch);
 });count('writes');}catch(e){return fail(e);}
}
