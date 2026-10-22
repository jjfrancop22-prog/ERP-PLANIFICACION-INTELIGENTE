# V29.0.327 — motor compartido y acumulación EI-161

- EI-161 ahora utiliza el mismo `visualChart` y `evaluateWestgard` que EI-154, con secuencia histórica acumulativa entre meses y gráfico del mes seleccionado.
- Lectura acumulada de documentos digitales e históricos, con prioridad visual del registro digital por fecha; no modifica Firebase.
- Se muestra contador de registros acumulados y error explícito cuando falla la consulta (no se declara ausencia de señales).
- Se retira el requisito arbitrario de diez mediciones mensuales en los formularios especializados modificados.
- Las cartas futuras que invoquen `visualChart` heredan los indicadores, límites, fechas y reglas comunes; para acumular entre meses deben suministrar `analysisRows` con datos históricos consolidados.
- Las demás cartas aún requieren auditoría de integración de secuencias acumuladas. No se declara cumplimiento ISO/IEC 17025 automáticamente.
- La reconstrucción de correcciones antiguas sin evidencia histórica requiere revisión metrológica.
