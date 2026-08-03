'use strict';

process.env.NODE_ENV = 'test';
process.env.WHATSAPP_VERIFY_TOKEN = 'test_verify_token';
process.env.WHATSAPP_APP_SECRET = 'test_app_secret_32bytes_padding!!';
process.env.DB_PATH = ':memory:';

const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');

function makeSignature(body, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('GET /webhook/whatsapp', () => {
  it('returns challenge on valid verification', async () => {
    const res = await request(app).get('/webhook/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test_verify_token',
      'hub.challenge': 'abc123',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('abc123');
  });

  it('returns 403 on wrong verify token', async () => {
    const res = await request(app).get('/webhook/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': 'abc123',
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', async () => {
    const res = await request(app).get('/webhook/whatsapp').query({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'test_verify_token',
      'hub.challenge': 'abc123',
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /webhook/whatsapp', () => {
  const SECRET = 'test_app_secret_32bytes_padding!!';

  it('returns 401 when signature header is missing', async () => {
    const res = await request(app).post('/webhook/whatsapp').send({ object: 'whatsapp_business_account' });
    expect(res.status).toBe(401);
  });

  it('returns 403 on invalid signature', async () => {
    const res = await request(app)
      .post('/webhook/whatsapp')
      .set('x-hub-signature-256', 'sha256=invalidsignature')
      .send({ object: 'whatsapp_business_account' });
    expect(res.status).toBe(403);
  });

  it('returns 200 on valid signature with whatsapp payload', async () => {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });
    const sig = makeSignature(payload, SECRET);
    const res = await request(app)
      .post('/webhook/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(payload);
    expect(res.status).toBe(200);
  });

  it('processes an incoming supplier quote message', async () => {
    const messageText = `Product: Copper Pipes\nUnit Price: 3.50 USD\nQuantity: 200 kg\nDelivery: 10 days`;
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    id: 'wamid.test001',
                    from: '998901234567',
                    type: 'text',
                    text: { body: messageText },
                  },
                ],
                contacts: [{ wa_id: '998901234567', profile: { name: 'Test Supplier' } }],
              },
            },
          ],
        },
      ],
    });

    const sig = makeSignature(payload, SECRET);
    const res = await request(app)
      .post('/webhook/whatsapp')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(payload);

    expect(res.status).toBe(200);
  });
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });
});
