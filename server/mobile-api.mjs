/** Mobile-only API. Never shares the desktop admin routes. */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { snapshot,run } from './db.mjs';
import { evaluate } from './eligibility.mjs';
import { coordValid } from './geo.mjs';
import {
  authenticate, redeemPairing, getActiveShift, startShift, stopShift, submitPosition,
  recordVisit, listVisits, getTeam
} from './mobile-db.mjs';

function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
const rate=new Map();
function checkPairRate(ip,now=Date.now()){
  const bucket=(rate.get(ip)||[]).filter(t=>now-t<10*60_000);
  if(bucket.length>=10)fail('Muitas tentativas. Aguarde 10 minutos.',429);
  bucket.push(now);rate.set(ip,bucket);
  if(rate.size>10000){for(const [key,v] of rate){if(v.every(t=>now-t>10*60_000))rate.delete(key);}}
}
function send(res,status,value){
  const payload=JSON.stringify(value);
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
    'Content-Security-Policy':"default-src 'none'",
    'Vary':'Origin'
  });res.end(payload);
}
async function parse(req){
  const mime=String(req.headers['content-type']||'');
  if(!mime.startsWith('application/json'))fail('Envie JSON com Content-Type application/json.',415);
  let raw='';for await(const part of req){raw+=part;if(raw.length>16384)fail('Corpo JSON ultrapassa 16 KB.',413);}
  try{return JSON.parse(raw||'{}');}catch{fail('JSON inválido.');}
}
function numberId(v){const n=Number(v);if(!Number.isInteger(n)||n<=0)fail('ID inválido.');return n;}
function point(v){if(!v||v.lat===null||v.lat===undefined||v.lon===null||v.lon===undefined)fail('Informe coordenadas de instalação.');const lat=Number(v.lat),lon=Number(v.lon);if(!coordValid(lat,lon))fail('Latitude/longitude inválidas.');return {lat,lon};}

export async function handleMobileApi(db,req,res){
  try{
    if(req.headers.origin) fail('Este endpoint atende somente o aplicativo nativo.',403);
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    if(!pathname.startsWith('/mobile/v1/'))return send(res,404,{error:'Rota móvel inexistente.'});
    if(req.method==='OPTIONS')return send(res,405,{error:'Método não permitido.'});
    if(req.method==='GET'&&pathname==='/mobile/v1/health'){
      return send(res,200,{ok:true,service:'ST1 Sales PAP | Homologação',labOnly:true,now:new Date().toISOString()});
    }
    if(req.method==='POST'&&pathname==='/mobile/v1/pair'){
      checkPairRate(req.socket.remoteAddress||'unknown');
      const payload=await parse(req);
      const session=redeemPairing(db,payload.code);
      return send(res,200,{...session,labOnly:true});
    }
    const bearer=String(req.headers.authorization||'');
    if(!/^Bearer [A-Za-z0-9_-]{40,60}$/.test(bearer))fail('Informe Bearer token do aplicativo.',401);
    const principal=authenticate(db,bearer.slice(7));
    if(req.method==='GET'&&pathname==='/mobile/v1/session'){
      const shift=getActiveShift(db,principal.sellerId);
      return send(res,200,{labOnly:true,user:{id:principal.sellerId,name:principal.name,team:principal.team,role:principal.role},shift:shift?{id:shift.id,startedAt:shift.started_at}:null});
    }
    if(req.method==='POST'&&pathname==='/mobile/v1/shift/start'){
      return send(res,200,{labOnly:true,...startShift(db,principal.sellerId)});
    }
    if(req.method==='POST'&&pathname==='/mobile/v1/shift/stop'){
      return send(res,200,{labOnly:true,...stopShift(db,principal.sellerId)});
    }
    if(req.method==='POST'&&pathname==='/mobile/v1/location'){
      return send(res,201,{labOnly:true,...submitPosition(db,principal.sellerId,await parse(req))});
    }
    if(req.method==='GET'&&pathname==='/mobile/v1/catalog'){
      const data=snapshot(db);
      return send(res,200,{labOnly:true,plans:data.plans.filter(p=>p.active).map(p=>({id:p.id,name:p.name,segment:p.segment,price:p.price})),
        ctos:data.ctos.map(c=>({id:c.id,name:c.name,zone_id:c.zone_id,lat:c.lat,lon:c.lon,ports_free:c.ports_free,status:c.status,verified_at:c.verified_at})),
        zones:data.zones.map(z=>({id:z.id,name:z.name,category:z.category,color:z.color,geometry:z.geometry})),
        warning:'Dados de homologação; nenhuma consulta real ao IXC/ST1 Sales.'});
    }
    if(req.method==='POST'&&pathname==='/mobile/v1/evaluate'){
      const data=await parse(req);const {lat,lon}=point(data),planId=numberId(data.planId);
      const ctoId=data.ctoId?numberId(data.ctoId):null;
      const result=evaluate({lat,lon,planId,ctoId,sellerId:principal.sellerId},snapshot(db));
      run(db,`INSERT INTO evaluations(created_at,lat,lon,plan_id,cto_id,seller_id,zone_id,status,reasons_json,demo)
        VALUES(?,?,?,?,?,?,?,?,?,1)`,new Date().toISOString(),lat,lon,result.planId,result.ctoId,principal.sellerId,result.zoneId,result.status,JSON.stringify(result.reasons));
      return send(res,200,{...result,lat,lon,checkedAt:new Date().toISOString()});
    }
    if(req.method==='POST'&&pathname==='/mobile/v1/visits'){
      return send(res,201,recordVisit(db,principal,await parse(req)));
    }
    if(req.method==='GET'&&pathname==='/mobile/v1/visits'){
      return send(res,200,{labOnly:true,visits:listVisits(db,principal)});
    }
    if(req.method==='GET'&&pathname==='/mobile/v1/team'){
      return send(res,200,{labOnly:true,team:principal.team,members:getTeam(db,principal)});
    }
    return send(res,404,{error:'Rota móvel inexistente.'});
  }catch(e){
    const status=e.status||500;
    if(status===500)console.error('[PAP API MÓVEL]',e);
    return send(res,status,{error:status===500?'Erro interno na API do laboratório.':e.message});
  }
}

export function createMobileServer(db, env=process.env){
  const port=Number(env.PAP_MOBILE_PORT||4174);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PAP_MOBILE_PORT inválida.');
  const lan=env.PAP_MOBILE_LAN==='1';
  const cert=env.PAP_MOBILE_TLS_CERT, key=env.PAP_MOBILE_TLS_KEY;
  if(Boolean(cert)!==Boolean(key))throw new Error('Defina o certificado e a chave TLS juntos.');
  const tls=Boolean(cert&&key);
  const server=tls?https.createServer({cert:fs.readFileSync(cert),key:fs.readFileSync(key)},(req,res)=>handleMobileApi(db,req,res)):
    http.createServer((req,res)=>handleMobileApi(db,req,res));
  return {server,port,host:lan?'0.0.0.0':'127.0.0.1',tls,lan};
}
