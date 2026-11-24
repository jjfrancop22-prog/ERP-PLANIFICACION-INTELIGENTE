export const sections=[
 {id:'4',name:'Requisitos generales',items:[['4.1','Imparcialidad'],['4.2','Confidencialidad']]},
 {id:'5',name:'Requisitos relativos a la estructura',items:[['5','Estructura organizacional']]},
 {id:'6',name:'Requisitos relativos a los recursos',items:[['6.1','Generalidades'],['6.2','Personal'],['6.3','Instalaciones y condiciones ambientales'],['6.4','Equipamiento'],['6.5','Trazabilidad metrológica'],['6.6','Productos y servicios suministrados externamente']]},
 {id:'7',name:'Requisitos del proceso',items:[['7.1','Revisión de solicitudes, ofertas y contratos'],['7.2','Selección, verificación y validación de métodos'],['7.3','Muestreo'],['7.4','Manipulación de ítems de ensayo o calibración'],['7.5','Registros técnicos'],['7.6','Evaluación de incertidumbre de medición'],['7.7','Aseguramiento de la validez de los resultados'],['7.8','Informe de resultados'],['7.9','Quejas'],['7.10','Trabajo no conforme'],['7.11','Control de datos y gestión de la información']]},
 {id:'8',name:'Requisitos del sistema de gestión',items:[['8.1','Opciones'],['8.2','Documentación del sistema de gestión'],['8.3','Control de documentos del sistema de gestión'],['8.4','Control de registros'],['8.5','Acciones para abordar riesgos y oportunidades'],['8.6','Mejora'],['8.7','Acciones correctivas'],['8.8','Auditorías internas'],['8.9','Revisiones por la dirección']]}
];
export const requirements=sections.flatMap(s=>s.items.map(([id,name])=>({id,name,section:s.id})));
