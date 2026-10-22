# V29.0.321 — Estado universal de las cartas

El componente `visualChart` muestra una insignia de estado en todas sus instancias, incluidos pH, conductividad y familias conectadas.

- Amarillo: señal Westgard exploratoria o advertencia con referencia aprobada.
- Rojo: incumplimiento de límites técnicos o señal de rechazo con referencia estadística aprobada.
- Azul: sin señales exploratorias; no implica estabilidad estadística.
- Verde: sin señales con referencia aprobada.

La clasificación se calcula en cada renderizado, sin escrituras ni modificaciones de Firebase. Las familias que aún no utilizan `visualChart` requieren migración específica para recibir este indicador.
