import {doc,onSnapshot,collection,query,orderBy,limit,where,getDocs,getDoc,setDoc,serverTimestamp,runTransaction,waitForPendingWrites} from 'firebase/firestore';
import {db,auth} from './firebase';
// Una sola suscripción por clave, compartida por los consumidores de la interfaz.
const listeners=new Map();
const errorLog=[];
export const syncState={network:navigator.onLine?'connecting':'offline',pending:0,errors:errorLog,lastConfirmed:null,activeListeners:0,serverConfirmed:false,cacheOnly:false,lastEvent:null};
let scheduled=false;
const emit=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;window.dispatchEvent(new CustomEvent('sync-state',{detail:{...syncState,errors:[...errorLog]}}))})};
const logError=(err)=>{errorLog.push({time:new Date().toISOString(),message:err?.message||String(err)});if(errorLog.length>12)errorLog.shift();syncState.lastEvent='error';emit()};
window.addEventListener('online',()=>{syncState.network='connecting';emit()});
window.addEventListener('offline',()=>{syncState.network='offline';syncState.serverConfirmed=false;emit()});
function setMetadata(snap){
 syncState.cacheOnly=snap.metadata.fromCache;
 if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites){syncState.network='online';syncState.serverConfirmed=true;syncState.lastConfirmed=new Date()}
 else if(snap.metadata.fromCache){syncState.network=navigator.onLine?'cache':'offline';syncState.serverConfirmed=false}
 emit();
}
export function watchShared(key,ref,callback,onError){
 let entry=listeners.get(key);
 if(!entry){
  entry={callbacks:new Set(),value:undefined,unsubscribe:null,signature:null};listeners.set(key,entry);syncState.activeListeners=listeners.size;emit();
  entry.unsubscribe=onSnapshot(ref,{includeMetadataChanges:true},snap=>{
   setMetadata(snap);
   // Los cambios de metadatos NO reconstruyen formularios ni provocan nuevas consultas.
   // Firestore ya calcula los cambios reales de la consulta. Evitar serializar
   // todos los documentos en cada aviso (especialmente en el planificador).
   // Las actualizaciones exclusivamente de metadatos no fuerzan repintados.
   const changed=snap.docs ? (entry.value===undefined||snap.docChanges().length>0)
     : (entry.value===undefined||snap.exists()!==entry.value.exists()||
        (snap.exists()&&JSON.stringify(snap.data())!==JSON.stringify(entry.value.data())));
   entry.value=snap;
   if(changed)for(const cb of [...entry.callbacks])cb(snap);
  },err=>{logError(err);onError?.(err)});
 }
 entry.callbacks.add(callback);if(entry.value)callback(entry.value);
 return ()=>{entry.callbacks.delete(callback);if(!entry.callbacks.size){entry.unsubscribe?.();listeners.delete(key);syncState.activeListeners=listeners.size;emit()}};
}
export const watchProfile=(uid,cb,err)=>watchShared(`profile:${uid}`,doc(db,'users',uid),cb,err);
export const watchCatalog=(cb,err)=>watchShared('catalog:all:v2',query(collection(db,'catalog'),orderBy('name')),cb,err);
export const watchNotifications=(uid,cb,err)=>watchShared(`notifications:${uid}:20`,query(collection(db,'users',uid,'notifications'),orderBy('createdAt','desc'),limit(20)),cb,err);
export async function readAnalysts(){const snap=await getDocs(query(collection(db,'users'),limit(100)));return snap.docs.map(x=>({id:x.id,...x.data()}))}
export async function saveCatalog(item,uid){
 if(!navigator.onLine)throw new Error('Sin conexión: para evitar conflictos, el catálogo requiere confirmación en línea.');
 syncState.pending++;syncState.lastEvent='saving';emit();
 try{
  const id=item.id||crypto.randomUUID();const ref=doc(db,'catalog',id);
  await runTransaction(db,async tx=>{
   const old=await tx.get(ref);const revision=old.exists()?(old.data().revision||0)+1:1;const technicalVersion=old.exists()?(old.data().technicalVersion||1)+1:1;const history=old.exists()?doc(db,'catalog',id,'versions',String(old.data().technicalVersion||1).padStart(6,'0')):null;const historyOld=history?await tx.get(history):null;
   const areaPrefixes={'Ensayos Analíticos':'EA','Recepción de Muestras':'RM','Microbiología':'MIC','AASS':'AASS','Actividad de Laboratorio':'AL','Soporte de Calidad':'SC','Operaciones':'OP'};
   const prefix=areaPrefixes[item.area]||'GEN';
   let assignedCode=old.exists()?(old.data().code||''):(item.code||'').trim();
   let counterRef=null,counterSnap=null,nextNumber=0;
   if(!old.exists()&&!assignedCode){
    counterRef=doc(db,'catalogCounters',prefix);
    counterSnap=await tx.get(counterRef);
    const existingMax=Math.max(0,...(item.existingCodes||[]).map(code=>{const match=String(code).match(new RegExp('^CAT-'+prefix+'-(\\d+)$'));return match?Number(match[1]):0}));
    nextNumber=Math.max(counterSnap.exists()?counterSnap.data().last||0:0,existingMax)+1;
    assignedCode='CAT-'+prefix+'-'+String(nextNumber).padStart(5,'0');
   }
   if(old.exists()&&!historyOld.exists()){tx.set(history,{snapshot:old.data(),archivedAt:serverTimestamp(),archivedBy:uid,version:old.data().technicalVersion||1});}
   if(counterRef)tx.set(counterRef,{last:nextNumber});
   tx.set(ref,{name:item.name.trim(),code:assignedCode,method:(item.method||'').trim(),instructions:(item.instructions||'').trim(),curveType:(item.curveType||'').trim(),curvePoints:Number(item.curvePoints)||0,curveUnit:(item.curveUnit||'').trim(),curveStandards:item.curveStandards||[],timeModel:item.timeModel||'FIJO',timeRanges:item.timeRanges||[],components:item.components||[],sampleParameters:item.sampleParameters||[],technicalVersion,area:item.area.trim(),durationMin:Number(item.durationMin),type:item.type,requiresSamples:!!item.requiresSamples,requiresCurve:!!item.requiresCurve,reactives:item.reactives||[],...(old.exists()&&old.data().controlIds?{controlIds:old.data().controlIds}:{}),active:true,revision,updatedAt:serverTimestamp(),updatedBy:uid,...(!old.exists()?{createdAt:serverTimestamp()}: {})},{merge:old.exists()});
  });
  syncState.lastConfirmed=new Date();syncState.network='online';syncState.serverConfirmed=true;syncState.lastEvent='confirmed';return id;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}
export async function confirmPendingWrites(){await waitForPendingWrites(db);syncState.lastConfirmed=new Date();syncState.lastEvent='confirmed';emit()}
export function clearSyncListeners(){for(const entry of listeners.values())entry.unsubscribe?.();listeners.clear();syncState.activeListeners=0;syncState.serverConfirmed=false;syncState.network=navigator.onLine?'connecting':'offline';emit()}

// Inventario maestro: un listener compartido para todos los consumidores del módulo.
// Lectura pasiva: la creación y las asignaciones se harán en Cartas de Control.
export const watchDailyControls=(date,cb,err)=>watchShared('dailyControls:'+date,query(collection(db,'dailyControlRecords'),where('date','==',date),limit(250)),cb,err);
export async function saveControlCard({id,name,code,activityIds,min,max,unit,kind="SIMPLE",equipment="",tolerance=0.1},uid){
 if(!navigator.onLine)throw Error('Sin conexión.');
 if(!name?.trim()||!code?.trim()||!activityIds?.length||!Number.isFinite(min)||!Number.isFinite(max)||min>=max)throw Error('Configure nombre, código, ensayos y límites válidos.');
 if(['MULTIPUNTO','CONDUCTIVIDAD'].includes(kind)&&(!Number.isFinite(tolerance)||tolerance<=0))throw Error('Tolerancia multipunto inválida.');
 const ref=doc(db,'controlCards',id||crypto.randomUUID());
 // Creación con ID aleatorio: evita la lectura previa de la transacción, que puede
 // fallar por reglas get aunque la creación esté permitida. No modifica cartas existentes.
 try {
  await setDoc(ref,{name:name.trim(),code:code.trim(),activityIds,status:'ACTIVO',frequency:'DIARIA',min,max,unit:unit||'',kind,equipment:equipment.trim(),tolerance:['MULTIPUNTO','CONDUCTIVIDAD'].includes(kind)?tolerance:null,createdBy:uid,createdAt:serverTimestamp()});
 } catch(err) {
  if(err?.code==='permission-denied')throw Error('Firebase rechazó la creación en controlCards (permission-denied). Compruebe que firestore.rules esté PUBLICADO en el proyecto erp-planificacion-nextgen-v29 y que su perfil users/{uid} tenga status ACTIVO y role JEFE. No se ha guardado la carta.');
  throw err;
 }
 return ref.id;
}
// Vinculación administrativa independiente de las mediciones históricas.
export async function updateControlCardLinks(cardId,activityIds,uid){
 if(!navigator.onLine)throw Error('Se requiere conexión para confirmar las vinculaciones.');
 const ids=[...new Set(activityIds)];
 if(!ids.length||ids.length>100)throw Error('Seleccione entre 1 y 100 actividades.');
 const ref=doc(db,'controlCards',cardId);
 await runTransaction(db,async tx=>{
  const snapshot=await tx.get(ref);
  if(!snapshot.exists()||snapshot.data().status!=='ACTIVO')throw Error('La carta no está activa.');
  tx.update(ref,{activityIds:ids,linksUpdatedBy:uid,linksUpdatedAt:serverTimestamp()});
 });
 return ids.length;
}
// V29.0.109: corrección administrativa de identificación, sin alterar controles históricos.
export async function completeDailyControl(card,date,value,uid){
 if(!navigator.onLine)throw Error('Se requiere conexión.');
 const number=Number(value);if(!Number.isFinite(number))throw Error('Medición inválida.');
 if(number<Number(card.min)||number>Number(card.max))throw Error('Fuera de control: no se registra como completada. Debe investigarse.');
 const ref=doc(db,'dailyControlRecords',date+'_'+card.id),cardRef=doc(db,'controlCards',card.id);
 await runTransaction(db,async tx=>{
  const [existing,master]=await Promise.all([tx.get(ref),tx.get(cardRef)]);
  if(existing.exists())throw Error('Esta carta ya fue registrada para esta fecha por '+(existing.data().completedBy||'otro analista')+'.');
  if(!master.exists()||master.data().status!=='ACTIVO')throw Error('Carta no activa.');
  const c=master.data();if(number<c.min||number>c.max)throw Error('Medición fuera de límites.');
  tx.set(ref,{date,controlId:card.id,status:'COMPLETADA',value:number,unit:c.unit||'',min:c.min,max:c.max,completedBy:uid,completedAt:serverTimestamp()});
 });await waitForPendingWrites(db);
}
// V29.0.98: registro multipunto atómico, con evidencia incluso si no cumple.
export async function completeMultipointControl(card,date,readings,uid,observations=''){
 if(!navigator.onLine)throw Error('Se requiere conexión para registrar el control.');
 if(card?.kind!=='MULTIPUNTO')throw Error('La carta no es multipunto.');
 const levels=[4,7,10],values=levels.map(k=>Number(readings[String(k)]));
 if(levels.some(k=>readings[String(k)]===undefined||String(readings[String(k)]).trim()==='')||values.some(v=>!Number.isFinite(v)||v<0||v>14))throw Error('Ingrese las tres lecturas válidas (pH 0–14).');
 const ref=doc(db,'dailyControlRecords',date+'_'+card.id),masterRef=doc(db,'controlCards',card.id);
 syncState.pending++;emit();
 try{
  await runTransaction(db,async tx=>{
   const [old,master]=await Promise.all([tx.get(ref),tx.get(masterRef)]);
   if(old.exists())throw Error('Ya existe un registro confirmado para esta carta y fecha. Consulte el control compartido.');
   if(!master.exists()||master.data().status!=='ACTIVO'||master.data().kind!=='MULTIPUNTO')throw Error('Modelo multipunto no disponible.');
   const tolerance=Number(master.data().tolerance);
   if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('Tolerancia del modelo inválida.');
   const errors=values.map((v,i)=>v-levels[i]);
   const conforms=errors.every(e=>Math.abs(e)<=tolerance+1e-9);
   tx.set(ref,{date,controlId:card.id,kind:'MULTIPUNTO',status:conforms?'COMPLETADA':'NO_CONFORME',readings:values,errors,nominals:levels,tolerance,conforms,observations:String(observations).slice(0,1500),completedBy:uid,completedAt:serverTimestamp()});
  });
  // runTransaction resolves only after this transaction commits on the server.
  // Do not wait for unrelated pending writes, which may keep the form blocked.
  syncState.lastConfirmed=new Date();syncState.lastEvent='confirmed';emit();
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}
export const watchControlCards=(cb,err)=>watchShared('controlCards:250',query(collection(db,'controlCards'),limit(250)),cb,err);
export const watchReagents=(cb,err)=>watchShared('reagents:all:v120',query(collection(db,'reagents'),orderBy('name')),cb,err);
const prefixes={REACTIVO:'REA',ESTANDAR:'STD',MRC:'MRC',INSUMO:'INS'};
const productKey=(type,name)=>`${type}_${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')}`;
export async function saveReagent(item,uid){
 if(!navigator.onLine)throw new Error('Se requiere conexión para confirmar el inventario.');
 syncState.pending++;emit();
 try{
  const id=item.id||crypto.randomUUID(),ref=doc(db,'reagents',id);
  const type=item.productType||'REACTIVO',key=productKey(type,item.name),registry=doc(db,'productRegistry',key),counter=doc(db,'productCounters',type);
  if(!key.split('_').slice(1).join(''))throw Error('Indique el nombre del producto.');
  await runTransaction(db,async tx=>{
   const old=await tx.get(ref);
   const reg=old.exists()?null:await tx.get(registry);
   const count=!old.exists()&&!(reg?.exists())?await tx.get(counter):null;
   // Edición de metadatos: usar el saldo confirmado de la transacción.
   // El formulario puede contener un saldo antiguo si otro usuario consumió mientras estaba abierto.
   // Nunca modificar stock ni lastOperationId desde esta operación.

   if(old.exists() && (old.data().code!==item.code || old.data().name!==item.name.trim() || (old.data().productType||'REACTIVO')!==type))throw Error('El código, nombre y tipo son permanentes; cree otro producto si corresponde.');
   let code=old.exists()?old.data().code:reg?.exists()?reg.data().code:null;
   if(!code){const next=(count.exists()?count.data().last:0)+1;code=`${prefixes[type]}-${String(next).padStart(4,'0')}`;tx.set(counter,{last:next});tx.set(registry,{code,name:item.name.trim(),productType:type,createdAt:serverTimestamp(),createdBy:uid});}
   if(!old.exists() && reg.exists() && reg.data().name.toLocaleLowerCase('es')!==item.name.trim().toLocaleLowerCase('es'))throw Error('Revise el nombre: existe un producto similar.');
   if(item.control==='LIQUID'&&(!Number.isFinite(Number(item.densityGramsPerMl))||Number(item.densityGramsPerMl)<=0))throw Error('Para líquido pesable registre densidad positiva en g/mL.');if(item.control!=='COUNT'&&(!Number.isFinite(Number(item.tareGrams))||Number(item.tareGrams)<0))throw Error('Ingrese tara válida.');const d={code,name:item.name.trim(),lot:item.lot.trim(),brand:item.brand.trim(),presentation:(item.presentation||'').trim(),productType:type,activityIds:item.activityIds||[],control:item.control,unit:item.unit,minStock:Number(item.minStock),status:item.status,tareGrams:Number(item.tareGrams||0),densityGramsPerMl:Number(item.densityGramsPerMl||0)};
   if(old.exists()){
    const previous=old.data(),changes={};
    for(const [field,value] of Object.entries(d))if(JSON.stringify(previous[field]??null)!==JSON.stringify(value))changes[field]=value;
    if(Object.keys(changes).length)tx.update(ref,{...changes,version:previous.version+1,updatedBy:uid,updatedAt:serverTimestamp()});
   }else{
    tx.set(ref,{...d,stock:Number(item.stock),version:1,updatedBy:uid,updatedAt:serverTimestamp(),createdAt:serverTimestamp(),createdBy:uid});
   }
  });
  syncState.lastConfirmed=new Date();syncState.serverConfirmed=true;syncState.lastEvent='confirmed';emit();return id;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}

// Edición administrativa exclusiva: jamás envía saldo, pesaje, lote ni movimientos.
export async function editReagentHeader({id,name,code,lot,brand,presentation,productType,activityIds},uid){
 if(!navigator.onLine)throw Error('Se requiere conexión para editar el producto.');
 if(!id||!name?.trim()||!code?.trim()||!lot?.trim())throw Error('Nombre, código y lote son obligatorios.');
 if(!['REACTIVO','ESTANDAR','MRC','INSUMO'].includes(productType))throw Error('Tipo de producto inválido.');
 if(!Array.isArray(activityIds)||activityIds.length>100||new Set(activityIds).size!==activityIds.length)throw Error('Vinculaciones inválidas.');
 syncState.pending++;emit();
 try{
  const ref=doc(db,'reagents',id);
  await runTransaction(db,async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists())throw Error('El producto ya no existe.');
   const old=snap.data();const changes={};
   for(const [key,value] of Object.entries({name:name.trim(),code:code.trim(),lot:lot.trim(),brand:brand.trim(),presentation:presentation.trim(),productType})){if((old[key]??(key==='productType'?'REACTIVO':''))!==value)changes[key]=value;}
   if(JSON.stringify(old.activityIds||[])!==JSON.stringify(activityIds))changes.activityIds=activityIds;
   if(Object.keys(changes).length)tx.update(ref,{...changes,version:old.version+1,updatedBy:uid,updatedAt:serverTimestamp()});
  });
  syncState.lastConfirmed=new Date();syncState.serverConfirmed=true;emit();return id;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}

// Reposición administrativa: entrada positiva con asiento inmutable en la misma transacción.
export async function replenishReagent({reagentId,quantity,notes,operationId},uid){
 if(!navigator.onLine)throw Error('Se requiere conexión para registrar una entrada.');
 if(!Number.isFinite(quantity)||quantity<=0)throw Error('La cantidad debe ser positiva.');
 if(!operationId)throw Error('Identificador de operación requerido.');
 syncState.pending++;syncState.lastEvent='saving';emit();
 try{
  const ref=doc(db,'reagents',reagentId),mov=doc(db,'reagents',reagentId,'movements',operationId);
  const result=await runTransaction(db,async tx=>{
   const old=await tx.get(ref),previous=await tx.get(mov);
   if(previous.exists())return {duplicate:true,stock:previous.data().stockAfter};
   if(!old.exists())throw Error('El lote no existe. Registre un lote nuevo desde Nueva ficha.');
   const d=old.data(),q=Math.round(quantity*1e6)/1e6;
   if(d.status!=='ACTIVO')throw Error('Active el lote antes de reponerlo.');
   const after=Math.round((d.stock+q)*1e6)/1e6,version=d.version+1;
   tx.update(ref,{stock:after,version,updatedAt:serverTimestamp(),updatedBy:uid,lastOperationId:operationId});
   tx.set(mov,{id:operationId,reagentId,uid,kind:'ENTRADA',quantity:q,unit:d.unit,control:d.control,stockBefore:d.stock,stockAfter:after,version,measurement:{method:'ADMIN_ENTRY'},notes:notes||'',createdAt:serverTimestamp()});
   return {duplicate:false,stock:after};
  });
  syncState.lastConfirmed=new Date();syncState.serverConfirmed=true;syncState.lastEvent='confirmed';emit();return result;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}

// V29.0.7: movimientos atómicos, idempotentes por identificador único.
export async function consumeReagent({reagentId,operationId,quantity,measurement,notes},uid){
 if(!navigator.onLine)throw new Error('Se requiere conexión para confirmar el descuento.');
 if(!Number.isFinite(quantity)||quantity<=0)throw new Error('La cantidad debe ser mayor que cero.');
 syncState.pending++;syncState.lastEvent='saving';emit();
 try{
  const ref=doc(db,'reagents',reagentId),movementRef=doc(db,'reagents',reagentId,'movements',operationId);
  const result=await runTransaction(db,async tx=>{
   const old=await tx.get(ref);const existing=await tx.get(movementRef);
   if(existing.exists())return {duplicate:true,stock:existing.data().stockAfter};
   if(!old.exists())throw new Error('El reactivo no existe.');
   const data=old.data();if(data.status!=='ACTIVO')throw new Error('Reactivo inactivo.');
   const factor=data.unit==='kg'||data.unit==='L'?1000:1;
   const normalized=Math.round(quantity*1e6)/1e6;
   if(normalized>data.stock+1e-8)throw new Error('Existencia insuficiente. Disponible: '+data.stock+' '+data.unit);
   const after=Math.round((data.stock-normalized)*1e6)/1e6;
   const version=data.version+1;
   tx.update(ref,{stock:after,version,updatedAt:serverTimestamp(),updatedBy:uid,lastOperationId:operationId});
   tx.set(movementRef,{id:operationId,reagentId,uid,kind:'CONSUMO',quantity:normalized,unit:data.unit,control:data.control,stockBefore:data.stock,stockAfter:after,version,measurement,notes:notes||'',createdAt:serverTimestamp()});
   return {duplicate:false,stock:after};
  });
  syncState.lastConfirmed=new Date();syncState.serverConfirmed=true;syncState.network='online';syncState.lastEvent='confirmed';emit();return result;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}
// Corrección administrativa con asiento inmutable y transacción idempotente.
export async function adjustReagent({reagentId,operationId,delta,notes},uid){
 if(!navigator.onLine)throw Error('Se requiere conexión para confirmar el ajuste.');
 if(!Number.isFinite(delta)||delta===0)throw Error('El ajuste debe ser distinto de cero.');
 if(!notes||notes.trim().length<8)throw Error('Explique el motivo del ajuste (mínimo 8 caracteres).');
 syncState.pending++;syncState.lastEvent='saving';emit();
 try{
  const ref=doc(db,'reagents',reagentId),movementRef=doc(db,'reagents',reagentId,'movements',operationId);
  const result=await runTransaction(db,async tx=>{
   const old=await tx.get(ref),existing=await tx.get(movementRef);
   if(existing.exists())return {duplicate:true,stock:existing.data().stockAfter};
   if(!old.exists())throw Error('El frasco no existe.');
   const data=old.data(),quantity=Math.round(Math.abs(delta)*1e6)/1e6;
   if(data.control==='COUNT'&&!Number.isInteger(quantity))throw Error('Los ajustes contables requieren unidades enteras.');
   const after=Math.round((data.stock+Math.sign(delta)*quantity)*1e6)/1e6;
   if(after<0)throw Error('El ajuste no puede dejar stock negativo. Disponible: '+data.stock);
   const version=data.version+1;
   tx.update(ref,{stock:after,version,updatedAt:serverTimestamp(),updatedBy:uid,lastOperationId:operationId});
   tx.set(movementRef,{id:operationId,reagentId,uid,kind:'AJUSTE',quantity,unit:data.unit,control:data.control,stockBefore:data.stock,stockAfter:after,version,measurement:{method:'AJUSTE',direction:delta>0?'POSITIVO':'NEGATIVO'},notes:notes.trim(),createdAt:serverTimestamp()});
   return {duplicate:false,stock:after};
  });
  syncState.lastConfirmed=new Date();syncState.serverConfirmed=true;syncState.lastEvent='confirmed';emit();return result;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}
export async function readReagentMovements(reagentId){
 const ref=collection(db,'reagents',reagentId,'movements');
 const snap=await getDocs(query(ref,orderBy('createdAt','desc'),limit(20)));
 return snap.docs.map(d=>({id:d.id,...d.data()}));
}

// Historial vivo: escucha SOLO el lote abierto; se libera al cerrar.
export function watchReagentMovements(reagentId,callback,onError){
 const ref=query(collection(db,'reagents',reagentId,'movements'),orderBy('createdAt','desc'),limit(20));
 return onSnapshot(ref,{includeMetadataChanges:true},snap=>callback(snap.docs.map(d=>({id:d.id,...d.data()})),{fromCache:snap.metadata.fromCache,pending:snap.metadata.hasPendingWrites}),onError);
}

// Las competencias son una configuración administrativa independiente del perfil de acceso.
export async function readCompetencies(){const snap=await getDocs(query(collection(db,'analystCompetencies'),limit(100)));return Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));}
export async function saveCompetencies(uid,areas,adminUid){await setDoc(doc(db,'analystCompetencies',uid),{areas,updatedBy:adminUid,updatedAt:serverTimestamp()});await waitForPendingWrites(db);}

// Planificación: documentos permanentes, baja lógica y concurrencia optimista.
export const watchPlans=(cb,err)=>watchShared('plans:500',query(collection(db,'plannerAssignments'),limit(500)),cb,err);
function planPayload(item){return {date:item.date,analystId:item.analystId,analystName:item.analystName,activityId:item.activityId,activityName:item.activityName,area:item.area,startMin:item.startMin,endMin:item.endMin,durationMin:item.durationMin,timeModel:item.timeModel||'FIJO',sampleCount:Number(item.sampleCount||0),catalogRevision:Number(item.catalogRevision||1),catalogTechnicalVersion:Number(item.catalogTechnicalVersion||1),notes:item.notes||''};}
export async function savePlan(item,uid,companion=null){
 if(!navigator.onLine)throw Error('Se requiere conexión para planificar.');
 const id=item.id||crypto.randomUUID(),ref=doc(db,'plannerAssignments',id);
 syncState.pending++;emit();
 try{await runTransaction(db,async tx=>{
  const old=await tx.get(ref);
  if(old.exists()&&old.data().revision!==item.expectedRevision)throw Error('Otro usuario modificó esta planificación. Actualice y reintente.');
  if(old.exists()&&old.data().status!=='PROGRAMADO')throw Error('Solo pueden modificarse actividades PROGRAMADAS.');
  if(companion){const otherRef=doc(db,'plannerAssignments',crypto.randomUUID());tx.set(otherRef,{...planPayload(companion,uid),status:'PROGRAMADO',revision:1,createdBy:uid,createdAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp()});}
  tx.set(ref,{date:item.date,analystId:item.analystId,analystName:item.analystName,activityId:item.activityId,activityName:item.activityName,area:item.area,startMin:item.startMin,endMin:item.endMin,durationMin:item.durationMin,timeModel:item.timeModel||'FIJO',sampleCount:Number(item.sampleCount||0),catalogRevision:Number(item.catalogRevision||1),catalogTechnicalVersion:Number(item.catalogTechnicalVersion||1),notes:item.notes||'',status:old.exists()?old.data().status:'PROGRAMADO',revision:old.exists()?old.data().revision+1:1,updatedBy:uid,updatedAt:serverTimestamp(),...(old.exists()?{createdBy:old.data().createdBy,createdAt:old.data().createdAt}:{createdBy:uid,createdAt:serverTimestamp()})});
 });await waitForPendingWrites(db);syncState.serverConfirmed=true;return id}finally{syncState.pending--;emit()}
}
export async function cancelPlan(item,uid){
 if(!navigator.onLine)throw Error('Se requiere conexión para cancelar.');
 const ref=doc(db,'plannerAssignments',item.id);syncState.pending++;emit();
 try{await runTransaction(db,async tx=>{const old=await tx.get(ref);if(!old.exists()||old.data().revision!==item.revision||old.data().status!=='PROGRAMADO')throw Error('La asignación cambió o ya fue iniciada. Actualice.');tx.update(ref,{status:'CANCELADO',revision:old.data().revision+1,updatedBy:uid,updatedAt:serverTimestamp()})});await waitForPendingWrites(db)}finally{syncState.pending--;emit()}
}

// Consulta segura: Firestore valida analystId == auth.uid en las reglas.
export const watchMyPlans=(uid,cb,err)=>watchShared(`myPlans:${uid}:500`,query(collection(db,'plannerAssignments'),where('analystId','==',uid),limit(500)),cb,err);

// V29.0.41: transición atómica e idempotente. Nunca se confía en el estado local.
export async function startJourneyActivity(item,uid){
 if(!navigator.onLine)throw Error('Debe conectarse a Internet para abrir una actividad.');
 const ref=doc(db,'plannerAssignments',item.id);syncState.pending++;emit();
 try{
  await runTransaction(db,async tx=>{
   const snap=await tx.get(ref);if(!snap.exists())throw Error('La actividad ya no existe.');
   const data=snap.data();if(data.analystId!==uid)throw Error('Esta actividad corresponde a otro analista.');
   if(data.status==='EN_PROCESO'&&data.startedBy===uid)return;
   if(data.status!=='PROGRAMADO')throw Error('La actividad ya cambió de estado.');
   if(data.revision!==item.revision)throw Error('La actividad fue modificada. Actualice la jornada.');
   tx.update(ref,{status:'EN_PROCESO',revision:data.revision+1,startedBy:uid,startedAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp()});
  });
  // runTransaction resuelve tras la confirmación del servidor; esperar TODAS las
  // escrituras pendientes de la app puede bloquear innecesariamente esta apertura.
  syncState.serverConfirmed=true;syncState.lastConfirmed=new Date();syncState.lastEvent='confirmed';emit();
 }finally{syncState.pending--;emit()}
}
// V29.0.47: cierre con evidencia verificable en reglas. Las cartas deben
// estar congeladas en catalog.controlIds; si falta el mapeo, no se cierra.
export async function finishJourneyActivity(plan,activity,uid,linkedCards=[]){
 if(!navigator.onLine)throw Error('Se requiere conexión para finalizar.');
 const planRef=doc(db,'plannerAssignments',plan.id),catalogRef=doc(db,'catalog',plan.activityId),techRef=doc(db,'journeyTechnical',plan.id);
 const consumptions=await readJourneyConsumptions(plan.id);
 syncState.pending++;emit();
 try{
  const result=await runTransaction(db,async tx=>{
   const [ps,cs,ts]=await Promise.all([tx.get(planRef),tx.get(catalogRef),tx.get(techRef)]);
   if(!ps.exists()||!cs.exists())throw Error('No existe la planificación o su ficha técnica.');
   const d=ps.data(),c=cs.data();
   if(d.analystId!==uid)throw Error('Actividad asignada a otro analista.');
   if(d.status==='REALIZADO'&&d.finishedBy===uid)return {already:true};
   if(d.status!=='EN_PROCESO')throw Error('Solo se puede finalizar una actividad EN PROCESO.');
   const administrative=/\b(?:permiso(?:s)?(?:\s+laboral)?|vacaciones|licencia(?:s)?|ausencia(?:s)?|descanso(?:s)?(?:\s+m[eé]dico)?|feriado(?:s)?|calamidad(?:\s+dom[eé]stica)?)\b/i.test(String(d.activityName||'')) && !(c.reactives||[]).length && !(c.controlIds||[]).length;
   if(!administrative&&(c.requiresSamples===true||c.requiresCurve===true||!['NONE','',null,undefined].includes(c.analyticalMode))&&(!ts.exists()||ts.data().sampleCount<0||(c.requiresSamples===true&&(!Array.isArray(ts.data().parameters)||!ts.data().parameters.length))))throw Error('Datos técnicos pendientes.');
   const ids=c.controlIds==null?[]:c.controlIds;
   if(!Array.isArray(ids)||ids.length>5||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))||new Set(ids).size!==ids.length)throw Error('Configuración inválida de cartas obligatorias. Revise la ficha en Catálogo Maestro.');
   const cardRefs=ids.map(id=>doc(db,'dailyControlRecords',d.date+'_'+id));
   const cardSnaps=await Promise.all(cardRefs.map(ref=>tx.get(ref)));
   if(cardSnaps.some((snap,i)=>!snap.exists()||snap.data().status!=='COMPLETADA'||snap.data().date!==d.date||snap.data().controlId!==ids[i]))throw Error('Falta una carta de control conforme para la fecha de ejecución.');
   const hasReagents=Array.isArray(c.reactives)&&c.reactives.length>0;
   // La prueba de consumo se ancla a un documento inmutable de Firebase.
   let consumptionId='';
   if(hasReagents){
    const evidence=consumptions;
    if(!evidence.length)throw Error('Debe registrar consumo de reactivos.');
    consumptionId=evidence[0].id;
    const consumption=await tx.get(doc(db,'journeyConsumptions',consumptionId));
    if(!consumption.exists()||consumption.data().planId!==plan.id||consumption.data().uid!==uid)throw Error('Consumo no verificable.');
   }
   tx.update(planRef,{status:'REALIZADO',revision:d.revision+1,updatedBy:uid,updatedAt:serverTimestamp(),finishedBy:uid,finishedAt:serverTimestamp(),closureControlIds:ids,closureConsumptionId:consumptionId});
   return {already:false};
  });
  // runTransaction resuelve al confirmar esta transacción con el servidor.
  // waitForPendingWrites espera TAMBIÉN escrituras ajenas y puede bloquear el botón indefinidamente.
  syncState.serverConfirmed=true;syncState.lastConfirmed=new Date();return result;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}
// V29.0.42: borrador técnico independiente; no modifica la planificación ni inventario.
export async function readJourneyTechnical(planId){
 const snap=await getDoc(doc(db,'journeyTechnical',planId));
 return snap.exists()?snap.data():null;
}
export async function saveJourneyTechnical(planId,uid,payload){
 if(!navigator.onLine)throw Error('Sin conexión: no se confirmó el guardado.');
 const planRef=doc(db,'plannerAssignments',planId),techRef=doc(db,'journeyTechnical',planId);
 syncState.pending++;emit();
 try{
  const result=await runTransaction(db,async tx=>{
   const [plan,old]=await Promise.all([tx.get(planRef),tx.get(techRef)]);
   if(!plan.exists()||plan.data().analystId!==uid||plan.data().status!=='EN_PROCESO')throw Error('La actividad no está abierta para este analista.');
   const previous=old.exists()?old.data():null;
   if(previous&&previous.analystId!==uid)throw Error('El registro pertenece a otro usuario.');
   if(previous&&previous.revision!==payload.expectedRevision)throw Error('Otro dispositivo actualizó estos datos. Recargue antes de guardar para evitar sobrescribirlos.');
   const data={analystId:uid,planId,date:plan.data().date,revision:(previous?.revision||0)+1,sampleCount:payload.sampleCount,parameters:payload.parameters,observations:payload.observations,analytical:payload.analytical||previous?.analytical||null,updatedBy:uid,updatedAt:serverTimestamp(),createdBy:previous?.createdBy||uid,createdAt:previous?.createdAt||serverTimestamp()};
   tx.set(techRef,data);return data.revision;
  });
  await waitForPendingWrites(db);syncState.serverConfirmed=true;return result;
 }finally{syncState.pending--;emit()}
}

// V29.0.43: una sola transacción para existencia, movimiento y vínculo con la jornada.
// operationId se genera antes del primer intento y se conserva durante los reintentos.
export async function consumeJourneyReagent({planId,reagentId,operationId,quantity,measurement,notes},uid){
 if(!navigator.onLine)throw Error('Se requiere conexión para confirmar el consumo.');
 const q=Math.round(Number(quantity)*1e6)/1e6;
 if(!Number.isFinite(q)||q<=0||q>1000000)throw Error('Cantidad inválida.');
 if(!/^[a-zA-Z0-9_-]{16,80}$/.test(operationId))throw Error('Identificador de operación inválido.');
 syncState.pending++;emit();
 try{
  const planRef=doc(db,'plannerAssignments',planId),reagentRef=doc(db,'reagents',reagentId);
  const movementRef=doc(db,'reagents',reagentId,'movements',operationId);
  const entryRef=doc(db,'journeyConsumptions',operationId);
  const result=await runTransaction(db,async tx=>{
   const [plan,reagent,movement,entry]=await Promise.all([tx.get(planRef),tx.get(reagentRef),tx.get(movementRef),tx.get(entryRef)]);
   if(entry.exists()&&movement.exists()&&entry.data().planId===planId&&entry.data().reagentId===reagentId&&entry.data().uid===uid)return {duplicate:true,stock:movement.data().stockAfter};
   if(entry.exists()||movement.exists())throw Error('El identificador ya fue utilizado en otra operación.');
   if(!plan.exists()||plan.data().analystId!==uid||plan.data().status!=='EN_PROCESO')throw Error('La actividad no está abierta para este analista.');
   if(!reagent.exists())throw Error('El lote ya no existe.');
   const r=reagent.data();
   if(r.status!=='ACTIVO')throw Error('El lote no está activo.');
   if(!Number.isFinite(r.stock)||r.stock<q-1e-8)throw Error('Stock insuficiente. Disponible: '+r.stock+' '+r.unit);
   const after=Math.round((r.stock-q)*1e6)/1e6,version=r.version+1;
   if(!measurement||!['COUNT','SOLID','LIQUID'].includes(measurement.method)||measurement.method!==r.control)throw Error('Medición incompatible con el tipo de lote.');
   const auditMeasurement={...measurement,planId};
   tx.update(reagentRef,{stock:after,version,lastOperationId:operationId,updatedAt:serverTimestamp(),updatedBy:uid});
   tx.set(movementRef,{id:operationId,reagentId,uid,kind:'CONSUMO',quantity:q,unit:r.unit,control:r.control,stockBefore:r.stock,stockAfter:after,version,measurement:auditMeasurement,notes:notes||'',createdAt:serverTimestamp()});
   tx.set(entryRef,{id:operationId,planId,reagentId,uid,quantity:q,unit:r.unit,measurement:auditMeasurement,notes:notes||'',createdAt:serverTimestamp()});
   return {duplicate:false,stock:after};
  });
  syncState.serverConfirmed=true;syncState.lastConfirmed=new Date();return result;
 }catch(e){logError(e);throw e}finally{syncState.pending--;emit()}
}
export async function readJourneyConsumptions(planId){
 const uid=auth.currentUser?.uid;
 if(!uid)throw Error('Sesión no autenticada. Vuelva a iniciar sesión.');
 const snap=await getDocs(query(collection(db,'journeyConsumptions'),where('planId','==',planId),where('uid','==',uid),limit(100)));
 return snap.docs.map(d=>({id:d.id,...d.data()}));
}

// V29.0.45 · Lectura compartida: una carta es única por fecha y código, NO por analista.
// Las escrituras y el cierre quedan deshabilitados hasta implementar el módulo propietario.
export async function readSharedDailyControls(date,controlIds){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Fecha inválida.');
 const ids=[...new Set((controlIds||[]).filter(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x)))];
 return Promise.all(ids.map(async id=>{
  const ref=doc(db,'dailyControlRecords',date+'_'+id);
  const snap=await getDoc(ref);
  const d=snap.exists()?snap.data():null;
  return {controlId:id,recordId:ref.id,complete:!!(d&&d.date===date&&d.controlId===id&&d.status==='COMPLETADA'),record:d};
 }));
}
export async function readJourneyClosureChecklist(plan,activity,linked=[]){
 const [technical,consumptions]=await Promise.all([readJourneyTechnical(plan.id),readJourneyConsumptions(plan.id)]);
 const ids=[...new Set([...(Array.isArray(activity?.controlIds)?activity.controlIds:[]),...linked.filter(c=>c.status==='ACTIVO'&&c.activityIds?.includes(plan.activityId)).map(c=>c.id)])];
 const cards=await readSharedDailyControls(plan.date,ids);
 const administrative=/\b(?:permiso(?:s)?(?:\s+laboral)?|vacaciones|licencia(?:s)?|ausencia(?:s)?|descanso(?:s)?(?:\s+m[eé]dico)?|feriado(?:s)?|calamidad(?:\s+dom[eé]stica)?)\b/i.test(String(plan.activityName||'')) && !(activity?.reactives||[]).length && !(activity?.controlIds||[]).length;
 const needsTechnical=activity?.requiresSamples===true||activity?.requiresCurve===true||!['NONE','',null,undefined].includes(activity?.analyticalMode);
 const technicalOk=administrative||!needsTechnical||!!(technical&&technical.sampleCount>=0&&(!activity?.requiresSamples||(Array.isArray(technical.parameters)&&technical.parameters.length>0)));
 const reagentsConfigured=Array.isArray(activity?.reactives)&&activity.reactives.length>0;
 const reagentOk=!reagentsConfigured||consumptions.length>0;
 // Fallo seguro: sin mapeo de cartas no se declara conforme.
 const controlsOk=ids.length<=5&&cards.length===ids.length&&cards.every(x=>x.complete);
 const items=[
  {title:'Datos técnicos y muestras',ok:technicalOk,message:administrative||!needsTechnical?'No aplica: el Catálogo Maestro no exige registro técnico':technicalOk?'Registro disponible en Firebase':'Falta el registro técnico completo'},
  {title:'Consumos de reactivos',ok:reagentOk,message:reagentOk?`${consumptions.length} consumo(s) registrados o actividad sin reactivos configurados`:'Falta registrar el consumo vinculado'},
  {title:'Cartas de control compartidas',ok:controlsOk,message:!ids.length?'No aplica: esta actividad no tiene cartas obligatorias asignadas':cards.filter(x=>x.complete).length+' de '+ids.length+' completadas para '+plan.date}
 ];
 return {items,cards,ready:items.every(x=>x.ok)};
}

// V29.0.74: lectura puntual del expediente, sin listeners por fila ni escrituras.
export async function readCommunicationEvidence(planId){
 if(!auth.currentUser)throw Error('Sesión no autenticada.');
 const plan=await getDoc(doc(db,'plannerAssignments',planId));
 if(!plan.exists())throw Error('La actividad ya no existe.');
 const [technical,consumptions]=await Promise.all([
  getDoc(doc(db,'journeyTechnical',planId)),
  getDocs(auth.currentUser && (await getDoc(doc(db,'users',auth.currentUser.uid))).data()?.role==='JEFE' ? query(collection(db,'journeyConsumptions'),where('planId','==',planId),limit(100)) : query(collection(db,'journeyConsumptions'),where('uid','==',auth.currentUser.uid),where('planId','==',planId),limit(100)))
 ]);
 return {planId,tech:technical.exists()?technical.data():null,consumptions:consumptions.docs.map(d=>({id:d.id,...d.data()}))};
}

// V29.0.75: conversación vinculada a la actividad, sin alterar sus evidencias.
export function watchCommunicationMessages(planId,cb,err){return onSnapshot(query(collection(db,'activityCommunications',planId,'messages'),orderBy('createdAt','desc'),limit(40)),snap=>cb(snap.docs.map(d=>({id:d.id,...d.data()}))),err)}
export function watchCommunicationStatus(planId,cb,err){return onSnapshot(doc(db,'activityCommunications',planId),snap=>cb(snap.exists()?snap.data():null),err)}
export async function sendCommunicationMessage(planId,body,displayName){
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Inicie sesión.');
 const message=String(body||'').trim();if(!message||message.length>1500)throw Error('Escriba un comentario de hasta 1500 caracteres.');
 const plan=await getDoc(doc(db,'plannerAssignments',planId));if(!plan.exists())throw Error('Actividad inexistente.');
 const ref=doc(collection(db,'activityCommunications',planId,'messages'));
 await setDoc(ref,{planId,body:message,authorId:uid,authorName:String(displayName||'Usuario').slice(0,100),createdAt:serverTimestamp()});
 await waitForPendingWrites(db);return ref.id;
}
// V29.0.245: las reglas requieren revision incremental (1 al crear).
export async function updateCommunicationStatus(planId,status){
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Inicie sesión.');
 if(!['ATENCION','SEGUIMIENTO','ATENDIDO'].includes(status))throw Error('Estado inválido.');
 const ref=doc(db,'activityCommunications',planId);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  const previous=snap.exists()?snap.data():null;
  const revision=previous?Number(previous.revision):0;
  if(previous&&(!Number.isInteger(revision)||revision<1))throw Error('Revisión del seguimiento inválida.');
  tx.set(ref,{status,updatedBy:uid,updatedAt:serverTimestamp(),revision:revision+1},{merge:true});
 });
}

