import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInGeometry, validateGeometry } from './geo.mjs';
import { evaluate } from './eligibility.mjs';
import { createStore, loadDemo, clearDemo, snapshot } from './db.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const geom={type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[4,2],[4,4],[2,4],[2,2]]]};
const now=Date.parse('2026-11-01T15:00:00.000Z');
const dataset={
  zones:[{id:1,name:'Área Teste',geometry:geom}],plans:[{id:1,name:'Teste',active:1}],
  ctos:[{id:1,name:'CTO Alfa',zone_id:1,status:'online',ports_free:2,verified_at:new Date(now).toISOString()}],
  rules:[{zone_id:1,plan_id:1,decision:'allow'}]};
const q={lat:6,lon:6,planId:1,ctoId:1};
test('polígono contém ponto; buraco e exterior não contêm',()=>{
  assert.equal(pointInGeometry(6,6,geom),true);
  assert.equal(pointInGeometry(3,3,geom),false);
  assert.equal(pointInGeometry(18,6,geom),false);
  assert.equal(pointInGeometry(0,0,geom),true);
  assert.equal(pointInGeometry(6,6,{type:'MultiPolygon',coordinates:[geom.coordinates]}),true);
  assert.equal(validateGeometry(geom),true);
});
test('sem território, não autoriza',()=>assert.equal(evaluate({...q,lat:25},dataset,now).status,'BLOQUEADO'));
test('áreas sobrepostas exigem revisão',()=>assert.equal(evaluate(q,{...dataset,zones:[...dataset.zones,{...dataset.zones[0],id:2}]},now).status,'EM_ANALISE'));
test('sem regra explícita, não autoriza',()=>assert.equal(evaluate(q,{...dataset,rules:[]},now).status,'EM_ANALISE'));
test('regra negativa bloqueia',()=>assert.equal(evaluate(q,{...dataset,rules:[{zone_id:1,plan_id:1,decision:'deny'}]},now).status,'BLOQUEADO'));
test('CTO sem portas bloqueia',()=>assert.equal(evaluate(q,{...dataset,ctos:[{...dataset.ctos[0],ports_free:0}]},now).status,'BLOQUEADO'));
test('CTO de outro território bloqueia',()=>assert.equal(evaluate(q,{...dataset,ctos:[{...dataset.ctos[0],zone_id:2}]},now).status,'BLOQUEADO'));
test('CTO desatualizada exige revisão',()=>assert.equal(evaluate(q,{...dataset,ctos:[{...dataset.ctos[0],verified_at:new Date(now-90000000).toISOString()}]},now).status,'EM_ANALISE'));
test('CTO sem confirmação exige revisão',()=>assert.equal(evaluate(q,{...dataset,ctos:[{...dataset.ctos[0],verified_at:null}]},now).status,'EM_ANALISE'));
test('sem seleção de CTO exige revisão',()=>assert.equal(evaluate({...q,ctoId:null},dataset,now).status,'EM_ANALISE'));
test('plano ativo e CTO verificada permite apenas laboratório',()=>{
  const r=evaluate(q,dataset,now); assert.equal(r.status,'LIBERADO'); assert.equal(r.labOnly,true);
});
test('ponto do vendedor não substitui endereço de instalação',()=>{
  const withSeller={...q,sellerId:22,lat:25};
  assert.equal(evaluate(withSeller,dataset,now).status,'BLOQUEADO');
});
test('banco vazio, carregamento opt-in e limpeza demonstrativa',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'paplab-'));
  const db=createStore(path.join(dir,'test.sqlite'));
  try{
    assert.equal(snapshot(db).sellers.length,0);
    loadDemo(db);const d=snapshot(db);
    assert.equal(d.demo,true);assert.equal(d.sellers.length,3);assert.equal(d.zones.length,2);
    assert.throws(()=>loadDemo(db));
    clearDemo(db);
    assert.equal(snapshot(db).demo,false);assert.equal(snapshot(db).zones.length,0);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
