import test from 'node:test';
import assert from 'node:assert/strict';
import {validateVisit,filterVisits,metrics,csv} from './operations.js';
const data={sellers:[{id:1,active:true,team:'A',name:'DEMO 01'},{id:2,active:false,team:'B'}],visits:[{sellerId:1,date:'2026-11-02',stage:'Planejada',place:'Quadra A'},{sellerId:1,date:'2026-11-02',stage:'Venda',place:'Quadra B'},{sellerId:2,date:'2026-11-01',stage:'Visitada',place:'Quadra C'}]};
const valid={sellerId:'1',stage:'Planejada',date:'2026-11-02',place:'Local DEMO',lat:'-2.54',lon:'-44.30'};
test('visita recusa vendedor inativo, etapa desconhecida e coordenadas vazias',()=>{
 assert.throws(()=>validateVisit({...valid,sellerId:'2'},data));
 assert.throws(()=>validateVisit({...valid,stage:'Real'},data));
 assert.throws(()=>validateVisit({...valid,lat:''},data));
 assert.throws(()=>validateVisit({...valid,lon:'181'},data));
 assert.equal(validateVisit(valid,data).sellerId,1);
});
test('filtros combinam equipe, data, etapa e busca',()=>{
 assert.equal(filterVisits(data,{team:'A',date:'2026-11-02',stage:'Venda',search:'quadra b'}).length,1);
 assert.equal(filterVisits(data,{team:'B',date:'2026-11-02'}).length,0);
});
test('conversão exclui visitas planejadas do denominador e trata vazio',()=>{
 assert.deepEqual(metrics(data.visits),{total:3,done:2,sales:1,conversion:50});
 assert.equal(metrics([]).conversion,0);
});
test('CSV escapa aspas e neutraliza fórmulas em células',()=>{
 const result=csv([['=HYPERLINK("url")','texto; com separador','linha\nseguinte']]);
 assert.ok(result.includes('"\'=HYPERLINK(""url"")"'));
 assert.ok(result.includes('"texto; com separador"'));
});
