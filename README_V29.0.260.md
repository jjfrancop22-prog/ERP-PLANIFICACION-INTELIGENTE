# SETED V29.0.260 — Estado mensual automático (visual)

- El Kardex muestra MES EN CURSO mientras el mes calendario sigue vigente.
- A partir del primer día del mes siguiente muestra PENDIENTE DE REVISIÓN Y CIERRE.
- El PDF reproduce el estado de período.
- No se ejecuta cierre definitivo ni bloqueo automático en Firebase: se requiere proceso de servidor confiable, conciliación y autorización de Calidad.
- No se modifican colecciones, reglas Firebase, consumos, cantidades ni documentos existentes.
- La clasificación de cierre se calcula en el cliente cuando se abre o cambia el período.
