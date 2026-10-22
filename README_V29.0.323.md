# V29.0.323 — Integración de gráficas térmicas

Se reemplazaron los trazadores SVG independientes de seis familias (baño María EI-364, DQO EI-360, mufla EI-328, estufa EI-316, termorreactor 105 °C y digestor HACH EI-161) por el componente visualChart ya usado por pH, conductividad, balanza y otras familias. Se conservan los valores corregidos y sus lecturas originales para el tooltip.

El componente muestra fechas, límites técnicos, media, señalización de conformidad y cribado Westgard exploratorio. No se cambian documentos ni reglas Firebase. No se declara control estadístico aprobado sin referencia validada.

**Alcance:** estas seis familias adicionales. No se ha demostrado cobertura de las 21 cartas; las restantes requieren auditoría de rutas y casos con múltiples niveles. Probar localmente antes de producción.
