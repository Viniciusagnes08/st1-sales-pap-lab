import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { makeTraccar,mergePositions } from './traccar.mjs';

test('sem configuração, não inventa conexão nem posições',async()=>{
  const t=makeTraccar({});const state=await t.state();
  assert.equal(state.connected,false);assert.equal(state.configured,false);assert.deepEqual(state.positions,[]);
});
test('consulta servidor Traccar via HTTP Basic e enriquece vendedores',async()=>{
  const server=http.createServer((req,res)=>{
    assert.equal(req.headers.authorization,'Basic '+Buffer.from('teste:segredo').toString('base64'));
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/devices')return res.end(JSON.stringify([{id:21,name:'GPS Equipe 01'}]));
    if(req.url==='/api/positions')return res.end(JSON.stringify([{deviceId:21,latitude:-2.537,longitude:-44.299,fixTime:new Date().toISOString()}]));
    res.writeHead(404);res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const port=server.address().port;
    const t=makeTraccar({TRACCAR_URL:`http://127.0.0.1:${port}`,TRACCAR_EMAIL:'teste',TRACCAR_PASSWORD:'segredo'});
    const data=await t.state();assert.equal(data.connected,true);assert.equal(data.devices.length,1);
    const users=mergePositions([{id:1,name:'Vendedor',active:1,traccar_device_id:21,demo:0}],data);
    assert.equal(users[0].position.source,'TRACCAR');assert.equal(users[0].position.fresh,true);
    assert.equal(users[0].position.lat,-2.537);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('GPS antigo não é marcado como atual',()=>{
  const old=new Date(Date.now()-5*60*1000).toISOString();
  const users=mergePositions([{id:1,active:1,traccar_device_id:1,demo:0}],{positions:[{deviceId:1,latitude:-2.5,longitude:-44.3,fixTime:old}]});
  assert.equal(users[0].position.fresh,false);
});
