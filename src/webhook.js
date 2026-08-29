import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const AUTH_BODY = Buffer.from('{"error":"Unauthorized"}');
const BAD_BODY = Buffer.from('{"error":"Bad Request"}');
const OK_BODY = Buffer.from('{"ok":true}');
const SUPPORTED = new Set(['message.received','message.delivered','message.read','message.failed','message.filtered','message.blocked']);

function reply(res, status, body) {
  res.writeHead(status, {'content-type':'application/json','content-length':String(body.length),'cache-control':'no-store'});
  res.end(body);
}
function oneRawHeader(req, name) {
  const values=[];
  for(let i=0;i<req.rawHeaders.length;i+=2) if(req.rawHeaders[i].toLowerCase()===name) values.push(req.rawHeaders[i+1]);
  return values.length===1 ? values[0] : null;
}
function decodeSecret(value) {
  if(typeof value!=='string' || !value.startsWith('whsec_')) return null;
  const encoded=value.slice(6);
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length%4!==0) return null;
  const decoded=Buffer.from(encoded,'base64');
  if(decoded.length!==32 || decoded.toString('base64')!==encoded) return null;
  return decoded;
}
function decodeCandidate(value) {
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length%4!==0) return null;
  const decoded=Buffer.from(value,'base64');
  return decoded.length===32 && decoded.toString('base64')===value ? decoded : null;
}
function authenticate(req, raw, now, secretValue) {
  const id=oneRawHeader(req,'x-webhook-id');
  const timestamp=oneRawHeader(req,'x-webhook-timestamp');
  const signature=oneRawHeader(req,'x-webhook-signature');
  if(id===null || timestamp===null || signature===null) return false;
  if(!/^[!-~]{1,256}$/.test(id) || !/^[0-9]{1,10}$/.test(timestamp)) return false;
  const seconds=Number(timestamp);
  if(!Number.isSafeInteger(seconds) || seconds>now+30 || now-seconds>300) return false;
  const secret=decodeSecret(secretValue);
  if(!secret) return false;
  const expected=createHmac('sha256',secret).update(Buffer.from(`${id}.${timestamp}.`)).update(raw).digest();
  const tokens=signature.split(' ');
  if(tokens.length===0 || tokens.some(t=>t.length===0)) return false;
  for(const token of tokens) {
    const match=/^v1,([^,]+)$/.exec(token);
    if(!match) continue;
    const supplied=decodeCandidate(match[1]);
    if(supplied && timingSafeEqual(supplied,expected)) return true;
  }
  return false;
}
function getText(payload) {
  const candidates=[payload?.data?.message?.text?.body,payload?.data?.text?.body,payload?.message?.text?.body,payload?.data?.message?.body];
  return candidates.find(v=>typeof v==='string') ?? '';
}
function messageId(payload) {
  const candidates=[payload?.data?.message?.id,payload?.data?.message_id,payload?.message?.id,payload?.message_id,payload?.data?.id];
  return candidates.find(v=>typeof v==='string' && v.length>0 && v.length<=512) ?? null;
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function extractOffer(payload) {
  const text=getText(payload);
  if(!text) return null;
  const price=/\b(?:USD|US\$|AED|EUR|GBP|\$|€|£)\s*([0-9]+(?:[.,][0-9]{1,2})?)|\b([0-9]+(?:[.,][0-9]{1,2})?)\s*(USD|AED|EUR|GBP)\b/i.exec(text);
  const qty=/\b(?:qty|quantity|pcs?|pieces?)\s*[:x-]?\s*(\d+)\b/i.exec(text);
  const storage=/\b(64|128|256|512)\s*GB\b|\b(1|2)\s*TB\b/i.exec(text);
  const model=/\b(iPhone\s*(?:SE|1[1-9])(?:\s*(?:Pro Max|Pro|Plus|Mini))?|AirPods\s*(?:Pro|Max|[1-4])?)\b/i.exec(text);
  const color=/\b(black|white|blue|green|red|pink|purple|gold|silver|gray|grey|graphite|titanium|natural|desert)\b/i.exec(text);
  const currency=(price?.[3] || (price?.[0].match(/USD|AED|EUR|GBP/i)?.[0]) || (price?.[0].includes('€')?'EUR':price?.[0].includes('£')?'GBP':price?.[0].includes('$')?'USD':null));
  const number=price ? Number((price[1]||price[2]).replace(',','.')) : null;
  const activation=/\b(activated|non[- ]?activated|not activated|active|inactive)\b/i.exec(text)?.[0] ?? null;
  const simType=/\beSIM\b/i.test(text)?'eSIM':/\b(?:1[- ]?SIM|single SIM|physical SIM)\b/i.test(text)?'1-SIM':'unknown';
  const supplierSeed=payload?.data?.contact?.id ?? payload?.data?.from ?? payload?.from ?? 'private';
  const recommendation=number===null?'NEGOTIATE':number<=0?'SKIP':'NEGOTIATE';
  return {supplierRef:hash(String(supplierSeed)),model:model?.[1]??null,storage:storage?.[0]??null,color:color?.[1]??null,
    specification:null,quantity:qty?Number(qty[1]):null,currency:currency?.toUpperCase()??null,price:number,
    activationStatus:activation,simType,recommendation};
}
function normalize(payload, raw) {
  if(!payload || typeof payload!=='object' || Array.isArray(payload) || typeof payload.type!=='string' || payload.type.length>128) return null;
  const id=messageId(payload);
  if(SUPPORTED.has(payload.type) && !id) return null;
  const rawHash=hash(raw);
  const stable=id?hash(id):rawHash;
  const received=payload.type==='message.received';
  return {
    type:payload.type,
    dedupeKey:received?`message:${stable}`:`event:${rawHash}`,
    actionKey:received?`action:${hash(`${id}:received`)}`:null,
    offer:received?extractOffer(payload):null
  };
}

export function webhookHandler({store,secret=()=>process.env.SENT_DM_WEBHOOK_SECRET,now=()=>Math.floor(Date.now()/1000),maxBytes=256*1024}) {
  return async (req,res) => {
    const chunks=[]; let total=0; let oversized=false;
    try {
      for await (const chunk of req) {
        total+=chunk.length;
        if(total>maxBytes){oversized=true; continue;}
        chunks.push(chunk);
      }
      if(oversized) return reply(res,401,AUTH_BODY);
      const raw=Buffer.concat(chunks,total);
      if(!authenticate(req,raw,now(),secret())) return reply(res,401,AUTH_BODY);
      let payload;
      try { payload=JSON.parse(raw.toString('utf8')); } catch { return reply(res,400,BAD_BODY); }
      const event=normalize(payload,raw);
      if(!event) return reply(res,400,BAD_BODY);
      store.persistEvent(event);
      return reply(res,200,OK_BODY);
    } catch {
      if(!res.headersSent) reply(res,503,Buffer.from('{"error":"Service Unavailable"}'));
      else res.destroy();
    }
  };
}
