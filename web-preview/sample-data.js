// Cenário único, deliberadamente fictício. Nunca consumir como fonte do ST1 Sales.
export const EXAMPLE_VERSION = 5;

export function createSingleExampleData(date = '2026-11-02') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Data inválida para o cenário ilustrativo.');
  const at = time => `${date}T${time}:00-03:00`;
  const routePoints = [
    { lat: -2.5455, lon: -44.3140, at: at('09:00'), source: 'EXEMPLO', accuracy: 25 },
    { lat: -2.5420, lon: -44.3108, at: at('09:12'), source: 'EXEMPLO', accuracy: 25 },
    { lat: -2.5390, lon: -44.3074, at: at('09:24'), source: 'EXEMPLO', accuracy: 25 },
    { lat: -2.5372, lon: -44.3039, at: at('09:36'), source: 'EXEMPLO', accuracy: 25 },
    { lat: -2.5348, lon: -44.3005, at: at('09:48'), source: 'EXEMPLO', accuracy: 25 }
  ];
  return {
    version: EXAMPLE_VERSION,
    exampleOnly: true,
    plans: [{
      id: 1, name: 'EXEMPLO • Plano Ilustrativo', segment: 'Residencial',
      speed: '600 Mb ilustrativos', price: 123.45, active: true, example: true
    }],
    sellers: [{
      id: 1, name: 'Vendedor Exemplo 01', team: 'Equipe PAP Exemplo',
      active: true, example: true,
      position: { ...routePoints[4], updatedAt: at('09:48'), fresh: false },
      routePoints
    }],
    zones: [{
      id: 1, name: 'Território Exemplo 01', category: 'A', audience: 'A',
      color: '#3b82f6', example: true,
      geometry: { type: 'Polygon', coordinates: [[
        [-44.323, -2.552], [-44.293, -2.552],
        [-44.293, -2.524], [-44.323, -2.524],
        [-44.323, -2.552]
      ]] }
    }],
    ctos: [{
      id: 1, name: 'CTO Exemplo 01', zone_id: 1,
      lat: -2.5379, lon: -44.3048, ports_free: 6,
      status: 'online', verified_at: null, example: true
    }],
    rules: [{ zone_id: 1, plan_id: 1, decision: 'allow', example: true }],
    visits: [{
      id: 1, sellerId: 1, date, at: '09:24', stage: 'Venda',
      place: 'Ponto Exemplo 01', notes: 'Registro fictício para revisar o funil e os relatórios.',
      lat: -2.5390, lon: -44.3074, example: true
    }],
    assignments: [{
      id: 1, sellerId: 1, zoneId: 1, target: 8,
      date, status: 'Planejada', example: true
    }],
    itineraries: { [`1:${date}`]: [1] },
    activity: [{
      at: at('08:30'), message: 'Cenário fictício carregado para conferência visual.'
    }]
  };
}
