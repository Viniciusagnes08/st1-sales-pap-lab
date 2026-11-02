import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../web-preview/api/sales.js';
async function run(fetcher,{method='GET',url='/api/sales?action=users',headers={},body}={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};
 await createHandler(fetcher)({method,url,headers,body},res);return res;
}
test('Sales proxy rejects anonymous requests and arbitrary targets',async()=>{
 const fetcher=()=>{throw Error('Must not call upstream');};
 assert.equal((await run(fetcher)).statusCode,401);
 assert.equal((await run(fetcher,{url:'/api/sales?action=https://evil.test'})).statusCode,404);
 assert.equal((await run(fetcher,{method:'DELETE'})).statusCode,405);
});
test('login rejects cross-origin and never returns tokens to JavaScript',async()=>{
 const request={method:'POST',url:'/api/sales?action=login',headers:{origin:'https://pap.test',host:'pap.test','content-type':'application/json'},body:{email:'test@example.com',senha:'test-password'}};
 const fetcher=async(url,options)=>{assert.equal(url,'https://st1sales.com.br/api/auth/login');assert.equal(options.redirect,'error');return {ok:true,json:async()=>({access_token:'test-token',refresh_token:'never-return',usuario:{id:1}})};};
 const ok=await run(fetcher,request);assert.equal(ok.statusCode,200);assert.deepEqual(ok.body,{ok:true});assert.match(ok.headers['Set-Cookie'],/Secure; HttpOnly; SameSite=Strict/);
 const denied=await run(()=>{throw Error('not called');},{...request,headers:{...request.headers,origin:'https://evil.test'}});assert.equal(denied.statusCode,403);
});
test('read uses only requesting user token and removes credential fields',async()=>{
 const response=await run(async(url,options)=>{assert.equal(String(url),'https://st1sales.com.br/api/usuarios/');assert.equal(options.headers.Authorization,'Bearer personal-token');return {ok:true,json:async()=>[{id:1,nome:'Example',senha_hash:'secret',nested:{access_token:'secret'}}]};},{headers:{cookie:'__Host-pap_sales=personal-token'}});
 assert.equal(response.statusCode,200);assert.deepEqual(response.body.data,[{id:1,nome:'Example',nested:{}}]);assert.match(response.headers['Cache-Control'],/no-store/);
});
test('revoked sessions clear cookie and never fall back to privileged identity',async()=>{
 const r=await run(async()=>({ok:false,status:401}),{headers:{cookie:'__Host-pap_sales=revoked'}});assert.equal(r.statusCode,401);assert.match(r.headers['Set-Cookie'],/Max-Age=0/);
});
test('invalid coordinates do not reach Sales and write routes remain closed',async()=>{
 const fetcher=()=>{throw Error('not called');};
 assert.equal((await run(fetcher,{url:'/api/sales?action=feasibility&latitude=&longitude=-44',headers:{cookie:'__Host-pap_sales=x'}})).statusCode,400);
 assert.equal((await run(fetcher,{method:'POST',url:'/api/sales?action=users',headers:{origin:'https://pap.test',host:'pap.test'}})).statusCode,405);
});
test('upstream timeouts return a controlled error without sensitive details',async()=>{
 const r=await run(async()=>{throw Error('secret upstream detail');},{headers:{cookie:'__Host-pap_sales=x'}});assert.equal(r.statusCode,502);assert.ok(!JSON.stringify(r.body).includes('secret'));
});
