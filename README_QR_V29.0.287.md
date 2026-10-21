# V29.0.287 · QR por frasco

Se agregó **Ver QR** a Materiales de Referencia. Reutiliza `reagents/{id}` y `referenceDossiers/INV_{id}` sin escrituras adicionales. El QR contiene el enlace `?psiRef=<id>` de la instalación actual. El usuario debe iniciar sesión y tener rol JEFE para acceder al módulo, conforme a permisos existentes. La ficha consulta el estado disponible al cargar la app y se actualiza con la sincronización existente.

**Importante:** Para usar los QR impresos, el enlace debe generarse desde el dominio publicado definitivo, no desde localhost. No es un portal público. La etiqueta PNG contiene nombre, código, lote y QR, no la existencia. No se cambiaron reglas Firestore.

Prueba: `npm install && npm run dev`; verificar que se abre el módulo, generar QR, descargar PNG, escanear desde otro dispositivo autorizado, consultar COA y verificar stock tras sincronización.
