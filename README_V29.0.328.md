# V29.0.328 — Núcleo compartido, correcciones de trazabilidad

- Se introduce `control-engine-policy.js` como política común para futuras cartas cuantitativas.
- Se corrige el mapeo de señales Westgard a puntos visibles: el índice acumulado no es el índice del mes.
- Se muestra la cantidad de señales de la secuencia acumulada separada de las señales visibles.
- Se elimina la exigencia arbitraria de 10 mediciones mensuales en el historial del EI-161.
- No se cambian reglas Firebase ni datos persistidos.

## Pendiente de integración (importante)
Esta versión NO convierte automáticamente todas las familias en análisis acumulativo.
Para cada adaptador hay que conectar la consulta histórica completa, configurar la
base estadística validada por nivel, y verificar las correcciones metrológicas.
Las cartas nuevas deberán invocar este motor; aún no existe un constructor universal
que obligue automáticamente a todos los módulos a hacerlo.
