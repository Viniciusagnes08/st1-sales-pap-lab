import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStore, run } from './db.mjs';
import {
  ensureMobileSchema,issuePairing,redeemPairing,authenticate, revokeToken,cancelPairing,
  startShift,stopShift,submitPosition,attachMobilePositions,recordVisit,getTeam,listVisits,pruneMobileData,listMobileAccess
} from './mobile-db.mjs';
import { handleMobileApi } from './mobile-api.mjs';

function fixture(){
 const db=createStore(':memory:');ensureMobileSchema(db);
 const a=Number(run(db,"INSERT INTO sellers(name,team,demo) VALUES('Vendedor A','Equipe Azul',0)").lastInsertRowid);
 const b=Number(run(db,"INSERT INTO sellers(name,team,demo) VALUES('Vendedor B','Equipe Azul',0)").lastInsertRowid);
 const c=Number(run(db,"INSERT INTO sellers(name,team,demo) VALUES('Vendedor C','Equipe Leste',0)").lastInsertRowid);
 return {db,a,b,c};
}
const ms=Date.parse('2026-11-01T17:00:00.000Z');

 test('pareamento é individual, expira e só pode ser utilizado uma vez',()=>{
  const {db,a}=fixture();
  const p=issuePairing(db,a,'seller',ms);
  assert.match(p.code,/^[A-F0-9]{16}$/);
  const s=redeemPairing(db,p.code,ms+100);
  assert.equal(authenticate(db,s.token,ms+101).sellerId,a);
  assert.throws(()=>redeemPairing(db,p.code,ms+102),{status:401});
  const past=issuePairing(db,a,'seller',ms);
  assert.throws(()=>redeemPairing(db,past.code,ms+600001),{status:401});
  db.close();
});

test('novo pareamento substitui o aparelho anterior e encerra jornada anterior',()=>{
  const {db,a}=fixture();const t1=redeemPairing(db,issuePairing(db,a,'seller',ms).code,ms);
  startShift(db,a,ms);
  const t2=redeemPairing(db,issuePairing(db,a,'supervisor',ms+100).code,ms+110);
  assert.throws(()=>authenticate(db,t1.token,ms+111),{status:401});
  assert.equal(authenticate(db,t2.token,ms+111).role,'supervisor');
  assert.equal(attachMobilePositions(db,[{id:a}],ms+111)[0].onShift,false);
  db.close();
});

test('credencial revogada não acessa mais o servidor',()=>{
  const {db,a}=fixture();const s=redeemPairing(db,issuePairing(db,a,'seller',ms).code,ms);startShift(db,a,ms);
  const tokenId=listMobileAccess(db).tokens[0].id;
  revokeToken(db,tokenId,ms+100);
  assert.equal(attachMobilePositions(db,[{id:a}],ms+101)[0].onShift,false);
  assert.throws(()=>authenticate(db,s.token,ms+101),{status:401});db.close();
});

test('código cancelado não pareia; vendedores fictícios não podem receber códigos',()=>{
  const {db,a}=fixture();const p=issuePairing(db,a,'supervisor',ms);cancelPairing(db,p.id,ms+10);
  assert.throws(()=>redeemPairing(db,p.code,ms+30),{status:401});
  const demo=Number(run(db,"INSERT INTO sellers(name,team,demo) VALUES('TESTE','Equipe Azul',1)").lastInsertRowid);
  assert.throws(()=>issuePairing(db,demo,'seller',ms),{status:400});db.close();
});

test('jornada controla GPS, exige precisão e timestamps válidos',()=>{
  const {db,a}=fixture();
  const input={lat:-2.537,lon:-44.299,accuracy:12,recordedAt:new Date(ms).toISOString()};
  assert.throws(()=>submitPosition(db,a,input,ms),{status:409});
  startShift(db,a,ms);
  assert.throws(()=>submitPosition(db,a,{...input,lat:null},ms),{status:400});
  assert.throws(()=>submitPosition(db,a,{...input,accuracy:null},ms),{status:400});
  const first=submitPosition(db,a,input,ms);
  assert.equal(first.accepted,true);
  assert.throws(()=>submitPosition(db,a,input,ms+100),{status:409});
  assert.throws(()=>submitPosition(db,a,{...input,recordedAt:new Date(ms+1000).toISOString()},ms+1000),{status:429});
  assert.throws(()=>submitPosition(db,a,{...input,accuracy:-5,recordedAt:new Date(ms+8500).toISOString()},ms+8500),{status:400});
  assert.throws(()=>submitPosition(db,a,{...input,recordedAt:new Date(ms-10*60_000).toISOString()},ms+8500),{status:400});
  const staff=attachMobilePositions(db,[{id:a,position:null}],ms+30000);
  assert.equal(staff[0].position.source,'APP PAP');assert.equal(staff[0].position.fresh,true);
  stopShift(db,a,ms+40000);
  assert.equal(attachMobilePositions(db,[{id:a,position:null}],ms+41000)[0].position.fresh,false);
  assert.throws(()=>submitPosition(db,a,{...input,recordedAt:new Date(ms+42000).toISOString()},ms+42000),{status:409});db.close();
});

