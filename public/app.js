import { OperationMap } from './map.js';

const app=document.querySelector('#app');
const S={ page:'map', data:null, selectedPoint:null, selectedSellerId:null, result:null, verifyDraft:{planId:'',ctoId:'',sellerId:''}, map:null, toast:null, tabQuery:'', layers:{showZones:true,showSellers:true,showCtos:true}, mobileAccess:null, mobileConfig:null, lastCode:null, busy:false };
const ic={
  map:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m9 3 0 18m6-18 0 18m-12-9h18"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  package:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-1.88 1.88-.06-.06A1.65 1.65 0 0 0 16 18.4a1.65 1.65 0 0 0-1 .6v.1h-3v-.1a1.65 1.65 0 0 0-2.65-.6l-.07.07-1.87-1.88.06-.06A1.65 1.65 0 0 0 7.6 15a1.65 1.65 0 0 0-.6-1h-.1v-3h.1a1.65 1.65 0 0 0 .6-2.65l-.06-.07 1.88-1.87.06.06A1.65 1.65 0 0 0 10 5.6a1.65 1.65 0 0 0 1-.6v-.1h3v.1a1.65 1.65 0 0 0 2.65.6l.07-.06 1.87 1.88-.06.06A1.65 1.65 0 0 0 18.4 10c.2.4.4.7.6 1h.1v3h-.1c-.2.3-.4.6-.6 1Z"/>',
  activity:'<path d="M2 12h4l3-9 4 18 3-9h6"/>',
  pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
  arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  alert:'<path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6m-5 4a8 8 0 0 0 14 5l3-3m0 6v-6h-6"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  compass:'<circle cx="12" cy="12" r="10"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pulse:'<path d="M2 12h4l3-6 3 12 3-6h7"/>',
  phone:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>'
};
const icon=(name,size=17)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic[name]||ic.map}</svg>`;
const e=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const fmtPrice=v=>v===null||v===undefined?'Não informado':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate=v=>v&&!isNaN(Date.parse(v))?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Não confirmado';
const q=(s)=>document.querySelector(s);
const byId=(id)=>q('#'+id);
function setToast(message,type='ok'){S.toast={message,type};q('#toast')?.remove();const div=document.createElement('div');div.id='toast';div.className=`toast ${type}`;div.textContent=message;document.body.append(div);clearTimeout(setToast.timer);setToast.timer=setTimeout(()=>div.remove(),4800);}
async function request(url,method='GET',data){
  const response=await fetch(url,{method,headers:{...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data!==undefined?JSON.stringify(data):undefined});
  const result=await response.json().catch(()=>({error:'Resposta inválida do servidor.'}));
  if(!response.ok)throw new Error(result.error||`Erro HTTP ${response.status}`);
  return result;
}
async function refresh(draw=false){
  const data=await request('/api/state');S.data=data;
  if(S.page==='mobile'){await loadMobileAccess();if(!draw){render();return;}}
  if(draw)render();else{
    if(S.map)S.map.updateData(data);
    const t=q('[data-live-status]');if(t)t.textContent=data.sellers.some(s=>s.position?.source==='APP PAP' && s.position.fresh)?'APP PAP CONECTADO':data.traccar.connected?'TRACCAR CONECTADO':data.demo?'GPS SIMULADO':'SEM GPS CONECTADO';
    const c=q('[data-sync-time]');if(c)c.textContent=`Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  }
}
const nav=[['map','Visão geral','map'],['team','Vendedores PAP','users'],['territories','Territórios e CTOs','layers'],['plans','Catálogo e regras','package'],['verify','Verificar oferta','shield'],['integration','Integração GPS','settings'],['mobile','Aplicativo PAP','phone']];
const heading={map:['Visão geral da operação','Mapa tático e acompanhamento da equipe PAP'],team:['Equipe em campo','Cadastre e vincule cada vendedor a seu dispositivo GPS'],territories:['Inteligência territorial','Importe polígonos reais e valide a capacidade das CTOs'],plans:['Catálogo comercial','Defina regras de disponibilidade por território'],verify:['Motor de elegibilidade','Simule a oferta para o endereço de instalação'],integration:['Central de integração','Conecte um servidor Traccar sem alterar o ST1 Sales'],mobile:['Aplicativo de campo','Pareamento, jornadas, credenciais e acesso da equipe Android e iPhone']};
function badge(text,kind='neutral'){return `<span class="pill pill-${kind}">${e(text)}</span>`;}
function navHTML(){return `<aside class="sidebar"><div class="brand"><div class="brand-icon">S<span>1</span></div><div class="brand-text"><strong>ST1 SALES</strong><small>FIELD OPERATIONS</small></div></div>
  <div class="side-section">CENTRAL DE CONTROLE</div><nav class="nav-list">${nav.map(([page,name,symbol])=>`<button type="button" class="nav-item ${S.page===page?'active':''}" data-nav="${page}" title="${name}" aria-label="${name}">${icon(symbol,18)}<span>${name}</span>${S.page===page?'<span class="nav-active-mark"></span>':''}</button>`).join('')}</nav>
  <div class="side-footer"><div class="side-dot"></div><div><strong>AMBIENTE DE TESTES</strong><small>Local · Sem integração ST1 Sales</small></div></div></aside>`;}
