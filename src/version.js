// Versión visible y comprobación de despliegues. Sin escrituras a Firebase.
export const APP_VERSION = '29.0.292';
export const VERSION_URL = '/version.json';
let lastNotified = '';
export async function checkForAppUpdate({manual=false}={}) {
  if (import.meta.env.DEV) return false;
  try {
    const response = await fetch(`${VERSION_URL}?check=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error('No se pudo consultar la versión');
    const info = await response.json();
    const remote = String(info.version || '');
    if (!/^\d+\.\d+\.\d+$/.test(remote)) return false;
    const compare = (a,b) => {const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]-y[i]}return 0};
    if (compare(remote,APP_VERSION)<=0 || lastNotified===remote) return false;
    lastNotified=remote;
    const existing=document.getElementById('psi-version-update');
    if(existing)existing.remove();
    const box=document.createElement('aside');
    box.id='psi-version-update';
    box.setAttribute('role','status');
    box.style.cssText='position:fixed;z-index:99999;right:18px;bottom:18px;max-width:min(420px,calc(100vw - 36px));background:#fff;border:2px solid #1973a1;border-radius:16px;box-shadow:0 12px 38px #001a3440;padding:18px;font:15px system-ui,sans-serif;color:#17344d';
    box.innerHTML=`<strong style="display:block;font-size:18px">Nueva versión V${remote} disponible</strong><p style="margin:8px 0 14px">Está usando V${APP_VERSION}. Actualice cuando haya terminado de guardar sus datos. Los consumos y cierres pendientes deben confirmarse antes.</p><div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="psi-update-later" style="padding:10px;border-radius:9px;border:1px solid #b9ceda;background:white">Más tarde</button><button type="button" id="psi-update-now" style="padding:10px;border-radius:9px;border:0;background:#176a95;color:white;font-weight:700">Actualizar aplicación</button></div>`;
    document.body.appendChild(box);
    box.querySelector('#psi-update-later').onclick=()=>box.remove();
    box.querySelector('#psi-update-now').onclick=()=>window.location.reload();
    return true;
  } catch(e) {if(manual) console.warn('Comprobación de versión:',e.message);return false;}
}
export function startVersionChecks(){checkForAppUpdate();setInterval(()=>{if(!document.hidden)checkForAppUpdate()},5*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForAppUpdate()});}
