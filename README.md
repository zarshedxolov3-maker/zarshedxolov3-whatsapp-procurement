# TradeBay Procurement Intelligence

A production-ready **Node.js / Express** application that connects to the **official WhatsApp Business Cloud API** to receive supplier quotes, parse structured procurement data, calculate landed costs and margins, and compare prices against Titan Moscow references.

---

## Features

| Feature | Detail |
|---|---|
| WhatsApp Webhook | GET + POST `/webhook/whatsapp` with Meta challenge verification |
| Signature validation | `X-Hub-Signature-256` HMAC-SHA256 check on every POST |
| Message parsing | Extracts supplier, product, model, storage, color, region, quantity, currency, price, date |
| Pricing engine | Calculates cargo cost, cost-per-unit, suggested selling price, profit & margin |
| Titan Moscow comparison | Flags whether the procurement price beats the Titan Moscow reference |
| Persistent storage | SQLite via `better-sqlite3` (WAL mode, easy to migrate) |
| REST API | CRUD for procurements and Titan price catalogue; dry-run `/api/parse` |
| Security | `helmet`, raw-body signature guard, secrets in `.env` only |
| Observability | `morgan` HTTP logging, structured error responses |
| Testing | Jest + Supertest – webhook, parser, pricing, API |
| Linting / formatting | ESLint + Prettier |
| CI | GitHub Actions – Node 20 & 22 matrix |

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/zarshedxolov3-maker/-tradebay-whatsapp-procurement.git
cd -tradebay-whatsapp-procurement
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
$EDITOR .env

# 3. Start the server
npm start              # production
npm run dev            # development (nodemon auto-reload)
```

The server starts on `http://localhost:3000` by default (override with `PORT=`).

---

## Environment Variables

Copy `.env.example` to `.env` and set every value. **Never commit `.env`.**

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default `3000`) |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `WHATSAPP_VERIFY_TOKEN` | **Yes** | Random string registered in Meta App Dashboard |
| `WHATSAPP_APP_SECRET` | **Yes** | Meta App Secret – used to verify webhook signatures |
| `WHATSAPP_ACCESS_TOKEN` | **Yes** | Meta permanent / system-user token |
| `WHATSAPP_PHONE_NUMBER_ID` | **Yes** | Meta phone number ID for your WhatsApp Business number |
| `WHATSAPP_API_VERSION` | No | Graph API version (default `v19.0`) |
| `DATABASE_PATH` | No | SQLite file path (default `./data/tradebay.db`) |
| `CARGO_RATE_PER_KG` | No | Freight rate USD/kg (default `5`) |
| `DEFAULT_MARGIN_PERCENT` | No | Target margin % for suggested prices (default `15`) |
| `TITAN_MOSCOW_API_URL` | No | Titan Moscow price API base URL |
| `TITAN_MOSCOW_API_KEY` | No | Titan Moscow API key |

---

## API Reference

### Webhook

| Method | Path | Description |
|---|---|---|
| `GET` | `/webhook/whatsapp` | Meta webhook verification challenge |
| `POST` | `/webhook/whatsapp` | Inbound message events (validates `X-Hub-Signature-256`) |

### Procurement Records

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/procurements` | List records (`limit`, `offset`, `supplier`, `product` filters) |
| `POST` | `/api/procurements` | Create from raw message text |
| `GET` | `/api/procurements/:id` | Get single record |
| `DELETE` | `/api/procurements/:id` | Delete record |

**POST `/api/procurements` body:**
```json
{
  "message": "Apple iPhone 15 Pro 256GB Natural Titanium Japan 10 pcs USD 950 2024-03-01",
  "supplier": "optional-supplier-name",
  "sellingPrice": 1100,
  "marginPercent": 15
}
```

### Parse (dry run – no DB write)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/parse` | Parse a message and return extracted fields + pricing |

### Titan Moscow Reference Prices

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/titan-prices` | List reference prices |
| `POST` | `/api/titan-prices` | Add / update a reference price |

### Utility

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |

---

## Project Structure

```
src/
  app.js              Express app (middleware, routes)
  server.js           HTTP server entry point
  config/
    index.js          Env-based configuration
  middleware/
    auth.js           X-Hub-Signature-256 validation
    rawBody.js        Raw body capture for HMAC verification
    errorHandler.js   Centralised error responses
  routes/
    webhook.js        WhatsApp webhook endpoints
    api.js            REST API endpoints
  services/
    parser.js         WhatsApp message parser
    pricing.js        Cargo cost / margin calculations
    database.js       SQLite data access layer
    whatsapp.js       Message processing orchestration
tests/
  webhook.test.js     Webhook endpoint tests
  api.test.js         REST API endpoint tests
  parser.test.js      Message parser unit tests
  pricing.test.js     Pricing engine unit tests
.github/workflows/
  ci.yml              GitHub Actions CI (Node 20 & 22)
```

---

## Development

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Lint
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format with Prettier
npm run format
```

---

## Security Notes

- All secrets live in `.env` only – never hardcoded.
- Every inbound POST to `/webhook/whatsapp` is verified with `X-Hub-Signature-256` using `crypto.timingSafeEqual` to prevent timing attacks.
- Meta webhook verification uses a secret `WHATSAPP_VERIFY_TOKEN`.
- HTTP security headers are set by `helmet`.
- `.env` and database files are excluded from version control via `.gitignore`.

---

## License

ISC
