const request = require('supertest');

const app = require('../src/app');

describe('GET /api/health', () => {
  it('returns 200 and status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('POST /api/parse', () => {
  it('returns 400 when message field is missing', async () => {
    const res = await request(app).post('/api/parse').send({});
    expect(res.status).toBe(400);
  });

  it('parses a valid message', async () => {
    const res = await request(app)
      .post('/api/parse')
      .send({ message: 'Apple iPhone 15 Pro 256GB Japan USD 950 qty 5 2024-03-01' });
    expect(res.status).toBe(200);
    expect(res.body.parsed.price).toBe(950);
    expect(res.body.parsed.currency).toBe('USD');
    expect(res.body.parsed.quantity).toBe(5);
    expect(res.body.pricing).toBeDefined();
  });

  it('returns pricing null when no quantity provided', async () => {
    const res = await request(app)
      .post('/api/parse')
      .send({ message: 'iPhone 15 Pro 256GB USD 950' });
    expect(res.status).toBe(200);
    expect(res.body.pricing).toBeNull();
  });
});

describe('POST /api/procurements', () => {
  it('returns 400 when message field is missing', async () => {
    const res = await request(app).post('/api/procurements').send({});
    expect(res.status).toBe(400);
  });

  it('returns 422 when no price can be extracted', async () => {
    const res = await request(app)
      .post('/api/procurements')
      .send({ message: 'Hello how are you today' });
    expect(res.status).toBe(422);
  });

  it('creates a procurement record and returns 201', async () => {
    const res = await request(app).post('/api/procurements').send({
      message: 'Samsung Galaxy S24 512GB Black Global 5pcs USD 800 2024-04-01',
      supplier: 'TestSupplier',
    });
    expect(res.status).toBe(201);
    expect(res.body.saved.id).toBeDefined();
    expect(res.body.parsed.price).toBe(800);
  });
});

describe('GET /api/procurements', () => {
  it('returns a paginated list', async () => {
    const res = await request(app).get('/api/procurements');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
});

describe('GET /api/procurements/:id', () => {
  it('returns 404 for non-existent id', async () => {
    const res = await request(app).get('/api/procurements/999999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/titan-prices', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/titan-prices').send({ product: 'iPhone' });
    expect(res.status).toBe(400);
  });

  it('saves a titan price and returns 201', async () => {
    const res = await request(app).post('/api/titan-prices').send({
      product: 'Apple iPhone 15 Pro',
      storage: '256GB',
      region: 'Global',
      currency: 'USD',
      price: 1050,
    });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/titan-prices', () => {
  it('returns a list', async () => {
    const res = await request(app).get('/api/titan-prices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown/route');
    expect(res.status).toBe(404);
  });
});
