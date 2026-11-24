// Índice de navegación y referencias (resúmenes propios; no reproduce el texto de la norma).
import {sections} from './data';
const counts={'4.1':5,'4.2':4,'5':7,'6.1':1,'6.2':6,'6.3':5,'6.4':13,'6.5':3,'6.6':3,'7.1':8,'7.2':2,'7.3':3,'7.4':4,'7.5':2,'7.6':3,'7.7':3,'7.8':8,'7.9':7,'7.10':3,'7.11':6,'8.1':3,'8.2':5,'8.3':2,'8.4':2,'8.5':3,'8.6':2,'8.7':3,'8.8':3,'8.9':3};
const labels={
'4.1.1':'Actividades imparciales','4.1.2':'Compromiso de la dirección','4.1.3':'Responsabilidad y presiones','4.1.4':'Identificación continua de riesgos','4.1.5':'Tratamiento de riesgos',
'4.2.1':'Responsabilidad y compromisos de confidencialidad','4.2.2':'Divulgación requerida','4.2.3':'Información de fuentes externas','4.2.4':'Obligaciones del personal',
'8.2.1':'Políticas y objetivos establecidos','8.2.2':'Contenido y orientación de las políticas','8.2.3':'Compromiso de la dirección con el sistema','8.2.4':'Acceso a la documentación','8.2.5':'Implementación de políticas y procedimientos',
'8.3.1':'Control de documentación','8.3.2':'Controles de los documentos','8.9.1':'Revisión del sistema de gestión','8.9.2':'Entradas para la revisión','8.9.3':'Resultados de la revisión',
'7.2.1':'Selección y verificación de métodos','7.2.2':'Validación de métodos','7.8.1':'Generalidades de informes','7.8.2':'Requisitos comunes de informes','7.8.3':'Informes de ensayo','7.8.4':'Certificados de calibración','7.8.5':'Declaraciones de muestreo','7.8.6':'Declaraciones de conformidad','7.8.7':'Opiniones e interpretaciones','7.8.8':'Modificaciones de informes'
};
const children=(id)=>{const n=counts[id]||0;const base=Array.from({length:n},(_,i)=>{const sub=`${id}.${i+1}`;return {id:sub,name:labels[sub]||`Apartado ${sub} · consultar norma oficial`};});if(id==='8.3')base.push(...['a','b','c','d','e','f'].map((letter,i)=>({id:`8.3.2.${letter}`,name:['Revisión y aprobación','Revisión y actualización','Identificación de cambios','Disponibilidad de versiones','Identificación de documentos','Prevención del uso de obsoletos'][i]})));return base;};
export const isoCatalog=sections.map(s=>({id:s.id,name:s.name,groups:s.items.map(([id,name])=>({id,name,children:children(id)}))}));
export function parentLinks(ids){const out=new Set(ids);for(const id of ids){for(const section of isoCatalog){for(const group of section.groups){if(id.startsWith(group.id+'.'))out.add(group.id);}}}return [...out];}
export function isGeneratedParent(id,ids){return isoCatalog.some(s=>s.groups.some(g=>g.id===id&&ids.some(x=>x.startsWith(id+'.'))));}
