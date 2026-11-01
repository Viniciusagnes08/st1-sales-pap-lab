/** Field API storage. No external credentials, no ST1 Sales/IXC writes. */
import crypto from 'node:crypto';
import { all, one, run } from './db.mjs';
import { coordValid } from './geo.mjs';

const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const iso = value => new Date(value).toISOString();
const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const roles = new Set(['seller', 'supervisor']);
const stages = new Set(['visita', 'contato', 'proposta', 'retorno']);

export function ensureMobileSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mobile_pairings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('seller','supervisor')),
      code_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      redeemed_at TEXT,
      cancelled_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pairings_seller ON mobile_pairings(seller_id);
    CREATE TABLE IF NOT EXISTS mobile_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('seller','supervisor')),
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS mobile_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_shift_per_seller
      ON mobile_shifts(seller_id) WHERE ended_at IS NULL;
    CREATE TABLE IF NOT EXISTS mobile_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      lat REAL NOT NULL, lon REAL NOT NULL,
      accuracy REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mobile_positions_seller_time
      ON mobile_positions(seller_id, received_at DESC);
    CREATE TABLE IF NOT EXISTS mobile_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      stage TEXT NOT NULL CHECK(stage IN ('visita','contato','proposta','retorno')),
      lat REAL NOT NULL, lon REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mobile_visits_seller_time ON mobile_visits(seller_id, created_at DESC);
  `);
}

function assertRealSeller(db, sellerId) {
  if (!Number.isInteger(Number(sellerId)) || Number(sellerId) < 1) fail('Selecione um vendedor válido.');
  const seller = one(db, 'SELECT * FROM sellers WHERE id=?', Number(sellerId));
  if (!seller || !seller.active) fail('Vendedor não encontrado ou inativo.', 404);
  if (seller.demo) fail('Vincule um vendedor real cadastrado separadamente, não um personagem fictício.');
  return seller;
}

export function issuePairing(db, sellerId, role, now = Date.now()) {
  assertRealSeller(db, sellerId);
  if (!roles.has(role)) fail('Papel deve ser vendedor ou supervisor.');
  const code = crypto.randomBytes(8).toString('hex').toUpperCase();
  const issued = iso(now), expires = iso(now + 10 * 60_000);
  const id = run(db,
    'INSERT INTO mobile_pairings(seller_id,role,code_hash,created_at,expires_at) VALUES(?,?,?,?,?)',
    Number(sellerId), role, digest(code), issued, expires).lastInsertRowid;
  return { id:Number(id), code, expiresAt:expires, role, sellerId:Number(sellerId) };
}

export function redeemPairing(db, rawCode, now = Date.now()) {
  const code = String(rawCode || '').trim().replace(/\s|-/g, '').toUpperCase();
  if (!/^[A-F0-9]{16}$/.test(code)) fail('Código de pareamento inválido.', 400);
  const row = one(db, `SELECT p.*, s.name,s.team,s.active,s.demo FROM mobile_pairings p
    JOIN sellers s ON s.id=p.seller_id WHERE p.code_hash=?`, digest(code));
  if (!row || row.redeemed_at || row.cancelled_at || Date.parse(row.expires_at) <= now || !row.active || row.demo) {
    fail('Código vencido, cancelado ou já utilizado.', 401);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  db.exec('BEGIN');
  try {
    const changed = run(db,'UPDATE mobile_pairings SET redeemed_at=? WHERE id=? AND redeemed_at IS NULL AND cancelled_at IS NULL',iso(now),row.id);
    if (!changed.changes) fail('Código de uso único já consumido.',401);
    // Um aparelho ativo por profissional na homologação: novo pareamento invalida o anterior.
    run(db,'UPDATE mobile_tokens SET revoked_at=? WHERE seller_id=? AND revoked_at IS NULL',iso(now),row.seller_id);
    run(db,'UPDATE mobile_shifts SET ended_at=? WHERE seller_id=? AND ended_at IS NULL',iso(now),row.seller_id);
    run(db,'INSERT INTO mobile_tokens(seller_id,role,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)',
      row.seller_id,row.role,digest(token),iso(now),iso(now+14*24*60*60_000));
    db.exec('COMMIT');
  } catch (e) {db.exec('ROLLBACK'); throw e;}
  return {token,expiresAt:iso(now+14*24*60*60_000),user:{id:row.seller_id,name:row.name,team:row.team,role:row.role}};
}

export function authenticate(db, token, now = Date.now()) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) fail('Sessão inválida.', 401);
  const row = one(db, `SELECT t.id as token_id, t.seller_id, t.role, t.expires_at, t.revoked_at,
    s.name, s.team, s.active,s.demo FROM mobile_tokens t JOIN sellers s ON s.id=t.seller_id WHERE token_hash=?`,digest(token));
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= now || !row.active || row.demo) fail('Sessão vencida ou revogada.',401);
  return {sellerId:row.seller_id,tokenId:row.token_id,role:row.role,name:row.name,team:row.team};
}

export function listMobileAccess(db) {
  return {
    pairings:all(db,`SELECT p.id,p.seller_id,s.name,p.role,p.created_at,p.expires_at,p.redeemed_at,p.cancelled_at
      FROM mobile_pairings p JOIN sellers s ON s.id=p.seller_id ORDER BY p.id DESC LIMIT 40`),
    tokens:all(db,`SELECT t.id,t.seller_id,s.name,s.team,t.role,t.created_at,t.expires_at,t.revoked_at
      FROM mobile_tokens t JOIN sellers s ON s.id=t.seller_id ORDER BY t.id DESC LIMIT 60`)
  };
}
export function cancelPairing(db, id, now=Date.now()) {
  const r=run(db,'UPDATE mobile_pairings SET cancelled_at=? WHERE id=? AND redeemed_at IS NULL AND cancelled_at IS NULL',iso(now),id);
  if(!r.changes) fail('Pareamento não encontrado ou já consumido.',404);
}
export function revokeToken(db, id, now=Date.now()) {
  const r=run(db,'UPDATE mobile_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL',iso(now),id);
  if(!r.changes) fail('Credencial não encontrada ou já revogada.',404);
  // Revogação não pode manter um vendedor marcado como jornada ativa no servidor.
  const actor=one(db,'SELECT seller_id FROM mobile_tokens WHERE id=?',id);
  if(actor)stopShift(db,actor.seller_id,now);
}

export function getActiveShift(db, sellerId) {
  return one(db,'SELECT * FROM mobile_shifts WHERE seller_id=? AND ended_at IS NULL ORDER BY id DESC LIMIT 1',sellerId);
}
export function startShift(db, sellerId, now=Date.now()) {
  assertRealSeller(db,sellerId);
  const running=getActiveShift(db,sellerId);
  if (running) return {shift:running,alreadyActive:true};
  const startedAt=iso(now);
  const id=Number(run(db,'INSERT INTO mobile_shifts(seller_id,started_at) VALUES(?,?)',sellerId,startedAt).lastInsertRowid);
  return {shift:{id,seller_id:sellerId,started_at:startedAt,ended_at:null},alreadyActive:false};
}
export function stopShift(db, sellerId, now=Date.now()) {
  const r=run(db,'UPDATE mobile_shifts SET ended_at=? WHERE seller_id=? AND ended_at IS NULL',iso(now),sellerId);
  return {stopped:Boolean(r.changes)};
}
export function submitPosition(db, sellerId, input, now=Date.now()) {
  if(!getActiveShift(db,sellerId)) fail('Jornada encerrada. Inicie a jornada antes do envio de GPS.',409);
  if(input?.lat===null||input?.lat===undefined||input?.lon===null||input?.lon===undefined||input?.accuracy===null||input?.accuracy===undefined)fail('GPS exige latitude, longitude e precisão.');
  const lat=Number(input.lat),lon=Number(input.lon),accuracy=Number(input.accuracy);
  if(!coordValid(lat,lon)) fail('Coordenadas GPS inválidas.');
  if(!Number.isFinite(accuracy)||accuracy<0||accuracy>5000) fail('Precisão GPS inválida.');
  const recordedMs=Date.parse(input?.recordedAt);
  if(!Number.isFinite(recordedMs)||recordedMs>now+60_000||recordedMs<now-180_000) fail('Amostra GPS antiga ou adiantada (mais de 3 minutos).');
  const last=one(db,'SELECT * FROM mobile_positions WHERE seller_id=? ORDER BY id DESC LIMIT 1',sellerId);
  if(last && recordedMs <= Date.parse(last.recorded_at)) fail('Amostra GPS repetida ou fora de ordem.',409);
  if(last && now-Date.parse(last.received_at)<8_000) fail('Aguarde 8 segundos entre posições.',429);
  const id=run(db,'INSERT INTO mobile_positions(seller_id,lat,lon,accuracy,recorded_at,received_at) VALUES(?,?,?,?,?,?)',
    sellerId,lat,lon,accuracy,iso(recordedMs),iso(now)).lastInsertRowid;
  return {id:Number(id),accepted:true,receivedAt:iso(now)};
}

export function positionsBySeller(db, now=Date.now()) {
  const positions=all(db,`SELECT p.seller_id,p.lat,p.lon,p.accuracy,p.recorded_at,p.received_at,
    EXISTS(SELECT 1 FROM mobile_shifts sh WHERE sh.seller_id=p.seller_id AND sh.ended_at IS NULL) as on_shift
    FROM mobile_positions p WHERE p.id IN (SELECT MAX(id) FROM mobile_positions GROUP BY seller_id)`);
  const output=new Map();
  for(const p of positions) {
    const age=now-Date.parse(p.recorded_at);
    output.set(p.seller_id,{lat:p.lat,lon:p.lon,accuracy:p.accuracy,updatedAt:p.recorded_at,
      source:'APP PAP',fresh:Boolean(p.on_shift && p.accuracy<=200 && age>=0 && age <= 180_000),onShift:Boolean(p.on_shift)});
  }
  return output;
}
export function attachMobilePositions(db, sellers, now=Date.now()) {
  const positions=positionsBySeller(db,now);
  return sellers.map(s=>{
    const mobile=positions.get(s.id);
    if (!mobile) return {...s,onShift:Boolean(getActiveShift(db,s.id))};
    const legacy=s.position;
    const mobileTime=Date.parse(mobile.updatedAt),oldTime=Date.parse(legacy?.updatedAt);
    // An app position always replaces fake DEMO marks; Traccar only loses if app timestamp is newer.
    const useMobile = legacy?.source==='SIMULADO' ? !s.demo : (!Number.isFinite(oldTime)||mobileTime >= oldTime);
    return {...s,onShift:mobile.onShift,position:useMobile?mobile:legacy};
  });
}

export function recordVisit(db, principal, data, now=Date.now()) {
  if(!getActiveShift(db,principal.sellerId)) fail('Inicie a jornada para registrar uma visita.',409);
  const stage=String(data?.stage||'');
  if(data?.lat===null||data?.lat===undefined||data?.lon===null||data?.lon===undefined)fail('Informe latitude e longitude da visita.');
  const lat=Number(data.lat),lon=Number(data.lon);
  if(!stages.has(stage)) fail('Etapa de visita inválida.');
  if(!coordValid(lat,lon)) fail('Coordenadas de visita inválidas.');
  const id=run(db,'INSERT INTO mobile_visits(seller_id,stage,lat,lon,created_at) VALUES(?,?,?,?,?)',
    principal.sellerId,stage,lat,lon,iso(now)).lastInsertRowid;
  return {id:Number(id),stage,lat,lon,labOnly:true,createdAt:iso(now)};
}
export function listVisits(db, principal, limit=30) {
  const max=Math.max(1,Math.min(100,Number(limit)||30));
  if(principal.role==='supervisor')return all(db,`SELECT v.*,s.name as seller_name FROM mobile_visits v
    JOIN sellers s ON s.id=v.seller_id WHERE s.team=? ORDER BY v.id DESC LIMIT ?`,principal.team,max);
  return all(db,'SELECT * FROM mobile_visits WHERE seller_id=? ORDER BY id DESC LIMIT ?',principal.sellerId,max);
}
export function getTeam(db, principal, now=Date.now()) {
  if(principal.role!=='supervisor') fail('Acesso disponível apenas para supervisores.',403);
  const staff=all(db,'SELECT id,name,team,active FROM sellers WHERE team=? AND active=1 ORDER BY name',principal.team);
  const positions=positionsBySeller(db,now);
  return staff.map(s=>({id:s.id,name:s.name,team:s.team,onShift:Boolean(getActiveShift(db,s.id)),position:positions.get(s.id)||null}));
}
export function pruneMobileData(db, now=Date.now()) {
  const date=iso(now-7*24*60*60_000);
  const positions=run(db,'DELETE FROM mobile_positions WHERE received_at<?',date).changes;
  const visits=run(db,'DELETE FROM mobile_visits WHERE created_at<?',date).changes;
  return {positions,visits};
}
