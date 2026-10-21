import {db,auth} from './firebase.js';
import {doc,getDoc} from 'firebase/firestore';

// Presentación común: el guardado siempre debe completarse antes de invocar esta función.
export async function controlResponsibleName(){
 const user=auth.currentUser;
 if(!user)throw Error('Sesión no disponible. Vuelva a iniciar sesión.');
 try{
  const snap=await getDoc(doc(db,'users',user.uid));
  if(snap.exists()){
   const p=snap.data();
   const name=[p.name,p.fullName,p.displayName,p.nombre,p.analystName].find(x=>typeof x==='string'&&x.trim());
   if(name)return name.trim().slice(0,200);
  }
 }catch(e){console.warn('No se pudo consultar el nombre del perfil:',e.code||e.message)}
 return (user.displayName||user.email||'Usuario autenticado').slice(0,200);
}
export function controlSaved({modal,conforms=true,status}={}){
 const message=status==='REVISION_METROLOGICA'?'Registro confirmado en Firebase · Revisión metrológica pendiente.':conforms?'Registro conforme confirmado en Firebase.':'Registro no conforme confirmado en Firebase.';
 window.dispatchEvent(new CustomEvent('psi-control-saved',{detail:{status:status||(conforms?'COMPLETADA':'NO_CONFORME')}}));
 window.dispatchEvent(new Event('psi-environmental-changed'));
 window.dispatchEvent(new Event('psi-control-records-changed'));
 window.dispatchEvent(new Event('focus'));
 if(modal?.isConnected)modal.remove();
 // Mensaje posterior a la confirmación, sin mantener abierto el formulario.
 const note=document.createElement('div');note.setAttribute('role','status');note.className='psi-control-save-toast';note.textContent='✓ '+message;
 document.body.append(note);setTimeout(()=>note.remove(),4200);
}
