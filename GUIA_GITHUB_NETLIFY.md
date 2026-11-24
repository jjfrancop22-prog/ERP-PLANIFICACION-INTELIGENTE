# PSI SGC NEXTGEN V1.1.00 — GitHub / Netlify

Subir el contenido de esta carpeta a la raíz del repositorio (no subir el ZIP como un archivo).

Configuración de compilación en Netlify:
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node.js recomendado: 22

La regla `public/_redirects` se copia a `dist/_redirects` durante la compilación y habilita rutas SPA en producción. No se agrega redirección global a `netlify.toml` para evitar el error local anterior.

Variables privadas en Netlify: `FIREBASE_SERVICE_ACCOUNT_JSON` con el JSON completo de la cuenta de servicio del proyecto `sgc-psi`. Nunca subirla a GitHub. Las variables públicas de Vite/Firebase deben mantenerse conforme a la configuración del proyecto.

Después de desplegar: publicar `firestore.rules` en Firebase, abrir el ERP y comprobar el flujo de registro QR, autorización, ingreso, salida y firma interna.

AVISO: No se ejecutó una compilación completa en este entorno porque no hay caché local de npm y la instalación offline no está disponible. El funcionamiento debe verificarse en Netlify.