test('supervisor só recebe sua equipe; vendedor não recebe mapa da equipe',()=>{
  const {db,a,b,c}=fixture();startShift(db,a,ms);
  submitPosition(db,a,{lat:-2.537,lon:-44.299,accuracy:12,recordedAt:new Date(ms).toISOString()},ms);
  const leader={sellerId:b,name:'Supervisor',role:'supervisor',team:'Equipe Azul'};
  const team=getTeam(db,leader,ms+1000);
  assert.equal(team.length,2);assert.equal(team.some(s=>s.id===c),false);
  assert.equal(team.find(s=>s.id===a).position.source,'APP PAP');
  assert.throws(()=>getTeam(db,{sellerId:a,role:'seller',team:'Equipe Azul'},ms+1000),{status:403});db.close();
});

test('visitas atribuídas ao autor e isoladas por equipe; dados expiram',()=>{
  const {db,a,b,c}=fixture();startShift(db,a,ms);
  recordVisit(db,{sellerId:a,role:'seller',team:'Equipe Azul'}, {stage:'visita',lat:-2.53,lon:-44.3},ms);
  const seller={sellerId:a,role:'seller',team:'Equipe Azul'};
  assert.equal(listVisits(db,seller).length,1);
  assert.equal(listVisits(db,{sellerId:b,role:'supervisor',team:'Equipe Azul'}).length,1);
  assert.equal(listVisits(db,{sellerId:c,role:'supervisor',team:'Equipe Leste'}).length,0);
  pruneMobileData(db,ms+8*24*60*60_000);
  assert.equal(listVisits(db,seller).length,0);db.close();
});

test('API móvel jamais publica rotas administrativas e exige autenticação',async()=>{
  const {db,a,b,c}=fixture();
  const srv=http.createServer((req,res)=>handleMobileApi(db,req,res));
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${srv.address().port}`;
  try {
    const health=await fetch(base+'/mobile/v1/health');assert.equal(health.status,200);
    const admin=await fetch(base+'/api/state');assert.equal(admin.status,404);
    const noauth=await fetch(base+'/mobile/v1/catalog');assert.equal(noauth.status,401);
    const sellerPair=issuePairing(db,a,'seller');
    const r=await fetch(base+'/mobile/v1/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:sellerPair.code})});
    assert.equal(r.status,200);
    const session=await r.json();const auth={Authorization:`Bearer ${session.token}`};
    assert.equal((await fetch(base+'/mobile/v1/session',{headers:auth})).status,200);
    assert.equal((await fetch(base+'/mobile/v1/team',{headers:auth})).status,403);
    const post={...auth,'Content-Type':'application/json'};
    assert.equal((await fetch(base+'/mobile/v1/location',{method:'POST',headers:post,body:JSON.stringify({lat:-2,lon:-44,accuracy:9,recordedAt:new Date().toISOString()})})).status,409);
    assert.equal((await fetch(base+'/mobile/v1/shift/start',{method:'POST',headers:auth})).status,200);
    const valid=await fetch(base+'/mobile/v1/location',{method:'POST',headers:post,body:JSON.stringify({lat:-2.537,lon:-44.299,accuracy:10,recordedAt:new Date().toISOString()})});
    assert.equal(valid.status,201);
    assert.equal((await fetch(base+'/mobile/v1/shift/stop',{method:'POST',headers:auth})).status,200);
    assert.equal((await fetch(base+'/mobile/v1/location',{method:'POST',headers:post,body:JSON.stringify({lat:-2.53,lon:-44.3,accuracy:10,recordedAt:new Date().toISOString()})})).status,409);
  } finally {await new Promise(r=>srv.close(r));db.close();}
});
