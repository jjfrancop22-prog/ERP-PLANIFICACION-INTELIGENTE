# V29.0.325 — Secuencia acumulativa entre meses (EI-154)

- En el digestor NTK EI-154, el análisis exploratorio considera mediciones anteriores hasta el fin del mes seleccionado, sin reiniciar secuencias al cambiar de mes.
- La gráfica, la conformidad técnica y las señales enumeradas siguen limitadas al mes seleccionado.
- Los registros digitales tienen prioridad visual frente a históricos físicos en fechas coincidentes.
- No exige diez registros por mes. La media y desviación exploratorias no son una referencia aprobada.
- Las consultas de lectura históricas pueden consumir lecturas de Firestore; verificar rendimiento y reglas de acceso en producción.
- Sin cambios en escrituras, reglas ni datos de Firebase.
- Esta versión aplica la acumulación entre meses a EI-154. No afirmar que otras familias ya estén migradas.
