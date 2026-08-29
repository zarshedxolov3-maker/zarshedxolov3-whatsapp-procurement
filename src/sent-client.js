import { createHash } from 'node:crypto';

export function deterministicIdempotencyKey(operation,businessRef) {
  if(!/^[a-z][a-z0-9_.-]{1,63}$/.test(operation) || typeof businessRef!=='string' || !businessRef) throw new Error('invalid stable identifiers');
  return `tradebay_${createHash('sha256').update(`${operation}:${businessRef}`).digest('hex')}`;
}

export class SentClient {
  constructor({store,apiKey,profileId,fetchImpl=fetch}) { this.store=store; this.apiKey=apiKey; this.profileId=profileId; this.fetch=fetchImpl; }
  async mutate({operation,businessRef,url,body,reconcile}) {
    const key=deterministicIdempotencyKey(operation,businessRef);
    const existing=this.store.reserveMutation(key,operation,createHash('sha256').update(businessRef).digest('hex'));
    if(existing.state==='succeeded') return {state:'succeeded',reused:true,resultRef:existing.result_ref};
    if(existing.state==='unknown') {
      const resolved=await reconcile(key);
      if(resolved) { this.store.finishMutation(key,'succeeded',resolved); return {state:'succeeded',reconciled:true,resultRef:resolved}; }
    }
    try {
      const headers={'content-type':'application/json','x-api-key':this.apiKey,'idempotency-key':key};
      if(this.profileId) headers['x-profile-id']=this.profileId;
      const response=await this.fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error('sent mutation rejected');
      const resultRef=response.headers.get('x-request-id') ?? createHash('sha256').update(await response.text()).digest('hex');
      this.store.finishMutation(key,'succeeded',resultRef);
      return {state:'succeeded',resultRef};
    } catch (error) {
      if(error?.name==='TimeoutError' || error?.name==='AbortError') this.store.finishMutation(key,'unknown');
      else this.store.finishMutation(key,'failed');
      throw new Error('sent mutation failed');
    }
  }
}
