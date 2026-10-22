# V29.0.342 – Notificaciones y estados de comunicaciones

- Lecturas por usuario: se conserva `communicationReads/{uid}/plans/{planId}` y se visualiza la marca «Leído por mí».
- Avisos de mensajes: no se vuelven a contar ni mostrar como nuevos en expedientes atendidos.
- Estados persistentes: consulta puntual de hasta 80 expedientes recientes al abrir el Centro, refrescada como máximo cada 60 segundos; los estados ATENDIDO y SEGUIMIENTO se obtienen de Firestore y no solamente de la memoria del navegador.
- Se mantiene el aviso en vivo para mensajes y asignaciones recientes, sin nuevas suscripciones de estado permanentes.
- Filtro por analista y contador de búsqueda actualizados.

## Limitaciones y pruebas pendientes
- La confirmación de lectura es **personal**; las reglas actuales no permiten consultar lecturas de otros usuarios. No se anuncia «leído por el destinatario».
- Los estados globales se refrescan mediante lecturas puntuales, no en tiempo real para todas las actividades; el expediente abierto sí tiene escucha de estado.
- Validar con dos cuentas reales (JEFE y ANALISTA), comprobar reglas Firebase y medir consumo. No se ha realizado una prueba de extremo a extremo en producción.
- No se cambian reglas de Firestore ni operaciones de planificación, inventario o cierre.
