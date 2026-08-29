import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Store } from './store.js';
import { webhookHandler } from './webhook.js';

const host=process.env.HOST || '0.0.0.0';
const port=Number(process.env.PORT || 3000);
const dbPath=process.env.DB_PATH || 'data/tradebay.sqlite';
const store=new Store(dbPath);
const sentWebhook=webhookHandler({store});
const server=createServer((req,res)=>{
  const correlation=randomBytes(8).toString('hex');
  res.setHeader('x-correlation-id',correlation);
  res.setHeader('x-content-type-options','nosniff');
  if(req.method==='GET' && req.url==='/health') {
    const body=Buffer.from('{"status":"ok"}');
    res.writeHead(200,{'content-type':'application/json','content-length':String(body.length),'cache-control':'no-store'}); return res.end(body);
  }
  if(req.method==='POST' && req.url==='/webhooks/sent') return sentWebhook(req,res);
  const body=Buffer.from('{"error":"Not Found"}');
  res.writeHead(404,{'content-type':'application/json','content-length':String(body.length),'cache-control':'no-store'}); res.end(body);
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.listen(port,host,()=>console.log(JSON.stringify({event:'service_started'})));
function shutdown(){server.close(()=>{store.close();process.exit(0);});setTimeout(()=>process.exit(1),5000).unref();}
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