// V29.0.79: una marca de lectura por usuario y expediente; sin duplicar mensajes.
export function watchCommunicationReads(uid,cb,err){return onSnapshot(collection(db,'communicationReads',uid,'plans'),snap=>cb(Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]))),err)}
export function watchCommunicationLastMessage(planId,cb,err){return onSnapshot(query(collection(db,'activityCommunications',planId,'messages'),orderBy('createdAt','desc'),limit(1)),snap=>cb(snap.docs.length?{id:snap.docs[0].id,...snap.docs[0].data()}:null),err)}
export async function markCommunicationRead(planId,messageId){const uid=auth.currentUser?.uid;if(!uid||!planId||!messageId)return;const ref=doc(db,'communicationReads',uid,'plans',planId);await setDoc(ref,{messageId,updatedAt:serverTimestamp()},{merge:true});await waitForPendingWrites(db)}

// V29.0.81: estado personal por expediente, sin modificar mensajes ni inventario.
export async function setCommunicationArchive(planId,archived){const uid=auth.currentUser?.uid;if(!uid)throw Error('Inicie sesión.');const ref=doc(db,'communicationReads',uid,'plans',planId);await setDoc(ref,{archived:!!archived,updatedAt:serverTimestamp()},{merge:true});await waitForPendingWrites(db)}
export async function markAssignmentSeen(planId,createdSeconds){const uid=auth.currentUser?.uid;if(!uid)throw Error('Inicie sesión.');const ref=doc(db,'communicationReads',uid,'plans',planId);await setDoc(ref,{assignmentSeen:createdSeconds,updatedAt:serverTimestamp()},{merge:true});await waitForPendingWrites(db)}