function headerHTML(){const [title,sub]=heading[S.page];const hasDemo=S.data?.demo;
  return `<div class="topbar"><div class="breadcrumb">ST1 / <span>SALES</span> <span class="crumb-slash">/</span> PAP LAB <span class="env-label">LAB</span></div><div class="top-actions"><div class="connection-dot ${S.data?.traccar.connected?'is-live':''}"></div><span data-live-status>${S.data?.sellers.some(s=>s.position?.source==='APP PAP' && s.position.fresh)?'APP PAP CONECTADO':S.data?.traccar.connected?'TRACCAR CONECTADO':hasDemo?'GPS SIMULADO':'SEM GPS CONECTADO'}</span><div class="top-divider"></div><button type="button" class="icon-button" title="Atualizar informações" data-action="refresh">${icon('refresh')}</button></div></div>
  <div class="page-header"><div><div class="eyebrow">MÓDULO PILOTO • OPERAÇÃO PORTA A PORTA</div><h1>${title}</h1><p>${sub}</p></div><div class="page-date"><span>${new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}</span><small data-sync-time>Dados locais • ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div></div>
  ${hasDemo?`<div class="demo-banner">${icon('alert',17)} <strong>MODO DEMONSTRAÇÃO</strong><span>Vendedores, planos, CTOs e setores identificados como TESTE são fictícios. Nenhum resultado autoriza venda real.</span></div>`:''}`;}
function emptyLine(text,button,navTo){return `<div class="empty-state">${icon('compass',34)}<p>${e(text)}</p>${button?`<button class="btn secondary" data-nav="${navTo}">${e(button)} ${icon('arrow')}</button>`:''}</div>`;}
function summaryCard(title,value,subtitle,symbol,mode=''){return `<div class="stat-card ${mode}"><div class="stat-top"><span>${e(title)}</span>${icon(symbol,19)}</div><div class="stat-value">${e(value)}</div><div class="stat-bottom">${e(subtitle)}</div></div>`;}
function latestEvaluations(limit=4){const logs=(S.data?.evaluations||[]).slice(0,limit);if(!logs.length)return '<div class="empty-compact">Ainda não há verificações registradas neste laboratório.</div>';
  return logs.map(log=>`<div class="activity-row"><span class="activity-dot ${log.status.toLowerCase()}"></span><div class="activity-copy"><strong>Simulação de oferta #${log.id}</strong><small>${e(log.reasons?.[0]||'Sem justificativa')}</small></div><div class="activity-right"><span>${e(log.status.replace('_',' '))}</span><small>${fmtDate(log.created_at)}</small></div></div>`).join('');}
