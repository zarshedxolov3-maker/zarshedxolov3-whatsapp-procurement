# TradeBay WhatsApp Procurement Intelligence

A production-ready **Node.js / Express** backend that connects to the **WhatsApp Business Cloud API** to automate procurement workflows — receiving supplier quotes, comparing prices, and calculating landed costs and profit margins.

---

## Features

| Feature | Details |
|---|---|
| WhatsApp webhook | GET (verification) + POST (events) at `/webhook/whatsapp` |
| Signature validation | X-Hub-Signature-256 HMAC-SHA256 on every POST |
| Supplier message parser | Extracts product, qty, price, currency, delivery from free-text |
| Price comparison engine | Ranks supplier quotes by unit cost (with FX conversion) |
| Cargo & profit calculator | Landed cost = product + freight + duties + misc; ROI metrics |
| SQLite persistence | Suppliers, quotes, price comparisons, cargo calcs, webhook events |
| Security | `helmet`, CORS, no secrets in code, env vars only |
| CI | GitHub Actions — lint + tests on Node 20 & 22 |
| Tests | Jest + Supertest (~100 % service coverage) |
| Linting | ESLint + Prettier |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/zarshedxolov3-maker/-tradebay-whatsapp-procurement.git
cd -tradebay-whatsapp-procurement

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env with your WhatsApp credentials

# 4. Run
npm start
```

The server starts on `http://0.0.0.0:3000` by default.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. **Never commit `.env`.**

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default `3000`) |
| `HOST` | No | Bind address (default `0.0.0.0`) |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `WHATSAPP_VERIFY_TOKEN` | **Yes** | Token you set in Meta App Dashboard |
| `WHATSAPP_APP_SECRET` | **Yes** | App Secret from Meta App Dashboard |
| `WHATSAPP_ACCESS_TOKEN` | **Yes** | Permanent system-user access token |
| `WHATSAPP_PHONE_NUMBER_ID` | **Yes** | WhatsApp Phone Number ID |
| `WHATSAPP_API_VERSION` | No | API version (default `v19.0`) |
| `DB_PATH` | No | SQLite file path (default `./data/tradebay.db`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

---

## WhatsApp Cloud API Setup

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com).
2. Add the **WhatsApp** product.
3. Under **Configuration → Webhooks**, set:
   - **Callback URL**: `https://yourdomain.com/webhook/whatsapp`
   - **Verify Token**: same value as `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to the **messages** field.
5. Copy the **App Secret** and a **Permanent Access Token** into `.env`.

---

## API Endpoints

### Webhook (WhatsApp)

| Method | Path | Description |
|---|---|---|
| `GET` | `/webhook/whatsapp` | Hub verification handshake |
| `POST` | `/webhook/whatsapp` | Receive incoming messages / status |

### Procurement API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/quotes?product=<name>` | List quotes, optionally filtered |
| `GET` | `/api/compare?product=<name>` | Compare quotes by price (cheapest first) |
| `GET` | `/api/best?product=<name>` | Get cheapest single quote |
| `GET` | `/api/suppliers` | List all suppliers |
| `POST` | `/api/calculate` | Calculate landed cost & profit |
| `GET` | `/health` | Health check |

### POST `/api/calculate` body

```json
{
  "quoteId": 1,
  "quantity": 500,
  "shippingCost": 1200,
  "otherCosts": 150,
  "hsChapter": 72,
  "sellingPrice": 8.50
}
```

---

## Supplier Message Format

Suppliers send WhatsApp messages in natural language. The parser recognises these fields:

```
Product: Steel Pipes
Quantity: 500 kg
Unit Price: 2.50 USD
Delivery: 14 days
Notes: FOB Shanghai
```

Supported currencies: USD, EUR, GBP, CNY, AED, KGS, KZT, RUB, UZS.

---

## Development

```bash
npm run dev          # Auto-restart on file changes (Node --watch)
npm test             # Jest + coverage
npm run lint         # ESLint
npm run format       # Prettier
npm run format:check # Prettier check (used in CI)
```

---

## Project Structure

```
src/
  app.js                    # Express app factory
  server.js                 # HTTP server entry point
  db/
    database.js             # SQLite connection & migrations
  middleware/
    verifySignature.js      # X-Hub-Signature-256 validation
  routes/
    webhook.js              # /webhook/whatsapp GET + POST
    api.js                  # /api/* REST endpoints
  services/
    messageParser.js        # WhatsApp message → structured quote
    priceComparison.js      # Multi-supplier price ranking
    calculator.js           # Landed cost & profit calculator
    webhookProcessor.js     # Orchestrates DB writes from webhook
tests/
  webhook.test.js
  messageParser.test.js
  calculator.test.js
  priceComparison.test.js
.github/workflows/ci.yml    # GitHub Actions CI
.env.example                # Environment variable template
```

---

## Security Notes

- All secrets are loaded from environment variables — no hardcoding.
- Every incoming POST is validated with HMAC-SHA256 (`X-Hub-Signature-256`).
- `helmet` sets secure HTTP headers.
- `crypto.timingSafeEqual` prevents timing attacks on signature checks.
- `.env` is in `.gitignore`; only `.env.example` is committed.

---

## License

ISC