// V29.0.90: incidencias técnicas independientes del inventario y de los cierres.
export function watchTechnicalAlerts(planId,cb,err){return onSnapshot(query(collection(db,'activityTechnicalAlerts',planId,'items'),orderBy('createdAt','desc'),limit(30)),snap=>cb(snap.docs.map(d=>({id:d.id,...d.data()}))),err)}
export async function reportTechnicalAlert(planId,description,displayName){
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sesión no autenticada.');
 const body=String(description||'').trim();if(body.length<5||body.length>1200)throw Error('Describa la novedad entre 5 y 1200 caracteres.');
 const ref=doc(collection(db,'activityTechnicalAlerts',planId,'items'));
 await setDoc(ref,{planId,description:body,authorId:uid,authorName:String(displayName||'Analista').slice(0,100),severity:'INFORMATIVA',status:'ABIERTA',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:uid,revision:1,history:[{action:'REGISTRO',actorId:uid,at:new Date().toISOString(),detail:'Novedad registrada'}]});
 await waitForPendingWrites(db);return ref.id;
}
export async function reviewTechnicalAlert(planId,alertId,severity,status,comment){
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sesión no autenticada.');
 if(!['INFORMATIVA','REVISION','CRITICA'].includes(severity)||!['ABIERTA','EN_SEGUIMIENTO','RESUELTA'].includes(status))throw Error('Clasificación inválida.');
 const note=String(comment||'').trim();if(note.length<5||note.length>600)throw Error('Indique un motivo de 5 a 600 caracteres.');
 const ref=doc(db,'activityTechnicalAlerts',planId,'items',alertId);
 await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('La novedad ya no existe.');const old=snap.data();if((old.history||[]).length>=40)throw Error('Límite de historial alcanzado; exporte el expediente antes de continuar.');tx.update(ref,{severity,status,updatedAt:serverTimestamp(),updatedBy:uid,revision:Number(old.revision||0)+1,history:[...(old.history||[]),{action:'REVISION',actorId:uid,at:new Date().toISOString(),detail:note,severity,status}]})});
 await waitForPendingWrites(db);
}

