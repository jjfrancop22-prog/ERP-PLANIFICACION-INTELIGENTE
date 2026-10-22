# V29.0.330 — Acumulación física y digital para nitrógeno 105 °C

- La serie de análisis de la carta N105 EI-161 incluye históricos físicos hasta el mes seleccionado y registros digitales del mismo control.
- En fechas coincidentes, se prefiere el digital solo para el gráfico/análisis; no se borran registros.
- El gráfico sigue mostrando el mes seleccionado y Westgard utiliza la secuencia consolidada.
- Los controles de 105 °C y 150 °C siguen separados.
- La evaluación estadística permanece exploratoria sin base validada.
- **Precaución:** la consulta histórica recorre archivos físicos hasta el mes elegido y puede incrementar lecturas de Firestore; optimizar con índices/consultas por carta después de validar reglas e índices.
- No se ha probado con Firebase real ni se ha extendido esta corrección a todas las familias.
