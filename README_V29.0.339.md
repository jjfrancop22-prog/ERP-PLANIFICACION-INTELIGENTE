# V29.0.339 — Centro de Comunicaciones

- El encabezado del chat utiliza APP_VERSION, evitando mostrar versiones antiguas.
- Se conserva el foco y la selección del campo activo cuando llegan eventos de Firebase y se reconstruye la interfaz.
- Se conserva el texto de búsqueda durante actualizaciones en vivo.
- Se limpian las cachés de estados de atención al cambiar de usuario para evitar contaminación entre sesiones.
- Se mantienen los listeners y permisos actuales, sin nuevas colecciones ni escrituras a Firebase.

**Pendiente de validación real:** comportamiento con dos cuentas simultáneas y estados de lectura/atención persistentes.