// V29.0.100: lectura puntual del mes, sin listener persistente ni lecturas de otros meses.
export async function readMonthlyControlRecords(cardId,month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mes inválido');
 const start=month+'-01';const [y,m]=month.split('-').map(Number);
 const end=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
 const q=query(collection(db,'dailyControlRecords'),where('date','>=',start),where('date','<',end),limit(250));
 const snap=await getDocs(q);
 return snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.controlId===cardId).sort((a,b)=>a.date.localeCompare(b.date));
}

// V29.0.110: corrección de identificación con auditoría atómica.
export async function correctControlCardIdentity(card,changes,uid){
 if(auth.currentUser?.uid!==uid)throw Error('Sesión no válida.');
 const name=String(changes.name||'').trim(),code=String(changes.code||'').trim(),equipment=String(changes.equipment||'').trim(),reason=String(changes.reason||'').trim();
 if(!name||!code||!equipment||reason.length<8)throw Error('Complete la identificación y el motivo (mínimo 8 caracteres).');
 const ref=doc(db,'controlCards',card.id);
 await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('Carta no encontrada.');const old=snap.data(),revision=Number(old.identityRevision||0)+1;
 const before={name:old.name,code:old.code,equipment:old.equipment},after={name,code,equipment};
 const audit=doc(db,'controlCardIdentityHistory',card.id+'_'+revision);
 tx.update(ref,{...after,identityRevision:revision,identityUpdatedBy:uid,identityUpdatedAt:serverTimestamp(),identityReason:reason});
 tx.set(audit,{cardId:card.id,revision,before,after,reason,updatedBy:uid,updatedAt:serverTimestamp()});});
}
export async function readControlResponsibleNames(){
 const snap=await getDocs(collection(db,'users'));return snap.docs.map(d=>({uid:d.id,...d.data()}));
}
export async function saveManualControlHistory(card,date,values,responsible,source,notes){
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sesión no autenticada.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=new Date().toISOString().slice(0,10))throw Error('Seleccione una fecha histórica anterior a hoy.');
 if(!responsible?.uid||!responsible?.name)throw Error('Seleccione el responsable real del control.');
 if(!source||source.trim().length<3)throw Error('Identifique la hoja física de origen.');
 if(values.length!==3||values.some(v=>!Number.isFinite(v)||v<0||v>14))throw Error('Ingrese tres lecturas válidas entre 0 y 14.');
 const tolerance=Number(card.tolerance)||.1,conforms=values.every((v,i)=>Math.abs(v-[4,7,10][i])<=tolerance+1e-9);
 const ref=doc(db,'manualControlHistory',date+'_'+card.id);
 await runTransaction(db,async tx=>{const existing=await tx.get(ref);if(existing.exists())throw Error('Esta fecha ya tiene un histórico manual. No se sobrescribió.');
 const daily=await tx.get(doc(db,'dailyControlRecords',date+'_'+card.id));if(daily.exists())throw Error('Esta fecha ya tiene un registro diario confirmado.');
 tx.set(ref,{date,controlId:card.id,kind:'MULTIPUNTO',origin:'HISTORICO_MANUAL',status:conforms?'COMPLETADA':'NO_CONFORME',readings:values,nominals:[4,7,10],tolerance,conforms,responsibleUid:responsible.uid,responsibleName:responsible.name,source:source.trim(),observations:String(notes||'').slice(0,1000),digitizedBy:uid,digitizedAt:serverTimestamp()});});
}
export async function readManualControlHistory(cardId,month){
 const start=month+'-01',end=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),1)).toISOString().slice(0,10);
 const snap=await getDocs(query(collection(db,'manualControlHistory'),where('date','>=',start),where('date','<',end),limit(250)));
 return snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.controlId===cardId);
}

