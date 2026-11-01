import { zonesAtPoint, coordValid } from './geo.mjs';
export const STATUSES = { allow:'LIBERADO', review:'EM_ANALISE', deny:'BLOQUEADO' };

export function evaluate({lat,lon,planId,ctoId,sellerId}, data, now = Date.now()) {
  if (!coordValid(lat,lon)) throw new Error('Latitude/longitude inválidas.');
  const result = { status:'EM_ANALISE', reasons:[], zoneId:null, planId:planId ?? null, ctoId:ctoId ?? null, sellerId:sellerId ?? null, labOnly:true };
  const plan = data.plans.find(p=>p.id===planId);
  const hits = zonesAtPoint(lat,lon,data.zones);
  if (!plan) return {...result,status:'BLOQUEADO',reasons:['Plano inexistente no catálogo local.']};
  if (!plan.active) return {...result,status:'BLOQUEADO',reasons:['Plano desativado no catálogo local.']};
  if (!hits.length) return {...result,status:'BLOQUEADO',reasons:['Endereço fora dos territórios cadastrados; cobertura não autorizada.']};
  if (hits.length > 1) return {...result,reasons:['Sobreposição de territórios: exige correção manual antes de autorizar.']};
  const zone=hits[0];result.zoneId=zone.id;
  const rule=data.rules.find(r=>r.zone_id===zone.id && r.plan_id===plan.id);
  if (!rule) return {...result,reasons:['Não existe regra explícita do plano neste território.']};
  if (rule.decision === 'deny') return {...result,status:'BLOQUEADO',reasons:['Plano bloqueado para este território.']};
  if (!ctoId) return {...result,reasons:['Selecione a CTO que atende ao endereço de instalação.']};
  const cto=data.ctos.find(c=>c.id===ctoId);
  if (!cto) return {...result,reasons:['CTO inexistente no cadastro local.']};
  if (cto.zone_id!==zone.id) return {...result,status:'BLOQUEADO',reasons:['CTO selecionada pertence a outro território.']};
  if (cto.status!=='online') return {...result,status:'BLOQUEADO',reasons:['CTO fora de operação.']};
  if (cto.ports_free<=0) return {...result,status:'BLOQUEADO',reasons:['CTO sem portas disponíveis.']};
  const checked=cto.verified_at ? Date.parse(cto.verified_at) : NaN;
  if (!Number.isFinite(checked) || checked>now+60000 || now-checked>24*60*60*1000) return {...result,reasons:['Capacidade da CTO sem confirmação recente (máximo 24 horas).']};
  return {...result,status:'LIBERADO',reasons:[`Regra permitida para ${zone.name}.`,`CTO ${cto.name} com ${cto.ports_free} porta(s) confirmada(s).`,'Apenas simulação local; não autoriza venda no ST1 Sales.']};
}
