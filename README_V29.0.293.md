V29.0.293 — Histórico multipunto y búsqueda fluida

- La carga de hojas físicas ya existía para cartas MULTIPUNTO; ahora permite completar varias fechas y pulsar una sola vez «Finalizar y sincronizar histórico».
- Valida todas las filas seleccionadas antes de empezar. Excluye filas vacías y fechas ya registradas.
- Cada fecha se confirma por transacción individual en Firebase; NO es una operación atómica de todo el mes. Si falla una fecha, las anteriores confirmadas permanecen guardadas y las fallidas pueden reintentarse.
- No modifica los cálculos del control multipunto ni los registros diarios.
- Evita reconstruir toda la pantalla mientras se escribe en los buscadores de Alertas Técnicas y Materiales de Referencia.
- La carga histórica de otras familias de cartas requiere integración con sus modelos específicos; no se ha habilitado un guardado genérico que pueda producir cálculos incorrectos.
- Pendiente: prueba funcional con Firebase y compilación en el equipo del usuario.
