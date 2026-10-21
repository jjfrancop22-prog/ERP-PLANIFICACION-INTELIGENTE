V29.0.257 — SETED recepción
- Responsable de recepción: selector de perfiles activos ANALISTA/JEFE desde users.
- Se guarda nombre e identificador de usuario, sin escribir en inventario.
- firestore.rules incluye entryResponsibleId y lot para edición de referencia.
- IMPORTANTE: revisar y publicar SOLO el bloque setedBottles de firestore.rules; no reemplazar reglas generales sin comparar.
- Requiere probar con Firebase real.
