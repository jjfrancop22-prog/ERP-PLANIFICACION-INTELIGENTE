## V1.0.16 — Integración normativa de Lista Maestra

- Lista Maestra PG0201-06 trasladada desde el menú principal a ISO/IEC 17025 → 8.3.
- Pestañas dentro de 8.3: Documentos vinculados y Lista Maestra.
- El requisito 8.4 conserva la vinculación complementaria con PG0201, sin mostrar un segundo módulo.
- Se reutiliza el catálogo sgcLibrary y el exportador Excel existentes; no se modifican reglas Firestore.
- La consulta de biblioteca se activa en 8.3 bajo demanda y sigue limitada a 50 registros; no se debe considerar un inventario completo cuando existan más.

# PSI SGC NEXTGEN V1.0.11 — Biblioteca documental inteligente (Spark)

Base: V1.0.9. Biblioteca central `sgcLibrary`, documentos únicos por código, vínculos confirmables con numerales, consulta en tiempo real solo al abrir Biblioteca o requisito. No hay contadores globales ni Cloud Functions.

## IMPORTANTE: alcance de archivos
Firebase Spark no ofrece aquí un repositorio de archivos integrado. La selección de PDF/DOC/DOCX solo utiliza su nombre para sugerir vínculos; TXT/MD/CSV se leen **localmente** para sugerir vínculos y el contenido NO se sube. Se guarda en Firestore únicamente el catálogo y una URL institucional opcional al documento original. El sistema indica `Archivo original no almacenado` cuando no existe URL. No confundir registrar metadatos con subir el archivo. No hay reconocimiento semántico avanzado ni aprobación automática de conformidad.

## Instalación
`npm install` y `npm run dev`. Comprobar `npm run build` antes de publicar.

## Firebase
Publicar `firestore.rules` de esta versión: incorpora `sgcLibrary`. Mantener los índices previos. No se requieren índices compuestos nuevos para la consulta por `requirementIds` (índice automático array-contains).

## Pruebas
1. Entrar con ADMIN/CALIDAD; abrir Biblioteca documental.
2. Registrar código, título, versión, tipo y responsable. Verificar que el sistema sugiera vínculos por palabras clave.
3. Editar vínculos mediante «Vincular» y comprobar su aparición en el numeral relacionado en otro navegador.
4. Verificar que un código repetido sea rechazado.
5. Confirmar que no se almacena ningún PDF/DOCX en Firebase y que el enlace externo, si se especifica, abre el original.

Nota: El catálogo muestra hasta 50 documentos, los vínculos hasta 30; estos límites no son totales de base de datos. Se conserva el gestor documental por numeral existente, aún independiente de la nueva biblioteca, para evitar migraciones automáticas destructivas. La unificación y versiones se abordarán posteriormente.

## V1.0.12 — Tamaño de PDF
Tamaño recomendado: hasta 300 KiB (307200 bytes). Máximo permitido: 400 KiB (409600 bytes). Se ajustaron validación del navegador, etiquetas, reglas Firestore y límite de fragmentos (40). Los PDF se conservan sin alterar y se cargan bajo demanda. Publicar las reglas actualizadas antes de cargar archivos de más de 200 KiB.


## V1.0.14 — Corrección de flujo documental
- Si MC-02 ya existe, registrar con el mismo código adjunta la edición PDF sin duplicar el maestro.
- Consultar abre automáticamente la edición vigente cuando está disponible.
- La carga de PDF requiere usuario activo con rol ADMIN o CALIDAD y reglas publicadas de firestore.rules.
- Los PDF de hasta 400 KiB se guardan en fragmentos Base64; no se comprimen adicionalmente.
- Las ediciones parcialmente cargadas no se sobrescriben automáticamente: requieren recuperación administrativa.


## V1.0.17
El expediente PG0201 ofrece vista previa tabular del Excel generado por ERP, con exportación Excel desde el propio expediente, sin cargar PDF. Las versiones de plantilla siguen siendo metadatos controlados; no se inventa historial ni aprobación. El resto de documentos conserva el visor PDF.


V1.0.20: numeral 8.3 organizado en 8.3.1 y 8.3.2, tabla de decisiones y reautenticación por contraseña antes de aprobar. Publicar firestore.rules. Firma electrónica INTERNA, no firma digital certificada P12. Nunca subir certificados P12 al proyecto ni a Firebase.


## V1.1.52 · Nexo 8.3 → 5.7
En 5.7 > Gestionar difusión, el sistema consulta los documentos aprobados de Biblioteca y muestra una evaluación independiente por edición. Calidad decide si requiere difusión, registra motivo y, en caso afirmativo, prepara el acta PG0204. Para probar guardado debe publicar `firestore.rules` de esta versión. No se envían correos automáticamente. No se realizaron pruebas integradas contra Firebase real.
