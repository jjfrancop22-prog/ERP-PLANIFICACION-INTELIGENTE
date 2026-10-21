# V29.0.291 — Corrección de campos de ficha móvil QR

Se corrigieron exclusivamente las claves de lectura de la ficha móvil QR para que coincidan con los campos reales del formulario del expediente técnico y de Firestore:

- `certifiedUnit` (antes se consultaba incorrectamente `valueUnit`)
- `confidence` (antes `confidenceLevel`)
- `openedDate` (antes `openDate`)
- `storage` (antes `storageConditions`)

La advertencia de fechas también utiliza `openedDate`. No se alteraron escrituras, inventario, consumos, reglas Firebase ni el generador PDF.

Probar en localhost y después en el dominio de pruebas con un QR real.
