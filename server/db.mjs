import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team TEXT NOT NULL DEFAULT 'Sem equipe',
      traccar_device_id INTEGER UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      demo INTEGER NOT NULL DEFAULT 0,
      demo_lat REAL, demo_lon REAL, demo_step INTEGER NOT NULL DEFAULT 0,
      demo_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Sem classificação',
      color TEXT NOT NULL DEFAULT '#e1a746',
      geometry TEXT NOT NULL,
      demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      segment TEXT NOT NULL DEFAULT 'Residencial',
      price REAL,
      active INTEGER NOT NULL DEFAULT 1,
      demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ctos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      lat REAL NOT NULL, lon REAL NOT NULL,
      ports_free INTEGER NOT NULL DEFAULT 0 CHECK (ports_free >= 0),
      status TEXT NOT NULL DEFAULT 'online' CHECK(status IN ('online','offline')),
      verified_at TEXT,
      demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS zone_plan_rules (
      zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      decision TEXT NOT NULL CHECK(decision IN ('allow','deny')),
      PRIMARY KEY (zone_id, plan_id)
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      lat REAL NOT NULL, lon REAL NOT NULL,
      plan_id INTEGER, cto_id INTEGER, seller_id INTEGER,
      zone_id INTEGER, status TEXT NOT NULL,
      reasons_json TEXT NOT NULL,
      demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_eval_created ON evaluations(created_at DESC);
  `);
  db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)').run('demo','false');
  return db;
}

export const all = (db, sql, ...params) => db.prepare(sql).all(...params).map(x => ({...x}));
export const one = (db, sql, ...params) => {
  const row = db.prepare(sql).get(...params);
  return row ? { ...row } : null;
};
export const run = (db, sql, ...params) => db.prepare(sql).run(...params);

export function snapshot(db) {
  const sellers = all(db, 'SELECT * FROM sellers ORDER BY team,name');
  const zones = all(db, 'SELECT * FROM zones ORDER BY name').map(z => ({...z, geometry: JSON.parse(z.geometry)}));
  const ctos = all(db, 'SELECT * FROM ctos ORDER BY name');
  const plans = all(db, 'SELECT * FROM plans ORDER BY name');
  const rules = all(db, 'SELECT * FROM zone_plan_rules');
  const evaluations = all(db, 'SELECT * FROM evaluations ORDER BY id DESC LIMIT 40').map(e => ({...e,reasons: JSON.parse(e.reasons_json)}));
  const demo = one(db, 'SELECT value FROM meta WHERE key = ?', 'demo')?.value === 'true';
  return { sellers, zones, ctos, plans, rules, evaluations, demo };
}

export function loadDemo(db) {
  const { sellers, zones, ctos, plans } = snapshot(db);
  if (sellers.length || zones.length || ctos.length || plans.length) {
    throw new Error('O cenário de teste só pode ser carregado com o laboratório vazio.');
  }
  const at = new Date().toISOString();
  const a = { type:'Polygon', coordinates:[[[-44.314,-2.548],[-44.283,-2.548],[-44.283,-2.525],[-44.314,-2.525],[-44.314,-2.548]]]};
  const b = { type:'Polygon', coordinates:[[[-44.282,-2.548],[-44.250,-2.548],[-44.250,-2.525],[-44.282,-2.525],[-44.282,-2.548]]]};
  db.exec('BEGIN');
  try {
    const west = Number(run(db,'INSERT INTO zones(name,category,color,geometry,demo) VALUES(?,?,?,?,1)', 'TESTE | Setor Oeste (fictício)', 'TESTE', '#b68cf0', JSON.stringify(a)).lastInsertRowid);
    const east = Number(run(db,'INSERT INTO zones(name,category,color,geometry,demo) VALUES(?,?,?,?,1)', 'TESTE | Setor Leste (fictício)', 'TESTE', '#e7a843', JSON.stringify(b)).lastInsertRowid);
    const p1 = Number(run(db,'INSERT INTO plans(name,segment,price,active,demo) VALUES(?,?,?,1,1)', 'TESTE | Conexão Essencial', 'Residencial', 99.9).lastInsertRowid);
    const p2 = Number(run(db,'INSERT INTO plans(name,segment,price,active,demo) VALUES(?,?,?,1,1)', 'TESTE | Conexão Premium', 'Residencial', 129.9).lastInsertRowid);
    run(db,'INSERT INTO zone_plan_rules(zone_id,plan_id,decision) VALUES(?,?,?)', west,p1,'allow');
    run(db,'INSERT INTO zone_plan_rules(zone_id,plan_id,decision) VALUES(?,?,?)', west,p2,'deny');
    run(db,'INSERT INTO zone_plan_rules(zone_id,plan_id,decision) VALUES(?,?,?)', east,p1,'allow');
    run(db,'INSERT INTO zone_plan_rules(zone_id,plan_id,decision) VALUES(?,?,?)', east,p2,'allow');
    run(db,'INSERT INTO ctos(name,zone_id,lat,lon,ports_free,status,verified_at,demo) VALUES(?,?,?,?,?,?,?,1)', 'TESTE | CTO 01', west,-2.538,-44.297,8,'online',at);
    run(db,'INSERT INTO ctos(name,zone_id,lat,lon,ports_free,status,verified_at,demo) VALUES(?,?,?,?,?,?,?,1)', 'TESTE | CTO 02', east,-2.538,-44.267,0,'online',at);
    [['Vendedor Teste 01','Equipe Alfa',-2.539,-44.302],['Vendedor Teste 02','Equipe Alfa',-2.535,-44.289],['Vendedor Teste 03','Equipe Beta',-2.540,-44.269]].forEach(([name,team,lat,lon]) => {
      run(db,'INSERT INTO sellers(name,team,demo,demo_lat,demo_lon,demo_updated_at) VALUES(?,?,1,?,?,?)',name,team,lat,lon,at);
    });
    run(db,'UPDATE meta SET value=? WHERE key=?','true','demo');
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}

export function clearDemo(db) {
  if (one(db,'SELECT value FROM meta WHERE key=?','demo')?.value !== 'true') throw new Error('Não existem dados de teste ativos.');
  db.exec('BEGIN');
  try {
    run(db,'DELETE FROM evaluations WHERE demo=1');
    run(db,'DELETE FROM sellers WHERE demo=1');
    run(db,'DELETE FROM zones WHERE demo=1');
    run(db,'DELETE FROM plans WHERE demo=1');
    run(db,'UPDATE meta SET value=? WHERE key=?','false','demo');
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}

export function moveDemo(db) {
  const sellers = all(db,'SELECT * FROM sellers WHERE demo=1 ORDER BY id');
  const now = new Date().toISOString();
  const moves = [[.0011,.0013],[-.0008,.0010],[.0006,-.0011],[-.0006,.0012]];
  for (const s of sellers) {
    const index = (s.demo_step + 1) % moves.length;
    const [latDelta,lonDelta] = moves[index];
    run(db,'UPDATE sellers SET demo_lat=?,demo_lon=?,demo_step=?,demo_updated_at=? WHERE id=?', Number((s.demo_lat+latDelta).toFixed(6)),Number((s.demo_lon+lonDelta).toFixed(6)),index,now,s.id);
  }
  return sellers.length;
}
