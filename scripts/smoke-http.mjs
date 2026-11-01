/** End-to-end integration smoke using only synthetic data and temporary database. */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

async function port(){
 const server=http.createServer();await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const n=server.address().port;await new Promise(r=>server.close(r));return n;
}
async function request(base,route,method='GET',payload,token){
 const response=await fetch(base+route,{method,headers:{...(payload!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:payload!==undefined?JSON.stringify(payload):undefined});
 return {code:response.status,body:await response.json()};
}
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const work=fs.mkdtempSync(path.join(os.tmpdir(),'pap-homolog-smoke-'));
const dbFile=path.join(work,'smoke.sqlite');
const adminPort=await port(),mobilePort=await port();
const admin=`http://127.0.0.1:${adminPort}`;
const mobile=`http://127.0.0.1:${mobilePort}`;
const child=spawn(process.execPath,['--experimental-sqlite','server/index.mjs'],{
 cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,PORT:String(adminPort),PAP_MOBILE_PORT:String(mobilePort),PAP_MOBILE_LAN:'0',PAP_DB_PATH:dbFile,TRACCAR_TOKEN:'',TRACCAR_EMAIL:'',TRACCAR_PASSWORD:''},stdio:'ignore'
});
let failed;
try{
 let ready=false;
 for(let i=0;i<70;i++){try{const r=await request(admin,'/api/health');if(r.code===200){ready=true;break;}}catch{}await sleep(120);}
 assert.ok(ready,'Não foi possível iniciar o servidor Node de homologação.');
 let r=await request(admin,'/api/demo/load','POST');assert.equal(r.code,200);
 r=await request(admin,'/api/sellers','POST',{name:'Piloto Sintético de Teste',team:'Turma de QA'});assert.equal(r.code,201);const id=r.body.id;
 r=await request(admin,'/api/mobile/pairings','POST',{sellerId:id,role:'supervisor'});assert.equal(r.code,201);
 const code=r.body.code;
 r=await request(mobile,'/mobile/v1/pair','POST',{code});assert.equal(r.code,200);const token=r.body.token;
 r=await request(mobile,'/mobile/v1/pair','POST',{code});assert.equal(r.code,401,'Código usado não pode funcionar outra vez');
 r=await request(mobile,'/mobile/v1/session','GET',undefined,token);assert.equal(r.body.user.role,'supervisor');
 r=await request(mobile,'/mobile/v1/shift/start','POST',undefined,token);assert.equal(r.code,200);
 r=await request(mobile,'/mobile/v1/location','POST',{lat:-2.537,lon:-44.298,accuracy:18,recordedAt:new Date().toISOString()},token);assert.equal(r.code,201);
 r=await request(admin,'/api/state');const seller=r.body.sellers.find(s=>s.id===id);
 assert.equal(seller.position.source,'APP PAP');assert.equal(seller.position.fresh,true);
 r=await request(mobile,'/mobile/v1/team','GET',undefined,token);assert.equal(r.code,200);assert.ok(r.body.members.some(x=>x.id===id));
 r=await request(mobile,'/mobile/v1/evaluate','POST',{lat:-2.537,lon:-44.299,planId:1,ctoId:1},token);assert.equal(r.code,200);assert.equal(r.body.labOnly,true);
 r=await request(mobile,'/api/state');assert.equal(r.code,404);
 r=await request(admin,'/api/mobile/access');const credential=r.body.tokens.find(x=>x.seller_id===id);assert.ok(credential);
 r=await request(admin,`/api/mobile/tokens/${credential.id}/revoke`,'POST');assert.equal(r.code,200);
 r=await request(mobile,'/mobile/v1/session','GET',undefined,token);assert.equal(r.code,401);
 r=await request(admin,'/api/state');assert.equal(r.body.sellers.find(s=>s.id===id).onShift,false);
 console.log('OK: pareamento, GPS em jornada, mapa Web, equipe, oferta LAB, revogação e isolamento da API móvel.');
}catch(e){failed=e;console.error('FALHOU smoke-http:',e.message);}
finally {
 child.kill('SIGINT');
 await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(2500)]);
 if(child.exitCode===null)child.kill('SIGTERM');
 try{fs.rmSync(work,{recursive:true,force:true});}catch{}
}
if(failed)process.exitCode=1;
