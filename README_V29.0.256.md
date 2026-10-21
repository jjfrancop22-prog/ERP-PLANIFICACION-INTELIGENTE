SETED V29.0.256
- Kardex por sustancia en ventana emergente con saldo inicial, ingresos por compra, egresos de pesajes y saldos acumulados.
- Excel compatible (.xls XML Spreadsheet) y PDF mediante ventana de impresión del navegador (Guardar como PDF).
- Nuevo selector 'Tipo de ingreso' en el formulario único del frasco. Para compras de octubre existentes, editar referencia, elegir Compra, fecha, factura y responsable.
- El ingreso de un frasco se deriva de su ficha y NO se duplica en setedMovements.
- Ajuste de reglas Firestore: campo entryType permitido en actualizaciones de setedBottles. Comparar antes de publicar.
- Nota: saldos anteriores a octubre no son soportados; apertura SETED 01/10/2026. La cantidad de ingreso proviene del saldo oficial de apertura del frasco.
- Revisar los datos y saldos antes de usar oficialmente; no se ha probado contra Firebase real.
