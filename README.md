# TradeBay WhatsApp Procurement

Private, receive-only Sent v3 webhook service for TradeBay. It never sends messages, buys products, replies to suppliers, migrates a number, unregisters WhatsApp, or deletes chats.

## Runtime

- `GET /health` returns only `{ "status": "ok" }`.
- `POST /webhooks/sent` verifies the exact received bytes before JSON parsing.
- Authenticated events are persisted atomically before `200`.
- Supplier identifiers are one-way hashed; message text and phone numbers are not retained.
- Inbound offers create only a private `BUY`, `NEGOTIATE`, or `SKIP` recommendation record and an idempotent outbox item.

Required Railway secrets: `SENT_DM_API_KEY` and `SENT_DM_WEBHOOK_SECRET`. Set `SENT_PROFILE_ID` only when Sent requires profile scoping. Mount persistent storage at `/data` and set `DB_PATH=/data/tradebay.sqlite`.

Meta Embedded Signup must be started from the Sent dashboard. Use WhatsApp Business App Coexistence when Sent and Meta offer it for the existing number. Never migrate, unregister, replace, or delete the existing WhatsApp Business account without the owner's explicit approval.

## Verify

```sh
npm run lint
npm test
```
