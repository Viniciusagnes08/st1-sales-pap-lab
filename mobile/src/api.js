import * as SecureStore from 'expo-secure-store';

export const STORAGE_KEY = 'pap_homolog_auth_v2';
export function normalizeServer(input){
  const text=String(input||'').trim().replace(/\/+$/,'');
  let url;try{url=new URL(text);}catch{throw new Error('Informe a URL completa da API, incluindo http:// ou https://.');}
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('A URL deve conter somente o servidor e a porta.');
  const hostname=url.hostname.toLowerCase();
  const local=/^(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(hostname);
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&local))throw new Error('Para acesso remoto, a API precisa ter HTTPS. HTTP só é permitido na rede local de testes.');
  return url.origin;
}
export async function readSavedSession(){
  const raw=await SecureStore.getItemAsync(STORAGE_KEY);
  if(!raw)return null;
  try{return JSON.parse(raw);}catch{return null;}
}
export async function saveSession(session){await SecureStore.setItemAsync(STORAGE_KEY,JSON.stringify(session));}
export async function clearSession(){await SecureStore.deleteItemAsync(STORAGE_KEY);}
export async function mobileRequest(apiUrl,route,{token,method='GET',data}={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(`${normalizeServer(apiUrl)}/mobile/v1/${route}`,{
      method,signal:controller.signal,
      headers:{...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},
      ...(data!==undefined?{body:JSON.stringify(data)}:{})
    });
    const result=await response.json().catch(()=>({error:'Resposta inválida da API.'}));
    if(!response.ok){const err=new Error(result.error||`Erro HTTP ${response.status}`);err.status=response.status;throw err;}
    return result;
  }catch(error){
    if(error.name==='AbortError')throw new Error('API indisponível. Confira a conexão e a URL configurada.');
    throw error;
  }finally{clearTimeout(timeout);}
}
export function positionPayload(location){
  return {
    lat:location.coords.latitude,lon:location.coords.longitude,
    accuracy:Number.isFinite(location.coords.accuracy)?location.coords.accuracy:5000,
    recordedAt:new Date(location.timestamp||Date.now()).toISOString()
  };
}
