// Pure domain helpers shared by the browser and regression tests.
export const STAGES = ['Planejada', 'Visitada', 'Proposta', 'Venda', 'Sem interesse'];
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function validateVisit(fields, data) {
  const sellerId = Number(fields.sellerId), lat = Number(fields.lat), lon = Number(fields.lon);
  if (!data.sellers.some(s => s.id === sellerId && s.active)) throw Error('Selecione um vendedor ativo.');
  if (!STAGES.includes(fields.stage)) throw Error('Etapa inválida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date || '') || Number.isNaN(Date.parse(fields.date))) throw Error('Informe a data.');
  if (!String(fields.place || '').trim()) throw Error('Informe o local da visita.');
  if (fields.lat === '' || fields.lon === '' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>85 || Math.abs(lon)>180) throw Error('Informe coordenadas válidas.');
  return {sellerId, lat, lon, date:fields.date, stage:fields.stage, place:String(fields.place).trim().slice(0,100), notes:String(fields.notes || '').trim().slice(0,500), at:fields.at || '09:00'};
}
export function filterVisits(data, filters = {}) {
  return data.visits.filter(v => (!filters.team || filters.team==='all' || data.sellers.find(s=>s.id===v.sellerId)?.team===filters.team) && (!filters.date || v.date===filters.date) && (!filters.stage || filters.stage==='all' || v.stage===filters.stage) && (!filters.search || `${v.place} ${v.notes} ${data.sellers.find(s=>s.id===v.sellerId)?.name}`.toLocaleLowerCase('pt-BR').includes(filters.search.toLocaleLowerCase('pt-BR'))));
}
export function metrics(visits) {
  const done=visits.filter(v=>v.stage!=='Planejada').length;
  const sales=visits.filter(v=>v.stage==='Venda').length;
  return {total:visits.length,done,sales,conversion:done ? sales/done*100 : 0};
}
export function csv(rows) {
  return '\ufeff'+rows.map(row=>row.map(value=>{
    let text=String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }).join(';')).join('\r\n');
}
