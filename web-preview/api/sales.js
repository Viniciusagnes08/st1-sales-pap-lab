const BASE = 'https://st1sales.com.br/api';
const COOKIE = '__Host-pap_sales';
const routes = Object.freeze({me:'/auth/me',users:'/usuarios/',prospects:'/prospeccoes',deals:'/negociacoes',ctos:'/viabilidade/ctos',regions:'/viabilidade/regionais',cities:'/viabilidade/cidades',options:'/kmz/opcoes',feasibility:'/viabilidade/consultar',installation:'/bairros/taxa-instalacao',stats:'/dashboard/stats'});
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value!=='object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!/(senha|password|token|secret|cpf|cnpj|rg$)/i.test(key)).map(([k,v])=>[k,clean(v)]));
}
export function createHandler(fetcher=fetch) { return async function handler(req,res) {
  const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));};
  const cookie=(value,age=3600)=>res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`);
  try {
    const url=new URL(req.url,'https://pap.invalid');const action=url.searchParams.get('action')||'me';
    if(!['GET','POST'].includes(req.method))return send(405,{error:'Método não permitido.'});
    if(req.method==='POST') {
      const origin=req.headers.origin; const host=req.headers.host;
      if(!origin || origin!==`https://${host}`)return send(403,{error:'Origem não autorizada.'});
      if(action==='logout'){cookie('',0);return send(200,{ok:true});}
      if(action!=='login')return send(405,{error:'Escrita não habilitada para este recurso.'});
      if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Envie JSON.'});
      let body=req.body;
      if(body===undefined){let text='';for await(const part of req){text+=part;if(text.length>4096)return send(413,{error:'Requisição muito grande.'});}body=JSON.parse(text);}
      if(typeof body==='string'){if(body.length>4096)return send(413,{error:'Requisição muito grande.'});body=JSON.parse(body);}
      if(!body || typeof body.email!=='string'||typeof body.senha!=='string'||body.email.length>254||!body.email.includes('@')||!body.senha||body.senha.length>512)return send(400,{error:'Informe e-mail e senha do Sales.'});
      const upstream=await fetcher(BASE+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({email:body.email,senha:body.senha}),redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!upstream.ok)return send(upstream.status===429?429:401,{error:upstream.status===429?'Muitas tentativas. Aguarde para tentar novamente.':'O Sales não autorizou o login. Verifique suas credenciais.'});
      const payload=await upstream.json();
      if(typeof payload.access_token!=='string'||payload.access_token.length>3500)return send(502,{error:'Resposta de autenticação incompatível.'});
      cookie(payload.access_token);return send(200,{ok:true});
    }
    if(!routes[action])return send(404,{error:'Recurso não disponível.'});
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if(!token)return send(401,{error:'Entre com sua conta Sales.'});
    const target=new URL(BASE+routes[action]);
    if(action==='feasibility'){
      const lat=url.searchParams.get('latitude'),lon=url.searchParams.get('longitude');
      if(!lat||!lon||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||Math.abs(Number(lat))>90||Math.abs(Number(lon))>180)return send(400,{error:'Coordenadas inválidas.'});
      target.searchParams.set('latitude',lat);target.searchParams.set('longitude',lon);
    }
    if(action==='installation'){const name=url.searchParams.get('nome')?.trim();if(!name||name.length>150)return send(400,{error:'Informe o bairro.'});target.searchParams.set('nome',name);}
    const upstream=await fetcher(target,{headers:{Authorization:`Bearer ${decodeURIComponent(token)}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!upstream.ok){if(upstream.status===401)cookie('',0);return send([400,401,403,404,429].includes(upstream.status)?upstream.status:502,{error:upstream.status===403?'Seu perfil Sales não tem acesso a este recurso.':upstream.status===401?'Sua sessão expirou. Entre novamente.':'O Sales não conseguiu responder a esta consulta.'});}
    return send(200,{source:'ST1 Sales',fetchedAt:new Date().toISOString(),data:clean(await upstream.json())});
  } catch(error) {return send(error instanceof SyntaxError?400:502,{error:error instanceof SyntaxError?'Formato de dados inválido.':'Não foi possível consultar o Sales. Tente novamente.'});}
};}
export default createHandler();
