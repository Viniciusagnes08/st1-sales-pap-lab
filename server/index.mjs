import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore,all,one,run,snapshot,loadDemo,clearDemo,moveDemo } from './db.mjs';
import { validateGeometry,coordValid } from './geo.mjs';
import { evaluate } from './eligibility.mjs';
import { makeTraccar,mergePositions,loadEnv } from './traccar.mjs';
import { ensureMobileSchema,issuePairing,listMobileAccess,cancelPairing,revokeToken,attachMobilePositions,pruneMobileData } from './mobile-db.mjs';
import { createMobileServer } from './mobile-api.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
loadEnv(path.join(root,'.env'));
const db=createStore(process.env.PAP_DB_PATH || path.join(root,'data','pap-lab.sqlite'));
ensureMobileSchema(db);
pruneMobileData(db);
const traccar=makeTraccar();
const port=Number(process.env.PORT||4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida no .env');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.json':'application/json; charset=utf-8'};
const limit=(v,max=130)=>String(v??'').trim().slice(0,max);
const int=v=>v === null || v === undefined || v === '' ? null : Number.isInteger(Number(v)) ? Number(v):NaN;
const bad=(message,status=400)=>{const error=new Error(message);error.status=status;throw error;};
const truth=v=>v===true || v===1 || v==='1';
const checkId=v=>{const id=int(v);if(!id||id<1)bad('Identificador inválido.');return id;};
const checkCoord=(lat,lon)=>{lat=Number(lat);lon=Number(lon);if(!coordValid(lat,lon))bad('Latitude ou longitude inválida.');return {lat,lon};};
function send(res,status,payload,headers={}) {
  const body=JSON.stringify(payload);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body);
}
async function body(req){
  if (!String(req.headers['content-type']||'').startsWith('application/json')) bad('Envie application/json.');
  let data='';for await (const chunk of req){data+=chunk;if(data.length>2_100_000)bad('Arquivo excede 2 MB.',413);}
  try{return JSON.parse(data||'{}');}catch{bad('JSON inválido.');}
}
function exists(table,id){if (!['sellers','zones','plans','ctos'].includes(table)) throw new Error('Tabela inválida');return Boolean(one(db,`SELECT id FROM ${table} WHERE id=?`,id));}
function zoneFeature(feature,number) {
  const geometry=feature?.type==='Feature' ? feature.geometry : feature;
  validateGeometry(geometry);
  const props=feature?.properties||{};
  const name=limit(props.name||props.nome||`Território importado ${number}`,100);
  const category=limit(props.category||props.area||props.grupo||'Sem classificação',60);
  const color=String(props.color||props.cor||'#dda74e');
  return {name,category,color:/^#[0-9a-fA-F]{6}$/.test(color)?color:'#dda74e',geometry:JSON.stringify(geometry)};
}
function recordEvaluation(result,lat,lon){
  run(db,'INSERT INTO evaluations(created_at,lat,lon,plan_id,cto_id,seller_id,zone_id,status,reasons_json,demo) VALUES(?,?,?,?,?,?,?,?,?,?)',new Date().toISOString(),lat,lon,result.planId,result.ctoId,result.sellerId,result.zoneId,result.status,JSON.stringify(result.reasons),snapshot(db).demo?1:0);
}
function exportData(){
  return {format:'pap-lab-backup',version:1,exportedAt:new Date().toISOString(),warning:'Dados locais de laboratório. Não são vendas aprovadas.',...snapshot(db)};
}
async function api(req,res,route){
  const method=req.method;
  if(method==='GET' && route==='/api/health')return send(res,200,{ok:true,service:'ST1 Sales PAP Lab',mode:'local',now:new Date().toISOString()});
  if(method==='GET' && route==='/api/state'){
    const data=snapshot(db);
    const t=await traccar.state();
    const sellers=attachMobilePositions(db,mergePositions(data.sellers,t));
    const devices=(t.devices||[]).map(d=>({id:d.id,name:d.name,online:d.status==='online'}));
    return send(res,200,{...data,sellers,traccar:{configured:t.configured,connected:t.connected,reason:t.reason,devices,updatedAt:t.updatedAt||null},now:new Date().toISOString()});
  }
  if(method==='GET' && route==='/api/mobile/access')return send(res,200,listMobileAccess(db));
  if(method==='GET' && route==='/api/mobile/config')return send(res,200,{labOnly:true,enabled:true,port:Number(process.env.PAP_MOBILE_PORT||4174),lan:process.env.PAP_MOBILE_LAN==='1',tls:Boolean(process.env.PAP_MOBILE_TLS_CERT&&process.env.PAP_MOBILE_TLS_KEY)});
  if(method==='POST' && route==='/api/mobile/pairings'){
    const d=await body(req);
    const result=issuePairing(db,checkId(d.sellerId),d.role||'seller');
    return send(res,201,{...result,warning:'Código válido por 10 minutos e exibido somente nesta resposta. Use apenas em ambiente de homologação.'});
  }
  if(method==='POST' && /^\/api\/mobile\/pairings\/\d+\/cancel$/.test(route)){
    cancelPairing(db,checkId(route.split('/')[4]));return send(res,200,{ok:true});
  }
  if(method==='POST' && /^\/api\/mobile\/tokens\/\d+\/revoke$/.test(route)){
    revokeToken(db,checkId(route.split('/')[4]));return send(res,200,{ok:true});
  }
  if(method==='GET' && route==='/api/export')return send(res,200,exportData(),{'Content-Disposition':'attachment; filename="st1-pap-lab-backup.json"'});
  if(method==='POST' && route==='/api/demo/load'){loadDemo(db);return send(res,200,{ok:true,message:'Cenário fictício carregado. Nenhuma informação representa a operação ST1.'});}
  if(method==='POST' && route==='/api/demo/step'){
    if(!snapshot(db).demo)bad('Nenhuma demonstração ativa.');const moved=moveDemo(db);return send(res,200,{ok:true,moved,message:'Posições simuladas atualizadas. Não são dados GPS reais.'});
  }
  if(method==='POST' && route==='/api/demo/clear'){clearDemo(db);return send(res,200,{ok:true,message:'Dados de demonstração removidos.'});}
  if(method==='POST' && route==='/api/sellers'){
    const d=await body(req);const name=limit(d.name,100),team=limit(d.team||'Sem equipe',100);let deviceId=int(d.traccar_device_id);
    if(name.length<2)bad('Nome do vendedor precisa ter no mínimo dois caracteres.');
    if(deviceId!==null && (!Number.isInteger(deviceId)||deviceId<1))bad('ID Traccar inválido.');
    const id=run(db,'INSERT INTO sellers(name,team,traccar_device_id,active,demo) VALUES(?,?,?,1,0)',name,team,deviceId).lastInsertRowid;
    return send(res,201,{id:Number(id)});
  }
  if(method==='PATCH' && /^\/api\/sellers\/\d+$/.test(route)){
    const id=checkId(route.split('/').at(-1));if(!exists('sellers',id))bad('Vendedor não encontrado.',404);
    const d=await body(req);const old=one(db,'SELECT * FROM sellers WHERE id=?',id);
    const name=d.name!==undefined?limit(d.name,100):old.name;
    const team=d.team!==undefined?limit(d.team,100):old.team;
    const deviceId=d.traccar_device_id!==undefined?int(d.traccar_device_id):old.traccar_device_id;
    if(name.length<2 || !team)bad('Nome e equipe obrigatórios.');
    if(deviceId!==null && (!Number.isInteger(deviceId)||deviceId<1))bad('ID Traccar inválido.');
    run(db,'UPDATE sellers SET name=?,team=?,traccar_device_id=?,active=? WHERE id=?',name,team,deviceId,d.active===undefined?old.active:truth(d.active)?1:0,id);
    return send(res,200,{ok:true});
  }
  if(method==='DELETE' && /^\/api\/sellers\/\d+$/.test(route)){
    const id=checkId(route.split('/').at(-1));run(db,'DELETE FROM sellers WHERE id=?',id);return send(res,200,{ok:true});
  }
  if(method==='POST' && route==='/api/zones/import'){
    const data=await body(req);
    const features=data.type==='FeatureCollection'?data.features:Array.isArray(data.features)?data.features:[data];
    if(!Array.isArray(features)||features.length<1||features.length>30)bad('Informe entre 1 e 30 polígonos por arquivo.');
    const values=features.map((f,i)=>zoneFeature(f,i+1));
    db.exec('BEGIN');try {for(const v of values)run(db,'INSERT INTO zones(name,category,color,geometry,demo) VALUES(?,?,?,?,0)',v.name,v.category,v.color,v.geometry);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    return send(res,201,{ok:true,count:values.length});
  }
  if(method==='DELETE' && /^\/api\/zones\/\d+$/.test(route)){
    const id=checkId(route.split('/').at(-1));run(db,'DELETE FROM zones WHERE id=?',id);return send(res,200,{ok:true});
  }
  if(method==='POST' && route==='/api/plans'){
    const d=await body(req),name=limit(d.name,100),segment=limit(d.segment||'Residencial',50);
    const price=d.price===null||d.price===undefined||d.price===''?null:Number(d.price);
    if(name.length<2||!segment)bad('Informe nome e segmento do plano.');
    if(price!==null&&(!Number.isFinite(price)||price<0||price>100000))bad('Valor do plano inválido.');
    const id=run(db,'INSERT INTO plans(name,segment,price,active,demo) VALUES(?,?,?,1,0)',name,segment,price).lastInsertRowid;
    return send(res,201,{id:Number(id)});
  }
  if(method==='PATCH' && /^\/api\/plans\/\d+$/.test(route)){
    const id=checkId(route.split('/').at(-1));if(!exists('plans',id))bad('Plano não encontrado.',404);
    const d=await body(req);if(d.active===undefined)bad('Envie campo active.');
    run(db,'UPDATE plans SET active=? WHERE id=?',truth(d.active)?1:0,id);return send(res,200,{ok:true});
  }
  if(method==='DELETE' && /^\/api\/plans\/\d+$/.test(route)){
    const id=checkId(route.split('/').at(-1));run(db,'DELETE FROM plans WHERE id=?',id);return send(res,200,{ok:true});
  }
  if(method==='POST' && route==='/api/ctos'){
    const d=await body(req),name=limit(d.name,100),zone=checkId(d.zone_id),{lat,lon}=checkCoord(d.lat,d.lon);
    const ports=int(d.ports_free),status=d.status==='offline'?'offline':'online';
    if(name.length<2 || !exists('zones',zone))bad('Nome e território válido são obrigatórios.');
    if(ports===null||ports<0||ports>100000)bad('Quantidade de portas inválida.');
    const id=run(db,'INSERT INTO ctos(name,zone_id,lat,lon,ports_free,status,verified_at,demo) VALUES(?,?,?,?,?,?,NULL,0)',name,zone,lat,lon,ports,status).lastInsertRowid;
    return send(res,201,{id:Number(id)});
  }
  if(method==='PATCH' && /^\/api\/ctos\/\d+$/.test(route)){
    const id=checkId(route.split('/').at(-1));const current=one(db,'SELECT * FROM ctos WHERE id=?',id);
    if(!current)bad('CTO não encontrada.',404);
    const d=await body(req);
    const ports=d.ports_free===undefined?current.ports_free:int(d.ports_free);
    if(ports===null||ports<0||ports>100000)bad('Portas disponíveis inválidas.');
    const status=d.status===undefined?current.status:d.status;
    if(!['online','offline'].includes(status))bad('Status da CTO inválido.');
    // Sempre invalida a última confirmação quando status/capacidade muda; o operador precisa reconfirmar.
    run(db,'UPDATE ctos SET ports_free=?,status=?,verified_at=NULL WHERE id=?',ports,status,id);
    return send(res,200,{ok:true});
  }
  if(method==='POST' && /^\/api\/ctos\/\d+\/verify$/.test(route)){
    const id=checkId(route.split('/')[3]);const cto=one(db,'SELECT * FROM ctos WHERE id=?',id);
    if(!cto)bad('CTO não encontrada.',404);
    if(cto.ports_free<1||cto.status!=='online')bad('Não é possível validar CTO offline ou sem capacidade.');
    run(db,'UPDATE ctos SET verified_at=? WHERE id=?',new Date().toISOString(),id);
    return send(res,200,{ok:true,verifiedAt:new Date().toISOString(),warning:'Confirmação manual local. Não consulta IXC.'});
  }
  if(method==='DELETE' && /^\/api\/ctos\/\d+$/.test(route)){
    const id=checkId(route.split('/').at(-1));run(db,'DELETE FROM ctos WHERE id=?',id);return send(res,200,{ok:true});
  }
  if(method==='PUT' && route==='/api/rules'){
    const d=await body(req),zone=checkId(d.zone_id),plan=checkId(d.plan_id),decision=d.decision;
    if(!exists('zones',zone)||!exists('plans',plan))bad('Plano e território devem existir.');
    if(decision==='clear')run(db,'DELETE FROM zone_plan_rules WHERE zone_id=? AND plan_id=?',zone,plan);
    else if(['allow','deny'].includes(decision))run(db,'INSERT INTO zone_plan_rules(zone_id,plan_id,decision) VALUES(?,?,?) ON CONFLICT(zone_id,plan_id) DO UPDATE SET decision=excluded.decision',zone,plan,decision);
    else bad('Regra inválida (allow, deny ou clear).');
    return send(res,200,{ok:true});
  }
  if(method==='POST' && route==='/api/evaluate'){
    const d=await body(req),{lat,lon}=checkCoord(d.lat,d.lon),planId=checkId(d.planId);
    const ctoId=d.ctoId?checkId(d.ctoId):null,sellerId=d.sellerId?checkId(d.sellerId):null;
    const data=snapshot(db),result=evaluate({lat,lon,planId,ctoId,sellerId},data);
    recordEvaluation(result,lat,lon);return send(res,200,{...result,lat,lon,checkedAt:new Date().toISOString()});
  }
  return send(res,404,{error:'Endpoint não encontrado.'});
}

const webRoot=path.join(root,'public');
async function handler(req,res){
  // Proteção contra DNS rebinding e origens externas; não usar em LAN nem internet.
  if(!['127.0.0.1','localhost'].includes(String(req.headers.host||'').split(':')[0]))return send(res,403,{error:'Acesso permitido apenas via localhost.'});
  if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return send(res,403,{error:'Origem não autorizada.'});
  const url=new URL(req.url,`http://127.0.0.1:${port}`);const route=decodeURI(url.pathname);
  try{
    if(route.startsWith('/api/'))return await api(req,res,route);
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Método não permitido.'});
    const rel=(route==='/'?'/index.html':route);
    const file=path.resolve(webRoot,'.'+rel);
    if(!(file===webRoot || file.startsWith(webRoot+path.sep)))return send(res,403,{error:'Acesso negado.'});
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return send(res,404,{error:'Recurso inexistente.'});
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
    fs.createReadStream(file).pipe(res);
  }catch(e){
    const status=e.status||(String(e.message).includes('UNIQUE constraint')?409:500);
    if(status===500)console.error('[PAP LAB] erro interno:',e);
    send(res,status,{error:status===500?'Erro interno no laboratório.':e.message});
  }
}
const server=http.createServer(handler);
const mobile=createMobileServer(db);
server.listen(port,'127.0.0.1',()=>console.log(`[PAP WEB ADMIN] http://127.0.0.1:${port} | somente localhost | Traccar: ${traccar.configured?'configurado':'não configurado'}`));
mobile.server.on('error',e=>{console.error('[PAP API MÓVEL] Falha na porta móvel:',e.message);process.exitCode=1;server.close();});
mobile.server.listen(mobile.port,mobile.host,()=>console.log(`[PAP MOBILE API] ${mobile.tls?'https':'http'}://${mobile.host}:${mobile.port} | ${mobile.lan?'MODO LAN DE HOMOLOGAÇÃO — EVITE DADOS REAIS SEM HTTPS':'somente localhost'}`));
const pruneTimer=setInterval(()=>pruneMobileData(db),60*60_000);pruneTimer.unref();
let closing=false;
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{
  if(closing)return;closing=true;clearInterval(pruneTimer);
  mobile.server.close(()=>server.close(()=>{db.close();process.exit(process.exitCode||0);}));
});
