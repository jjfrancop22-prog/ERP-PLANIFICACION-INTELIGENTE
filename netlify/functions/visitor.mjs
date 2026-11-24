import admin from 'firebase-admin';
import {randomUUID} from 'node:crypto';
const reply=(statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
function db(){if(!admin.apps.length){const secret=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');if(!secret||secret.project_id!=='sgc-psi')throw Error('Credencial del servicio sgc-psi no configurada');admin.initializeApp({credential:admin.credential.cert(secret)})}return admin.firestore()}
const clean=(v,max)=>String(v||'').trim().slice(0,max);
export async function handler(event){if(event.httpMethod!=='POST')return reply(405,{error:'Método no permitido'});try{
if((event.body||'').length>10000)return reply(413,{error:'Solicitud demasiado grande'});
const data=JSON.parse(event.body||'{}');if(data.website)return reply(200,{ok:true});
const name=clean(data.name,160),identity=clean(data.identity,32),company=clean(data.company,160),reason=clean(data.reason,300),area=clean(data.area,100),visitType=clean(data.visitType,50);
if(name.length<5||identity.length<5||company.length<2||reason.length<4||!area||!visitType||data.accepted!==true||data.documentVersion!=='01')return reply(400,{error:'Complete todos los campos y acepte el compromiso MC1603 V01.'});
if(!/^[A-Za-z0-9-]{5,32}$/.test(identity))return reply(400,{error:'Identificación inválida'});
const privacyNoticeVersion=clean(data.privacyNoticeVersion,40),privacyPolicyDate=clean(data.privacyPolicyDate,20),privacyPolicyReference=clean(data.privacyPolicyReference,90);
const ref=db().collection('sgcExternalVisits').doc(randomUUID());await ref.create({name,identity,company,reason,area,visitType,requirementId:'4.2.4',documentCode:'PSI-MC1603',documentVersion:'01',accepted:true,privacyNoticeVersion:privacyNoticeVersion||'NO_REGISTRADO',privacyPolicyDate:privacyPolicyDate||'NO_REGISTRADO',privacyPolicyReference:privacyPolicyReference||'NO_REGISTRADO',privacyNoticePresentedAt:admin.firestore.FieldValue.serverTimestamp(),acceptanceMethod:'CASILLA_IDENTIFICACION',acceptedAt:admin.firestore.FieldValue.serverTimestamp(),status:'PENDIENTE',responsibleId:'',responsibleName:'',createdAt:admin.firestore.FieldValue.serverTimestamp(),authorizedAt:null,enteredAt:null,exitedAt:null,reviewedBy:'',note:'',source:'QR_PUBLICO'});
return reply(200,{ok:true,reference:ref.id.slice(0,8).toUpperCase()});
}catch(e){console.error('Visitas:',e.message);return reply(500,{error:'No se pudo registrar la visita. Contacte recepción.'})}}
