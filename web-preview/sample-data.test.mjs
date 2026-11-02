import test from 'node:test';
import assert from 'node:assert/strict';
import { createSingleExampleData, EXAMPLE_VERSION } from './sample-data.js';
import { filterVisits, metrics } from './operations.js';

test('um único registro por entidade comercial, sem dados reais', () => {
  const data = createSingleExampleData('2026-11-02');
  assert.equal(data.version, EXAMPLE_VERSION);
  assert.equal(data.exampleOnly, true);
  for (const key of ['plans', 'sellers', 'zones', 'ctos', 'rules', 'visits', 'assignments']) {
    assert.equal(data[key].length, 1, `Esperado um único ${key}`);
    assert.equal(data[key][0].example, true);
  }
  assert.equal(data.sellers[0].routePoints.length, 5);
  assert.equal(data.sellers[0].position.source, 'EXEMPLO');
  assert.equal(data.sellers[0].position.fresh, false);
  assert.equal(data.plans[0].price, 123.45);
  assert.equal(data.itineraries['1:2026-11-02'].length, 1);
});

test('relacionamentos entre vendedor, visita, planejamento, CTO e plano', () => {
  const d = createSingleExampleData('2026-11-02');
  const seller = d.sellers[0], zone = d.zones[0], cto = d.ctos[0], plan = d.plans[0];
  assert.equal(d.visits[0].sellerId, seller.id);
  assert.equal(d.assignments[0].sellerId, seller.id);
  assert.equal(d.assignments[0].zoneId, zone.id);
  assert.equal(cto.zone_id, zone.id);
  assert.equal(d.rules[0].zone_id, zone.id);
  assert.equal(d.rules[0].plan_id, plan.id);
  assert.equal(filterVisits(d, {team: seller.team,date: '2026-11-02'}).length, 1);
  assert.deepEqual(metrics(d.visits), { total: 1,done: 1,sales: 1,conversion: 100 });
});

test('geometria ilustrativa contém os pontos do exemplo', () => {
  const d = createSingleExampleData();
  const ring = d.zones[0].geometry.coordinates[0];
  const xs = ring.map(x => x[0]), ys = ring.map(x => x[1]);
  const all = [...d.sellers[0].routePoints, d.ctos[0], d.visits[0]];
  for (const p of all) {
    assert.ok(p.lon > Math.min(...xs) && p.lon < Math.max(...xs));
    assert.ok(p.lat > Math.min(...ys) && p.lat < Math.max(...ys));
  }
});
