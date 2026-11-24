import admin from 'firebase-admin';
import {randomBytes,pbkdf2Sync,timingSafeEqual,createHash,randomUUID} from 'node:crypto';
const res=(statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(data)});
const hash=(pin,salt)=>pbkdf2Sync(pin,salt,210000,32,'sha256').toString('hex');
function database(){if(!admin.apps.length){const secret=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');if(!secret||secret.project_id!=='sgc-psi')throw Error('Configure FIREBASE_SERVICE_ACCOUNT_JSON para sgc-psi');admin.initializeApp({credential:admin.credential.cert(secret)})}return admin.firestore()}
export async function handler(event){
 if(event.httpMethod!=='POST')return res(405,{error:'Método no permitido'});
 try{
 const db=database(),token=(event.headers.authorization||event.headers.Authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)return res(401,{error:'Sesión requerida'});
 const session=await admin.auth().verifyIdToken(token,true),profile=await db.doc(`users/${session.uid}`).get();if(!profile.exists||profile.data().active!==true||!['ADMIN','CALIDAD'].includes(profile.data().role))return res(403,{error:'Acceso no autorizado'});
 const data=JSON.parse(event.body||'{}'),{personId,action}=data;
 const confidentiality=data.documentCode==='PSI-MC0203';
 const documentCode=confidentiality?'PSI-MC0203':'PSI-MC0201';
 const documentVersion=confidentiality?'03':'06';
 if(action==='overview'){
  const snapshot=await db.collection('sgcSignatureRecords').where('documentCode','==',documentCode).limit(1000).get();
  const records=snapshot.docs.map(d=>({...d.data(),signedAt:d.data().signedAt?.toDate?.().toISOString()||null})).filter(r=>r.documentVersion===documentVersion&&r.accepted===true);
  return res(200,{ok:true,records});
 }
if(typeof personId!=='string'||!/^[\w-]{1,128}$/.test(personId))return res(400,{error:'Identificador inválido'});
 const person=await db.doc(`sgcPersonnel/${personId}`).get();if(!person.exists||person.data().active!==true)return res(404,{error:'Trabajador no activo'});
 if(action==='records'){
  const snapshot=await db.collection('sgcSignatureRecords').where('personId','==',personId).limit(100).get();
  const records=snapshot.docs.map(d=>({...d.data(),signedAt:d.data().signedAt?.toDate?.().toISOString()||null})).filter(r=>r.documentCode===documentCode&&r.documentVersion===documentVersion).sort((a,b)=>String(b.signedAt).localeCompare(String(a.signedAt)));
  return res(200,{ok:true,records});
 }
 const identity=String(data.identity||'').trim(),pin=String(data.pin||'').trim();if(!identity||identity!==String(person.data().identity||'').trim())return res(400,{error:'Cédula incorrecta'});
 if(!/^\d{4}$/.test(pin))return res(400,{error:'PIN de 4 números requerido'});
 const ref=db.doc(`sgcSignatureCredentials/${personId}`);
 if(action==='enroll'){
  const salt=randomBytes(24).toString('hex'),digest=hash(pin,salt);
  await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists)throw Error('Ya existe PIN configurado. Solicite restablecimiento supervisado.');tx.create(ref,{personId,salt,hash:digest,enabled:true,failed:0,lockedUntil:admin.firestore.Timestamp.fromMillis(0),createdAt:admin.firestore.FieldValue.serverTimestamp(),createdBy:session.uid})});
  return res(200,{ok:true,message:'PIN configurado correctamente'});
 }
 if(action!=='sign')return res(400,{error:'Acción desconocida'});
 const conflict=data.conflict,details=String(data.details||'').trim();if((!confidentiality&&(!['none','yes'].includes(conflict)||(conflict==='yes'&&(!details||details.length>2000)))||data.accepted!==true))return res(400,{error:'Complete la declaración y aceptación'});
 const docs=await db.collection('sgcLibrary').where('code','==',documentCode).limit(20).get();if(!docs.docs.some(d=>d.data().version===documentVersion&&d.data().approvalStatus==='APPROVED'&&d.data().fileStored===true))return res(409,{error:'Apruebe y archive '+documentCode+' V'+documentVersion+' en Biblioteca antes de firmar'});
 const existing=await db.collection('sgcSignatureRecords').where('personId','==',personId).limit(100).get();if(existing.docs.some(d=>d.data().documentCode===documentCode&&d.data().documentVersion===documentVersion))return res(409,{error:'Ya existe una aceptación de esta edición. Consulte el documento firmado en el expediente.'});
 const id=randomUUID(),recordRef=db.doc(`sgcSignatureRecords/${id}`),payload={recordId:id,personId,personName:person.data().name,identityLast4:identity.slice(-4),documentCode,documentVersion,requirementId:confidentiality?'4.2.4':'4.1.1',conflict:confidentiality?'':conflict,details:confidentiality?'':conflict==='yes'?details:'',accepted:true,method:'CEDULA_PIN_PRESENCIAL',facilitatorUid:session.uid};
 const sha256=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 let success=false;
 await db.runTransaction(async tx=>{const snap=await tx.get(ref),c=snap.data();if(!c?.enabled)throw Error('PIN no configurado');if(c.lockedUntil?.toMillis()>Date.now())throw Error('PIN bloqueado durante 15 minutos');const a=Buffer.from(hash(pin,c.salt),'hex'),b=Buffer.from(c.hash,'hex');if(a.length!==b.length||!timingSafeEqual(a,b)){const failed=(c.failed||0)+1;tx.update(ref,{failed:failed>=5?0:failed,lockedUntil:admin.firestore.Timestamp.fromMillis(failed>=5?Date.now()+900000:0)});return}tx.update(ref,{failed:0,lockedUntil:admin.firestore.Timestamp.fromMillis(0)});tx.create(recordRef,{...payload,sha256,signedAt:admin.firestore.FieldValue.serverTimestamp()});success=true});
 if(!success)return res(401,{error:'PIN incorrecto. Tras 5 intentos se bloquea 15 minutos.'});
 const saved=await recordRef.get();return res(200,{ok:true,record:{...payload,sha256,signedAt:saved.data().signedAt.toDate().toISOString()}});
 }catch(e){console.error('Firma:',e.message);return res(400,{error:e.message||'Error de firma'})}
}
