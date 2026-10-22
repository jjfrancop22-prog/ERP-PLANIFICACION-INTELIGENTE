# V29.0.294 — corrección focalizada

- Reactivos y Materiales: búsqueda con espera de 220 ms y restauración de la posición del cursor, evitando reconstruir el campo en cada pulsación.
- Gestión inteligente: se muestra el botón «＋ Cargar histórico» en la barra principal para cartas multipunto pH (rol JEFE). Abre el cargador existente de hojas físicas, sin modificar su escritura ni cálculos.
- Análisis mensual: se difiere la primera lectura del módulo pH hasta haber asignado la carta y el mes seleccionados. Evita que una consulta inicial de octubre sobrescriba la vista solicitada de septiembre.
- Se ocultan los filtros secundarios de la carta embebida para evitar dos selectores de mes.

**Alcance:** la carga histórica masiva sigue limitada a cartas multipunto pH. No se han cambiado reglas de Firebase ni el inventario. Probar en localhost antes de producción. No se realizó prueba de Firebase real.