// PEC0404-05: control multipunto específico del conductímetro EI-104.
export async function completeConductivityControl(card,date,readings,uid,observations=''){
 if(!navigator.onLine)throw Error('Se requiere conexión a Firebase.');
 const nominal=[84,1413,12.88],values=readings.map(Number);
 if(readings.some(v=>String(v).trim()==='')||values.some(v=>!Number.isFinite(v)||v<0))throw Error('Ingrese las tres lecturas válidas.');
 const ref=doc(db,'dailyControlRecords',date+'_'+card.id),masterRef=doc(db,'controlCards',card.id);
 syncState.pending++;emit();try{
 await runTransaction(db,async tx=>{
 const [old,master]=await Promise.all([tx.get(ref),tx.get(masterRef)]);
 if(old.exists())throw Error('Ya existe un registro de esta carta para la fecha.');
 if(!master.exists()||master.data().status!=='ACTIVO'||master.data().kind!=='CONDUCTIVIDAD'||master.data().code!=='PEC0404-05')throw Error('Carta PEC0404-05 no disponible.');
 const tolerance=Number(master.data().tolerance);if(tolerance!==5)throw Error('El criterio de la carta debe ser ±5%.');
 const errors=values.map((v,i)=>v-nominal[i]),relativeErrors=errors.map((v,i)=>Math.abs(v/nominal[i]*100));
 const conforms=relativeErrors.every(v=>v<=5+1e-9);
 tx.set(ref,{date,controlId:card.id,kind:'CONDUCTIVIDAD',status:conforms?'COMPLETADA':'NO_CONFORME',readings:values,errors,relativeErrors,nominals:nominal,tolerance,conforms,observations:String(observations).slice(0,1500),completedBy:uid,completedAt:serverTimestamp()});
 });syncState.lastConfirmed=new Date();syncState.lastEvent='confirmed';emit();
 }finally{syncState.pending=Math.max(0,syncState.pending-1);emit();}
}
