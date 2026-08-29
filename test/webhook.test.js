import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { webhookHandler } from '../src/webhook.js';
import { deterministicIdempotencyKey, SentClient } from '../src/sent-client.js';

const secretBytes=Buffer.alloc(32,7); const secret=`whsec_${secretBytes.toString('base64')}`; const now=1_800_000_000;
function signed(body,{id='evt_test',ts=now,changeSig=false}={}){
  const raw=Buffer.from(body); const sig=createHmac('sha256',secretBytes).update(Buffer.from(`${id}.${ts}.`)).update(raw).digest('base64');
  return {'x-webhook-id':id,'x-webhook-timestamp':String(ts),'x-webhook-signature':`v1,${changeSig?Buffer.alloc(32,8).toString('base64'):sig}`,'content-type':'application/json'};
}
async function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'tradebay-')); const store=new Store(join(dir,'db.sqlite'));
  const handler=webhookHandler({store,secret:()=>secret,now:()=>now,maxBytes:1024});
  const server=createServer(handler); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  return {store,url,close:async()=>{await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}};
}
const valid=JSON.stringify({type:'message.received',data:{message:{id:'m-private',text:{body:'iPhone 16 Pro 256GB black eSIM qty 2 USD 999 not activated'}},from:'private-number'}});

test('security, schema, dedupe and storage behavior',async()=>{const f=await fixture();try{
  let r=await fetch(f.url,{method:'POST',headers:signed(valid),body:valid});assert.equal(r.status,200);
  r=await fetch(f.url,{method:'POST',headers:signed(valid),body:valid});assert.equal(r.status,200);assert.deepEqual(f.store.counts(),{events:1,actions:1,outbox:1});
  for(const [body,headers] of [[valid,signed(valid,{changeSig:true})],[valid,signed(valid,{ts:now-301})],[valid,signed(valid,{ts:now+31})],[valid,{}],[valid,{...signed(valid),'x-webhook-signature':'v1,%%%'}]]){
    r=await fetch(f.url,{method:'POST',headers,body});assert.equal(r.status,401);assert.equal(await r.text(),'{"error":"Unauthorized"}');
  }
  const changed=valid+' '; r=await fetch(f.url,{method:'POST',headers:signed(valid),body:changed});assert.equal(r.status,401);
  const bad='{'; r=await fetch(f.url,{method:'POST',headers:signed(bad),body:bad});assert.equal(r.status,400);assert.equal(await r.text(),'{"error":"Bad Request"}');
  const schema=JSON.stringify({type:'message.received',data:{}});r=await fetch(f.url,{method:'POST',headers:signed(schema),body:schema});assert.equal(r.status,400);
  const huge='x'.repeat(1025);r=await fetch(f.url,{method:'POST',headers:signed(huge),body:huge});assert.equal(r.status,401);
}finally{await f.close();}});

test('concurrent duplicates have exactly one side effect',async()=>{const f=await fixture();try{
  const rs=await Promise.all(Array.from({length:12},()=>fetch(f.url,{method:'POST',headers:signed(valid),body:valid})));assert.ok(rs.every(r=>r.status===200));assert.deepEqual(f.store.counts(),{events:1,actions:1,outbox:1});
}finally{await f.close();}});

test('storage failure is 5xx and retry later is exactly once',async()=>{const dir=mkdtempSync(join(tmpdir(),'tradebay-'));const real=new Store(join(dir,'db.sqlite'));let fail=true;
  const store={persistEvent:e=>{if(fail){fail=false;throw new Error('private');}return real.persistEvent(e);}};const server=createServer(webhookHandler({store,secret:()=>secret,now:()=>now}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
  try{let r=await fetch(url,{method:'POST',headers:signed(valid),body:valid});assert.equal(r.status,503);r=await fetch(url,{method:'POST',headers:signed(valid),body:valid});assert.equal(r.status,200);assert.deepEqual(real.counts(),{events:1,actions:1,outbox:1});}finally{await new Promise(r=>server.close(r));real.close();rmSync(dir,{recursive:true,force:true});}
});

test('deterministic idempotency key is reused and unknown outcome reconciled',async()=>{const dir=mkdtempSync(join(tmpdir(),'tradebay-'));const store=new Store(join(dir,'db.sqlite'));try{
  const calls=[];const fetchImpl=async(_u,o)=>{calls.push(o.headers['idempotency-key']);const e=new Error('timeout');e.name='TimeoutError';throw e;};const c=new SentClient({store,apiKey:'runtime-only',fetchImpl});
  await assert.rejects(()=>c.mutate({operation:'create_webhook',businessRef:'production',url:'https://example.invalid',body:{},reconcile:async()=>null}));
  const expected=deterministicIdempotencyKey('create_webhook','production');let reconciled=false;const c2=new SentClient({store,apiKey:'runtime-only',fetchImpl:async()=>{throw new Error('must not resend');}});
  const result=await c2.mutate({operation:'create_webhook',businessRef:'production',url:'https://example.invalid',body:{},reconcile:async key=>{reconciled=key===expected;return 'existing-result';}});
  assert.equal(calls[0],expected);assert.equal(reconciled,true);assert.equal(result.reconciled,true);
}finally{store.close();rmSync(dir,{recursive:true,force:true});}});
