const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');

function makeSignature(secret, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${hmac}`;
}

describe('GET /webhook/whatsapp', () => {
  it('returns 200 and challenge when verify_token matches', async () => {
    const res = await request(app).get('/webhook/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': 'challenge123',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('challenge123');
  });

  it('returns 403 when verify_token does not match', async () => {
    const res = await request(app).get('/webhook/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge123',
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', async () => {
    const res = await request(app).get('/webhook/whatsapp').query({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': 'challenge123',
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /webhook/whatsapp', () => {
  const secret = 'test-app-secret';

  it('returns 401 when X-Hub-Signature-256 header is missing', async () => {
    const res = await request(app)
      .post('/webhook/whatsapp')
      .set('Content-Type', 'application/json')
      .send({ object: 'whatsapp_business_account' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when signature is invalid', async () => {
    const res = await request(app)
      .post('/webhook/whatsapp')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=invalidsig')
      .send({ object: 'whatsapp_business_account' });
    expect(res.status).toBe(403);
  });

  it('returns 200 with valid signature for non-message payload', async () => {
    const body = { object: 'whatsapp_business_account', entry: [] };
    const bodyStr = JSON.stringify(body);
    const sig = makeSignature(secret, bodyStr);

    const res = await request(app)
      .post('/webhook/whatsapp')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('processes a valid supplier message and returns 200', async () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '15551234567',
                    type: 'text',
                    text: { body: 'iPhone 15 Pro 256GB Black Japan 10 pcs USD 950 2024-03-01' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const bodyStr = JSON.stringify(body);
    const sig = makeSignature(secret, bodyStr);

    const res = await request(app)
      .post('/webhook/whatsapp')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(body);
    expect(res.status).toBe(200);
  });
});
