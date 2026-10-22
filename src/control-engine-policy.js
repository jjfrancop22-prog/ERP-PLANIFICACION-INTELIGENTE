/** Política única para cartas cuantitativas presentes y futuras.
 * No equivale a validación ISO/IEC 17025 por sí sola.
 * Los adaptadores de cada familia deben proporcionar registros históricos completos. */
export const CONTROL_ENGINE_POLICY = Object.freeze({
  version: '1.0',
  history: 'chronological-across-months',
  calendarGaps: 'not-a-failure',
  monthlyMinimum: 0,
  referenceRequiredForFormalWestgard: true,
  technicalConformityFromFirstMeasurement: true,
  sameRunRequiredForR4s: true,
  deduplication: 'by-card-level-date-source-priority',
});
export function normalizeControlSeries(records,{valueKey='value',dateKey='date',endMonth=null}={}) {
  return (Array.isArray(records)?records:[])
    .filter(r=>r && r[dateKey] && (!endMonth || String(r[dateKey]).slice(0,7)<=endMonth))
    .map(r=>({...r,date:String(r[dateKey]),value:Number(r[valueKey])}))
    .filter(r=>Number.isFinite(r.value))
    .sort((a,b)=>a.date.localeCompare(b.date));
}
export function summarizeControlSeries(records,{low=NaN,high=NaN}={}) {
  const data=normalizeControlSeries(records);
  const conforming=data.filter(r=>(!Number.isFinite(low)||r.value>=low)&&(!Number.isFinite(high)||r.value<=high)).length;
  return {count:data.length,conforming,nonconforming:data.length-conforming};
}
