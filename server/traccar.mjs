import fs from 'node:fs';
import path from 'node:path';

export function loadEnv(file = path.join(process.cwd(),'.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
    const m=line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
export function makeTraccar(config=process.env) {
  const url=(config.TRACCAR_URL||'').replace(/\/$/,'');
  const token=config.TRACCAR_TOKEN||'';
  const email=config.TRACCAR_EMAIL||'';
  const password=config.TRACCAR_PASSWORD||'';
  const configured=Boolean(url && (token || (email && password)));
  let cache=null, until=0;
  async function get(resource) {
    if (!configured) throw new Error('Traccar não configurado: informe URL e token ou usuário/senha no .env.');
    const headers={Accept:'application/json', Authorization: token ? `Bearer ${token}` : `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`};
    const response=await fetch(`${url}/api/${resource}`,{headers,signal:AbortSignal.timeout(5500)});
    if (!response.ok) throw new Error(`Traccar respondeu HTTP ${response.status} (verifique acesso e permissões).`);
    return response.json();
  }
  async function state(force=false) {
    const now=Date.now();
    if (!configured) return { configured:false, connected:false, reason:'Sem credenciais no .env', devices:[], positions:[] };
    if (!force && cache && now < until) return cache;
    try {
      const [devices,positions]=await Promise.all([get('devices'),get('positions')]);
      cache={configured:true,connected:true,reason:'Conectado',devices,positions,updatedAt:new Date().toISOString()};
      until=now+12000;
    } catch(e) {
      cache={configured:true,connected:false,reason:e.message,devices:[],positions:[]};
      until=now+8000;
    }
    return cache;
  }
  return { state, configured, url:configured ? url : null };
}

export function mergePositions(sellers, traccar, now=Date.now()) {
  const byDevice=new Map((traccar.positions||[]).map(p=>[p.deviceId,p]));
  return sellers.map(s=>{
    if (s.demo && Number.isFinite(s.demo_lat) && Number.isFinite(s.demo_lon)) {
      return {...s, position:{lat:s.demo_lat,lon:s.demo_lon,updatedAt:s.demo_updated_at,source:'SIMULADO',fresh:true,accuracy:null}};
    }
    const p=s.traccar_device_id ? byDevice.get(s.traccar_device_id) : null;
    const at=p && (p.fixTime||p.deviceTime||p.serverTime);
    if (p && Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&at && !isNaN(Date.parse(at))) {
      const age=now-Date.parse(at);
      return {...s,position:{lat:p.latitude,lon:p.longitude,updatedAt:at,source:'TRACCAR',fresh:age>=0 && age <= 3*60*1000,accuracy:p.accuracy??null}};
    }
    return {...s,position:null};
  });
}
