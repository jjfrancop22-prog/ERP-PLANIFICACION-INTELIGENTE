V29.0.259 · SETED
- Corrección de fecha de consumo desde el Kardex, sin alterar el registro de pesaje ni descontar inventario.
- Reautenticación Firebase del usuario JEFE y motivo obligatorio; historial de cambios en setedCorrections.
- Kardex mensual usa fecha corregida en orden cronológico y saldos.
- PDF imprimible con identificación documental y espacios de elaboración, revisión de Calidad y cierre mensual. Estado PRELIMINAR, sin firma electrónica ni cierre aprobado automático.
- REQUIERE desplegar el bloque setedCorrections de firestore.rules; no sustituir reglas de producción sin comparación.
- No se ha validado conexión real Firebase ni compilación Vite. Probar en localhost antes de publicar.
- Base usada: V29.0.258 disponible; el archivo V29.0.220 adjuntado es anterior y no se usó para evitar regresiones.