function mapPage(){const d=S.data,sellers=d.sellers,active=sellers.filter(s=>s.active),positioned=active.filter(s=>s.position),fresh=positioned.filter(s=>s.position.fresh);
  const online=fresh.some(s=>s.position.source==='TRACCAR'||s.position.source==='APP PAP');
  return `<div class="stats-grid">
   ${summaryCard('VENDEDORES CADASTRADOS',active.length,'PAP em equipes cadastradas','users')}
   ${summaryCard('LOCALIZAÇÕES RECENTES',fresh.length,online?'GPS real recente do app ou Traccar':d.demo?'Dados simulados identificados':'Sem posições recentes confirmadas','pin')}
   ${summaryCard('TERRITÓRIOS MAPEADOS',d.zones.length,'Polígonos disponíveis para consulta','layers')}
   ${summaryCard('PLANOS NO LABORATÓRIO',d.plans.filter(p=>p.active).length,'Regras locais; sem publicação','shield','accent')}
  </div>
  <div class="map-layout"><section class="card map-card"><div class="card-heading"><div><span class="kicker">GEOVISUALIZAÇÃO</span><h2>Mapa de operações <span class="muted-inline">/ São Luís</span></h2></div><span class="map-live">${d.sellers.some(s=>s.position?.source==='APP PAP' && s.position.fresh)?'● APP PAP':d.demo?'● SIMULAÇÃO':d.traccar.connected?'● TRACCAR':'○ AGUARDANDO GPS'}</span></div>
  <div class="map-toolbar"><label><input type="checkbox" data-layer="showSellers" ${S.layers.showSellers?'checked':''}><span>Vendedores</span></label><label><input type="checkbox" data-layer="showZones" ${S.layers.showZones?'checked':''}><span>Territórios</span></label><label><input type="checkbox" data-layer="showCtos" ${S.layers.showCtos?'checked':''}><span>CTOs</span></label><span class="map-hint">Clique para indicar o endereço de instalação</span></div>
  <div id="operation-map" class="map-viewport"></div>
  <div class="map-footer"><div><span class="legend-key seller"></span> Vendedor <span class="legend-key territory"></span> Território <span class="legend-key cto"></span> CTO</div><div class="map-coord" data-map-coord>${S.selectedPoint?`${S.selectedPoint.lat.toFixed(5)}, ${S.selectedPoint.lon.toFixed(5)}`:'Nenhum ponto de instalação selecionado'}</div></div>
  </section><section class="card team-card"><div class="card-heading compact"><div><span class="kicker">ACOMPANHAMENTO</span><h2>Equipe em campo</h2></div><span class="counter">${active.length}</span></div>
  <div class="team-toolbar"><span>Identificação / última posição</span><button class="subtle-link" data-nav="team">Gerenciar ${icon('arrow',13)}</button></div>
  <div class="team-list">${sellers.length?sellers.map((s,i)=>`<button class="seller-row ${S.selectedSellerId===s.id?'selected':''}" data-seller="${s.id}"><span class="avatar av-${i%4}">${e((s.name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase())}</span><span class="seller-body"><strong>${e(s.name)}</strong><small>${e(s.team)}</small></span><span class="seller-state ${!s.position?'offline':s.position.source==='SIMULADO'?'simulated':s.position.fresh?'online':'stale'}"></span></button>`).join(''):emptyLine('Nenhum vendedor cadastrado.','Cadastrar vendedor','team')}</div>
  <div class="team-detail">${selectedSellerBlock()}</div>
  ${d.demo?`<button class="btn secondary wide" data-action="step">${icon('activity')} Simular próximo deslocamento</button>`:''}
  </section></div>
  <div class="activity-card card"><div class="card-heading compact"><div><span class="kicker">HISTÓRICO DO LABORATÓRIO</span><h2>Últimas decisões de oferta</h2></div><button class="subtle-link" data-nav="verify">Nova simulação ${icon('arrow',14)}</button></div>${latestEvaluations(4)}</div>
  ${!d.demo && !d.zones.length?`<div class="start-banner"><div>${icon('compass',24)}<div><strong>Comece com um cenário totalmente fictício</strong><p>Teste o mapa, vendedores e regras sem criar dados comerciais reais.</p></div></div><button class="btn primary" data-action="demo-load">Carregar cenário de teste ${icon('arrow')}</button></div>`:''}`;
}
function selectedSellerBlock(){const s=S.data.sellers.find(x=>x.id===S.selectedSellerId)||S.data.sellers.find(x=>x.position);if(!s)return '<p class="detail-placeholder">Selecione um vendedor para ver sua identificação e o último sinal GPS.</p>';
  return `<div class="detail-heading">${icon('pin',15)} VENDEDOR SELECIONADO</div><strong>${e(s.name)}</strong><span>${e(s.team)}</span><div class="detail-divider"></div><div class="small-row"><span>Fonte da posição</span><b>${s.position?e(s.position.source):'SEM GPS'}</b></div><div class="small-row"><span>Último registro</span><b>${s.position?fmtDate(s.position.updatedAt):'Não disponível'}</b></div><div class="small-row"><span>Dispositivo Traccar</span><b>${s.traccar_device_id||'Não vinculado'}</b></div>`;}
function teamPage(){const d=S.data;return `<div class="content-grid split"><div class="card padded"><div class="card-heading"><div><span class="kicker">CADASTRO LOCAL</span><h2>Vendedores e dispositivos</h2></div>${badge(`${d.sellers.length} registrados`)}</div>
    <div class="table-wrap"><table><thead><tr><th>Vendedor</th><th>Equipe</th><th>Dispositivo GPS</th><th>Situação</th><th></th></tr></thead><tbody>${d.sellers.map(s=>`<tr><td class="table-primary">${e(s.name)}${s.demo?'<small class="table-sub">DADO FICTÍCIO</small>':''}</td><td>${e(s.team)}</td><td>${s.traccar_device_id?`#${s.traccar_device_id}`:'Não vinculado'}</td><td>${s.position?(s.position.source==='SIMULADO'?badge('Simulado','warning'):s.position.fresh?badge('Recente','success'):badge('Antigo','warning')):badge('Sem GPS')}</td><td><button class="icon-button danger" data-action="seller-delete" data-id="${s.id}" title="Remover vendedor">${icon('trash',15)}</button></td></tr>`).join('')||'<tr><td colspan="5" class="blank-table">Cadastre o primeiro vendedor para iniciar.</td></tr>'}</tbody></table></div>
  </div><div class="card padded"><span class="kicker">NOVO VENDEDOR</span><h2>Vincular colaborador</h2><p class="form-caption">O número do dispositivo é o ID interno exibido no servidor Traccar, não o identificador do aparelho.</p><form id="seller-form" class="stack-form"><label>Nome do vendedor<input name="name" required minlength="2" maxlength="100" placeholder="Nome do colaborador" autocomplete="off"></label><label>Equipe / supervisor<input name="team" required placeholder="Ex.: Equipe Alfa" value="PAP"></label><label>Dispositivo Traccar<select name="traccar_device_id"><option value="">Não vinculado</option>${d.traccar.devices.map(t=>`<option value="${t.id}">${e(t.name)} (#${t.id})</option>`).join('')}</select></label><label>ID manual (caso não apareça acima)<input name="manual_device_id" inputmode="numeric" type="number" min="1" placeholder="Opcional"></label><button class="btn primary wide" type="submit">${icon('plus')} Adicionar vendedor</button></form>
  <div class="micro-note">${icon('lock',15)} Nenhum cadastro é enviado ao ST1 Sales. Salvo apenas em SQLite neste PC.</div></div></div>`;}
function territoryPage(){const d=S.data;return `<div class="content-grid split"><div><div class="card padded"><div class="card-heading"><div><span class="kicker">POLÍGONOS GEOGRÁFICOS</span><h2>Territórios importados</h2></div>${badge(`${d.zones.length} mapeados`)}</div>
   <div class="stack-list">${d.zones.map(z=>`<div class="list-entry"><span class="zone-swatch" style="background:${e(z.color)}"></span><div class="entry-main"><strong>${e(z.name)}</strong><small>${e(z.category)}${z.demo?' • FICTÍCIO':''}</small></div><button class="icon-button danger" data-action="zone-delete" data-id="${z.id}" title="Remover território e CTOs vinculadas">${icon('trash',16)}</button></div>`).join('')||'<div class="empty-compact">Sem áreas cadastradas. Importe um GeoJSON ou KML válido.</div>'}</div></div>
   <div class="card padded section-gap"><div class="card-heading"><div><span class="kicker">CTOs / CAPACIDADE</span><h2>Pontos de atendimento</h2></div>${badge(`${d.ctos.length} CTOs`)}</div>
   <div class="stack-list">${d.ctos.map(c=>`<div class="list-entry"><span class="cto-square ${c.ports_free>0&&c.status==='online'?'good':''}">⌁</span><div class="entry-main"><strong>${e(c.name)}</strong><small>${e(d.zones.find(z=>z.id===c.zone_id)?.name||'')} • ${c.ports_free} porta(s) • ${c.status==='online'?'Operante':'Fora de operação'}</small><small class="verified">${c.verified_at?'Última confirmação: '+fmtDate(c.verified_at):'Capacidade ainda não confirmada'}</small></div><div class="entry-actions">${c.ports_free>0&&c.status==='online'?`<button class="text-action" data-action="cto-verify" data-id="${c.id}" title="Confirmação manual, não consulta IXC">Confirmar</button>`:''}<button class="icon-button danger" data-action="cto-delete" data-id="${c.id}" title="Remover CTO">${icon('trash',15)}</button></div></div>`).join('')||'<div class="empty-compact">Cadastre CTOs para testar a avaliação de capacidade.</div>'}</div></div></div>
   <div><div class="card padded"><span class="kicker">IMPORTAÇÃO TERRITORIAL</span><h2>Adicionar camada geográfica</h2><p class="form-caption">Aceita polígonos GeoJSON ou KML. Importa somente áreas: não consulta nem altera mapas do ST1 Sales.</p><form id="zone-import-form" class="stack-form"><label>Arquivo de polígonos<input name="file" type="file" required accept=".geojson,.json,.kml,application/json,application/vnd.google-earth.kml+xml"></label><button type="submit" class="btn primary wide">${icon('upload')} Importar territórios</button></form><div class="micro-note">${icon('alert',15)} Dados reais precisam ser importados e conferidos. Áreas de demonstração são fictícias.</div></div>
   <div class="card padded section-gap"><span class="kicker">CADASTRO TÉCNICO</span><h2>Adicionar CTO</h2><form id="cto-form" class="stack-form"><label>Nome / código da CTO<input name="name" required placeholder="Código operacional"></label><label>Território<select name="zone_id" required><option value="">Selecione um território</option>${d.zones.map(z=>`<option value="${z.id}">${e(z.name)}</option>`).join('')}</select></label><div class="form-row"><label>Latitude<input name="lat" type="number" min="-90" max="90" step="any" required placeholder="-2.53"></label><label>Longitude<input name="lon" type="number" min="-180" max="180" step="any" required placeholder="-44.28"></label></div><div class="form-row"><label>Portas livres<input name="ports_free" type="number" min="0" step="1" value="0" required></label><label>Estado<select name="status"><option value="online">Operante</option><option value="offline">Fora de operação</option></select></label></div><button class="btn primary wide" type="submit">${icon('plus')} Adicionar CTO</button></form><div class="micro-note">Capacidade nova não é automaticamente confiável: exige confirmação manual explícita, válida por 24h.</div></div></div></div>`;}
function plansPage(){const d=S.data;return `<div class="content-grid split"><div><div class="card padded"><div class="card-heading"><div><span class="kicker">CATÁLOGO DE SIMULAÇÃO</span><h2>Planos cadastrados</h2></div>${badge(`${d.plans.length} itens`)}</div>
    <div class="table-wrap"><table><thead><tr><th>Plano</th><th>Segmento</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>${d.plans.map(p=>`<tr><td class="table-primary">${e(p.name)}${p.demo?'<small class="table-sub">DADO FICTÍCIO</small>':''}</td><td>${e(p.segment)}</td><td>${fmtPrice(p.price)}</td><td>${p.active?badge('Ativo','success'):badge('Suspenso','danger')}</td><td><button class="text-action" data-action="plan-toggle" data-id="${p.id}" data-active="${p.active}">${p.active?'Suspender':'Reativar'}</button><button class="icon-button danger" data-action="plan-delete" data-id="${p.id}" title="Remover plano">${icon('trash',15)}</button></td></tr>`).join('')||'<tr><td colspan="5" class="blank-table">Nenhum plano cadastrado.</td></tr>'}</tbody></table></div></div>
  <div class="card padded section-gap"><div class="card-heading"><div><span class="kicker">AUTORIZAÇÃO GEOGRÁFICA</span><h2>Matriz plano × território</h2></div></div><p class="form-caption">Cada combinação inicia como <strong>Sem regra</strong>. Somente a opção <strong>Permitido</strong> pode liberar uma simulação, se a CTO também estiver válida.</p><div class="table-wrap"><table><thead><tr><th>Território</th>${d.plans.map(p=>`<th title="${e(p.name)}">${e(p.name)}</th>`).join('')}</tr></thead><tbody>${d.zones.map(z=>`<tr><td class="table-primary">${e(z.name)}</td>${d.plans.map(p=>{const rule=d.rules.find(r=>r.zone_id===z.id&&r.plan_id===p.id);return `<td><select class="rule-select" data-rule-zone="${z.id}" data-rule-plan="${p.id}"><option value="clear" ${!rule?'selected':''}>Sem regra</option><option value="allow" ${rule?.decision==='allow'?'selected':''}>Permitido</option><option value="deny" ${rule?.decision==='deny'?'selected':''}>Bloqueado</option></select></td>`;}).join('')}</tr>`).join('')||'<tr><td colspan="9" class="blank-table">Importe áreas para definir as regras.</td></tr>'}</tbody></table></div></div></div>
   <div class="card padded"><span class="kicker">ADICIONAR OFERTA</span><h2>Novo plano local</h2><p class="form-caption">Cadastre somente dados autorizados. O laboratório não atualiza nem publica condições comerciais.</p><form id="plan-form" class="stack-form"><label>Nome do plano<input name="name" required minlength="2" maxlength="100" placeholder="Nome interno do plano"></label><label>Segmento<select name="segment"><option>Residencial</option><option>PME</option><option>Indoor</option></select></label><label>Preço mensal de teste (R$)<input name="price" type="number" min="0" max="100000" step="0.01" placeholder="Opcional"></label><button class="btn primary wide" type="submit">${icon('plus')} Criar plano de teste</button></form>
   <div class="micro-note">${icon('shield',15)} Toda mudança de regra aplica-se somente ao banco local. Integração futura requer API e autorização formal.</div></div></div>`;}
function verifyPage(){const d=S.data,hasPoint=Boolean(S.selectedPoint);const zoneCandidates=hasPoint?d.zones.filter(z=>pointInLocalGeometry(S.selectedPoint,z.geometry)):[];
 return `<div class="verify-grid"><div class="card padded"><span class="kicker">CONSULTA DE ELEGIBILIDADE</span><h2>Simular proposta por endereço</h2><p class="form-caption">Clique no mapa ou informe as coordenadas do local de <strong>instalação</strong> — não a posição do vendedor.</p><form id="verify-form" class="stack-form">
   <div class="form-row"><label>Latitude<input name="lat" type="number" min="-90" max="90" required step="any" value="${hasPoint?S.selectedPoint.lat.toFixed(6):''}" placeholder="-2.53"></label><label>Longitude<input name="lon" type="number" min="-180" max="180" required step="any" value="${hasPoint?S.selectedPoint.lon.toFixed(6):''}" placeholder="-44.28"></label></div>
   <label>Plano a verificar<select name="planId" required><option value="">Selecione o plano</option>${d.plans.map(p=>`<option value="${p.id}" ${S.verifyDraft.planId===String(p.id)?'selected':''}>${e(p.name)}</option>`).join('')}</select></label><label>CTO que atende ao imóvel<select name="ctoId"><option value="">CTO não definida (vai exigir análise)</option>${d.ctos.map(c=>`<option value="${c.id}" ${S.verifyDraft.ctoId===String(c.id)?'selected':''}>${e(c.name)} · ${c.ports_free} porta(s)</option>`).join('')}</select></label><label>Vendedor vinculado (somente contexto)<select name="sellerId"><option value="">Não informado</option>${d.sellers.map(s=>`<option value="${s.id}" ${S.verifyDraft.sellerId===String(s.id)?'selected':''}>${e(s.name)}</option>`).join('')}</select></label>
   <div class="point-warning">${icon('alert',17)} As coordenadas do vendedor nunca substituem o endereço de instalação nem a consulta de rede.</div><button class="btn primary wide" type="submit">${icon('shield')} Verificar elegibilidade</button></form>
   ${S.result?`<div class="result-box ${S.result.status.toLowerCase()}"><div class="result-label">RESULTADO DO MOTOR LOCAL</div><div class="result-status">${S.result.status==='LIBERADO'?icon('check',24):S.result.status==='BLOQUEADO'?icon('x',24):icon('alert',24)}<strong>${e(S.result.status.replace('_',' '))}</strong></div><div class="result-reasons">${S.result.reasons.map(r=>`<p>${e(r)}</p>`).join('')}</div><small>Simulação local • ${fmtDate(S.result.checkedAt)}</small></div>`:''}
   </div><div class="card map-check-card"><div class="card-heading"><div><span class="kicker">REFERÊNCIA ESPACIAL</span><h2>Escolha o ponto da instalação</h2></div></div><div id="operation-map" class="map-viewport verify-map"></div><div class="map-footer"><div>Polígonos: ${d.zones.length}</div><span class="map-coord" data-map-coord>${hasPoint?`${S.selectedPoint.lat.toFixed(5)}, ${S.selectedPoint.lon.toFixed(5)}`:'Clique no mapa'}</span></div>
     <div class="territory-indicator"><span class="kicker">TERRITÓRIO NO PONTO</span><strong>${!hasPoint?'Aguardando seleção':zoneCandidates.length===1?e(zoneCandidates[0].name):zoneCandidates.length>1?'Sobreposição de territórios':'Fora dos polígonos'}</strong></div>
   </div></div>`;}
function pointInLocalGeometry(point,geometry){const ringsOf=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates||[];
  const inside=(ring,lon,lat)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>lat)!==(b[1]>lat) && lon<((b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0]))hit=!hit;}return hit;};
  return ringsOf.some(rs=>rs.length>0&&inside(rs[0],point.lon,point.lat)&&!rs.slice(1).some(r=>inside(r,point.lon,point.lat)));
}
function integrationPage(){const t=S.data.traccar;
 return `<div class="content-grid split"><div><div class="card padded"><span class="kicker">SERVIÇO DE TELEMETRIA</span><h2>Servidor Traccar</h2><div class="integration-status ${t.connected?'good':''}"><span class="status-indicator"></span><div><strong>${t.connected?'Conexão validada':t.configured?'Configuração detectada, sem conexão':'Aguardando configuração'}</strong><small>${e(t.reason)}</small></div></div>
   <div class="info-columns"><div><span class="kicker">DISPOSITIVOS RETORNADOS</span><strong>${t.devices.length}</strong></div><div><span class="kicker">API DO LABORATÓRIO</span><strong>Somente localhost</strong></div><div><span class="kicker">STATUS DE ESCRITA</span><strong>Somente leitura</strong></div></div>
   <h3>Dispositivos disponíveis para vincular</h3><div class="stack-list">${t.devices.map(dev=>`<div class="list-entry"><span class="cto-square good">⌖</span><div class="entry-main"><strong>${e(dev.name)}</strong><small>ID do Traccar: ${dev.id}</small></div>${badge(dev.online?'Online':'Sem sinal',dev.online?'success':'neutral')}</div>`).join('')||'<div class="empty-compact">Nenhum dispositivo retornado. Configure o servidor e atualize o painel.</div>'}</div></div></div>
 <div><div class="card padded"><span class="kicker">CONEXÃO SEGURA</span><h2>Como ligar ao Traccar</h2><div class="setup-step"><span>01</span><p>Instale o <strong>Traccar Server para Windows</strong> e confirme o acesso em <code>http://127.0.0.1:8082</code>.</p></div><div class="setup-step"><span>02</span><p>Crie um usuário e um dispositivo no Traccar. No celular, configure o <strong>Traccar Client</strong> com a URL de envio <code>http://IP-DO-PC:5055</code> (mesma rede), identificador único e permissões de GPS.</p></div><div class="setup-step"><span>03</span><p>Copie <code>.env.example</code> para <code>.env</code> na pasta do PAP Lab. Defina URL e token de acesso, ou credenciais em arquivo local.</p></div><div class="setup-step"><span>04</span><p>Reinicie <code>INICIAR.bat</code>, vincule o ID do dispositivo ao vendedor e confirme a localização recente.</p></div><div class="micro-note">${icon('lock',15)} Nenhuma credencial é enviada ao navegador nem embutida no pacote. O servidor Traccar não recebe comandos de liberação de planos.</div></div>
 <div class="card padded section-gap"><span class="kicker">GESTÃO DO LABORATÓRIO</span><h2>Dados e demonstração</h2><p class="form-caption">Os dados ficam no arquivo <code>data/pap-lab.sqlite</code> do seu PC. O backup JSON permite inspecionar o conteúdo.</p><div class="button-stack"><button class="btn secondary wide" data-action="export">${icon('download')} Exportar registros locais</button>${S.data.demo?`<button class="btn danger-outline wide" data-action="demo-clear">${icon('trash')} Remover dados fictícios</button>`:`<button class="btn secondary wide" data-action="demo-load">${icon('plus')} Carregar cenário de teste (se vazio)</button>`}</div></div></div></div>`;}
async function loadMobileAccess(){
  const [access,config]=await Promise.all([request('/api/mobile/access'),request('/api/mobile/config')]);
  S.mobileAccess=access;S.mobileConfig=config;
}
function mobilePage(){
  const acc=S.mobileAccess||{pairings:[],tokens:[]},conf=S.mobileConfig||{port:4174,lan:false,tls:false};
  const real=S.data.sellers.filter(s=>s.active&&!s.demo);
  const pending=acc.pairings.filter(p=>!p.redeemed_at&&!p.cancelled_at&&Date.parse(p.expires_at)>Date.now());
  const active=acc.tokens.filter(t=>!t.revoked_at&&Date.parse(t.expires_at)>Date.now());
  const rowCard=(items,token)=>items.map(x=>`<div class="access-row"><div><strong>${e(x.name)}</strong><small>${e(x.role==='supervisor'?'Supervisor':'Vendedor')} • ${token?'credencial ativa':`código até ${fmtDate(x.expires_at)}`} • ${e(String(x.id))}</small></div><button class="btn danger-outline" data-action="${token?'mobile-revoke':'mobile-cancel'}" data-id="${x.id}">${token?'Revogar':'Cancelar'}</button></div>`).join('');
  return `<div class="content-grid split mobile-access-grid"><div class="card padded"><span class="kicker">CADASTRO DE DISPOSITIVOS</span><h2>Ativar o app PAP</h2><p class="form-caption">Crie o vendedor na aba Vendedores PAP; depois gere um código temporário para abrir o aplicativo Android ou iPhone. O mesmo app apresenta recursos adicionais ao supervisor.</p>
   <form id="pairing-form" class="stack-form"><label>Profissional cadastrado<select name="sellerId" required><option value="">Selecione</option>${real.map(s=>`<option value="${s.id}">${e(s.name)} • ${e(s.team)}</option>`).join('')}</select></label><label>Perfil do aplicativo<select name="role"><option value="seller">Vendedor PAP</option><option value="supervisor">Supervisor PAP</option></select></label>
   <button class="btn primary wide" ${!real.length?'disabled':''} type="submit">${icon('phone')} Gerar código de pareamento</button></form>
   ${!real.length?`<div class="micro-note">Crie primeiro um vendedor real em Vendedores PAP. Personagens TESTE não podem receber acesso ao app.</div>`:''}
   ${S.lastCode?`<div class="mobile-code"><span class="kicker">CÓDIGO TEMPORÁRIO • EXIBIDO UMA VEZ</span><strong>${e(S.lastCode.code)}</strong><small>Usar até ${fmtDate(S.lastCode.expiresAt)}. Envie somente ao usuário do aparelho autorizado.</small><button class="btn secondary" data-action="mobile-copy">${icon('download')} Copiar código</button></div>`:''}
   <div class="section-gap"><span class="kicker">CÓDIGOS PENDENTES</span><h3>${pending.length} códigos aguardando vínculo</h3>${rowCard(pending,false)||'<p class="form-caption">Nenhum código pendente.</p>'}</div>
   </div><div><div class="card padded"><span class="kicker">SERVIÇO CENTRAL</span><h2>API dos celulares</h2>
   <div class="integration-status ${conf.lan?'good':''}"><span class="status-indicator"></span><div><strong>${conf.lan?'Teste LAN habilitado':'Somente no computador'}</strong><small>Porta ${e(conf.port)} • ${conf.tls?'HTTPS':'HTTP de homologação'} • ${conf.lan?'disponível na rede local':'acesso remoto desativado'}</small></div></div>
   <div class="setup-step"><span>01</span><p>Windows: copie <code>.env.example</code> para <code>.env</code> e informe <code>PAP_MOBILE_LAN=1</code> para testes na mesma rede.</p></div>
   <div class="setup-step"><span>02</span><p>Encontre o IP do PC usando <code>ipconfig</code>. No aplicativo, configure <code>http://IP-DO-PC:${e(conf.port)}</code> apenas para dados fictícios em LAN; para GPS real remoto, use HTTPS.</p></div>
   <div class="setup-step"><span>03</span><p>Abra o aplicativo e digite o código. Inicie a jornada somente com permissão e dispositivo de teste.</p></div>
   <div class="micro-note">${icon('lock',15)} A API móvel não expõe este painel administrativo. Tokens são armazenados somente como hash no servidor.</div>
   </div><div class="card padded section-gap"><span class="kicker">CREDENCIAIS DE APP</span><h2>Dispositivos pareados</h2>${rowCard(active,true)||'<p class="form-caption">Ainda não existe aparelho pareado.</p>'}</div></div></div>`;
}
function render(){if(!S.data)return;
  if(S.map){S.map.destroy();S.map=null;}
  const current={map:mapPage,team:teamPage,territories:territoryPage,plans:plansPage,verify:verifyPage,integration:integrationPage,mobile:mobilePage}[S.page]();
  app.innerHTML=`${navHTML()}<div class="app-shell"><main class="workspace">${headerHTML()}${current}<footer class="app-footer"><span>ST1 SALES / PAP LAB • BUILD 0.2.0</span><span>AMBIENTE LOCAL — NÃO AUTORIZA VENDAS REAIS</span></footer></main></div>`;
  const viewport=q('#operation-map');if(viewport){
    S.map=new OperationMap(viewport,{selectedPoint:S.selectedPoint,onPick:(point)=>{S.selectedPoint=point;S.result=null;q('.result-box')?.remove();const coord=q('[data-map-coord]');if(coord)coord.textContent=`${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
      const lat=q('input[name="lat"]'),lon=q('input[name="lon"]');if(lat)lat.value=point.lat.toFixed(6);if(lon)lon.value=point.lon.toFixed(6);
      const terr=q('.territory-indicator strong');if(terr){const hits=S.data.zones.filter(z=>pointInLocalGeometry(point,z.geometry));terr.textContent=hits.length===1?hits[0].name:hits.length>1?'Sobreposição de territórios':'Fora dos polígonos';}
      if(S.page==='map')setToast('Ponto de instalação selecionado. Vá a Verificar oferta.');
    },onSeller:(id)=>{S.selectedSellerId=id;const node=q('.team-detail');if(node)node.innerHTML=selectedSellerBlock();q('.seller-row.selected')?.classList.remove('selected');q(`[data-seller="${id}"]`)?.classList.add('selected');},onCto:(id)=>setToast(`CTO ${S.data.ctos.find(c=>c.id===id)?.name||id} selecionada no mapa.`)});
    S.map.updateData(S.data);
    for(const [key,val] of Object.entries(S.layers))S.map.setLayer(key,val);
  }
}
async function act(fn){if(S.busy)return;S.busy=true;try{await fn();}catch(err){setToast(err.message||'Falha na operação.','error');}finally{S.busy=false;}}
function confirmAction(text){return window.confirm(text);}
async function handleAction(action,element){
  switch(action){
    case 'refresh':await refresh(true);setToast('Informações atualizadas.');break;
    case 'mobile-copy':if(S.lastCode){await navigator.clipboard.writeText(S.lastCode.code);setToast('Código copiado para área de transferência.');}break;
    case 'mobile-cancel':if(!confirmAction('Cancelar este código de pareamento?'))return;await request('/api/mobile/pairings/'+element.dataset.id+'/cancel','POST');S.lastCode=null;await refresh(true);setToast('Código cancelado.');break;
    case 'mobile-revoke':if(!confirmAction('Revogar o acesso deste dispositivo imediatamente?'))return;await request('/api/mobile/tokens/'+element.dataset.id+'/revoke','POST');await refresh(true);setToast('Acesso do dispositivo revogado.');break;
    case 'demo-load':await request('/api/demo/load','POST');S.selectedPoint={lat:-2.537,lon:-44.299};S.result=null;S.page='map';await refresh(true);setToast('Cenário fictício pronto para validação.');break;
    case 'step':await request('/api/demo/step','POST');await refresh(false);setToast('Vendedores fictícios foram movimentados no mapa.');break;
    case 'demo-clear':if(!confirmAction('Remover somente todos os dados de DEMONSTRAÇÃO? Essa ação não pode ser desfeita.'))return;await request('/api/demo/clear','POST');S.selectedPoint=null;S.result=null;await refresh(true);setToast('Registros fictícios removidos.');break;
    case 'seller-delete':if(!confirmAction('Remover este vendedor do laboratório?'))return;await request('/api/sellers/'+element.dataset.id,'DELETE');await refresh(true);setToast('Vendedor removido do laboratório.');break;
    case 'zone-delete':if(!confirmAction('Remover este território, suas regras e TODAS as CTOs vinculadas?'))return;await request('/api/zones/'+element.dataset.id,'DELETE');await refresh(true);setToast('Território e vínculos removidos.');break;
    case 'cto-delete':if(!confirmAction('Remover CTO do laboratório?'))return;await request('/api/ctos/'+element.dataset.id,'DELETE');await refresh(true);setToast('CTO removida.');break;
    case 'cto-verify':if(!confirmAction('Confirma que checou manualmente as portas desta CTO agora? Não foi realizada consulta ao IXC.'))return;await request('/api/ctos/'+element.dataset.id+'/verify','POST');await refresh(true);setToast('Capacidade confirmada manualmente por até 24h.');break;
    case 'plan-toggle':await request('/api/plans/'+element.dataset.id,'PATCH',{active:element.dataset.active!=='1'});await refresh(true);setToast('Estado do plano atualizado no laboratório.');break;
    case 'plan-delete':if(!confirmAction('Remover este plano e todas as regras de elegibilidade associadas?'))return;await request('/api/plans/'+element.dataset.id,'DELETE');await refresh(true);setToast('Plano removido.');break;
    case 'export':{const a=document.createElement('a');a.href='/api/export';a.download='st1-pap-lab-backup.json';document.body.append(a);a.click();a.remove();setToast('Exportação local iniciada.');break;}
  }
}
function coordsFromKml(raw){
  const xml=new DOMParser().parseFromString(raw,'application/xml');if(xml.querySelector('parsererror'))throw new Error('KML inválido.');
  const placemarks=[...xml.querySelectorAll('Placemark')];const features=[];
  function ring(el){const t=el?.querySelector('coordinates')?.textContent?.trim();if(!t)return null;const pts=t.split(/\s+/).map(i=>i.split(',').slice(0,2).map(Number));if(!pts.length)return null;if(pts[0][0]!==pts.at(-1)[0]||pts[0][1]!==pts.at(-1)[1])pts.push([...pts[0]]);return pts;}
  placemarks.forEach(pm=>{
    pm.querySelectorAll('Polygon').forEach(poly=>{
      const outside=ring(poly.querySelector('outerBoundaryIs'));if(!outside)return;
      const holes=[...poly.querySelectorAll('innerBoundaryIs')].map(ring).filter(Boolean);
      features.push({type:'Feature',properties:{name:pm.querySelector('name')?.textContent?.trim()||'Território KML'},geometry:{type:'Polygon',coordinates:[outside,...holes]}});
    });
  });
  if(!features.length)throw new Error('Nenhum polígono encontrado no KML.');
  return {type:'FeatureCollection',features};
}
app.addEventListener('click',event=>{
  const target=event.target.closest('[data-nav], [data-action], [data-seller]');if(!target)return;
  if(target.dataset.nav){S.page=target.dataset.nav;S.result=null;if(S.page==='mobile'){act(async()=>{await loadMobileAccess();render();window.scrollTo(0,0);});}else{render();window.scrollTo(0,0);}return;}
  if(target.dataset.seller){const seller=S.data.sellers.find(s=>s.id===Number(target.dataset.seller));S.selectedSellerId=seller?.id||null;
    if(seller?.position&&S.map)S.map.moveTo(seller.position.lat,seller.position.lon,15);
    const detail=q('.team-detail');if(detail)detail.innerHTML=selectedSellerBlock();q('.seller-row.selected')?.classList.remove('selected');target.classList.add('selected');return;}
  if(target.dataset.action)act(()=>handleAction(target.dataset.action,target));
});
app.addEventListener('change',event=>{
  const target=event.target;if(target.dataset.layer){S.layers[target.dataset.layer]=target.checked;S.map?.setLayer(target.dataset.layer,target.checked);}
  if(target.closest('#verify-form')){
    S.verifyDraft={planId:q('#verify-form select[name="planId"]')?.value||'',ctoId:q('#verify-form select[name="ctoId"]')?.value||'',sellerId:q('#verify-form select[name="sellerId"]')?.value||''};
    S.result=null;q('.result-box')?.remove();
  }
  if(target.dataset.ruleZone){act(async()=>{await request('/api/rules','PUT',{zone_id:Number(target.dataset.ruleZone),plan_id:Number(target.dataset.rulePlan),decision:target.value});await refresh(true);setToast('Regra geográfica alterada no banco local.');});}
});
app.addEventListener('input',event=>{if(event.target.closest('#verify-form')){S.result=null;q('.result-box')?.remove();}});
app.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;act(async()=>{
    const f=new FormData(form);
    if(form.id==='pairing-form'){
      const result=await request('/api/mobile/pairings','POST',{sellerId:Number(f.get('sellerId')),role:f.get('role')});
      S.lastCode={code:result.code,expiresAt:result.expiresAt};await refresh(true);setToast('Código temporário gerado. Não compartilhe publicamente.');
    }else if(form.id==='seller-form'){
      await request('/api/sellers','POST',{name:f.get('name'),team:f.get('team'),traccar_device_id:f.get('manual_device_id')||f.get('traccar_device_id')||null});
      await refresh(true);setToast('Vendedor cadastrado com sucesso.');
    }else if(form.id==='plan-form'){
      await request('/api/plans','POST',{name:f.get('name'),segment:f.get('segment'),price:f.get('price')||null});await refresh(true);setToast('Plano adicionado ao catálogo local.');
    }else if(form.id==='cto-form'){
      await request('/api/ctos','POST',{name:f.get('name'),zone_id:Number(f.get('zone_id')),lat:Number(f.get('lat')),lon:Number(f.get('lon')),ports_free:Number(f.get('ports_free')),status:f.get('status')});await refresh(true);setToast('CTO cadastrada. Confirme a capacidade após verificação.');
    }else if(form.id==='verify-form'){
      const lat=Number(f.get('lat')),lon=Number(f.get('lon'));
      S.selectedPoint={lat,lon};
      S.verifyDraft={planId:String(f.get('planId')||''),ctoId:String(f.get('ctoId')||''),sellerId:String(f.get('sellerId')||'')};
      S.result=await request('/api/evaluate','POST',{lat,lon,planId:Number(f.get('planId')),ctoId:f.get('ctoId')?Number(f.get('ctoId')):null,sellerId:f.get('sellerId')?Number(f.get('sellerId')):null});
      await refresh(true);setToast('Verificação concluída no motor local.');
    }else if(form.id==='zone-import-form'){
      const file=f.get('file');if(!(file instanceof File)||!file.size)throw new Error('Selecione o arquivo para importar.');
      if(file.size>2_000_000)throw new Error('Arquivo muito grande. Limite 2 MB.');
      const content=await file.text();let geo;
      if(file.name.toLowerCase().endsWith('.kml'))geo=coordsFromKml(content);
      else{try{geo=JSON.parse(content);}catch{throw new Error('GeoJSON inválido.');}}
      const result=await request('/api/zones/import','POST',geo);await refresh(true);setToast(`${result.count} território(s) importado(s) com sucesso.`);
    }
  });
});
(async()=>{try{await refresh(true);}catch(error){app.innerHTML=`<div class="fatal"><h1>Não foi possível iniciar o PAP Lab</h1><p>${e(error.message)}</p><p>Confira se o servidor local está ativo em <code>http://127.0.0.1:4173</code>.</p><button onclick="location.reload()">Tentar novamente</button></div>`;}})();
setInterval(()=>{if(!S.busy&&S.data)refresh(false).catch(()=>{})},15000);
