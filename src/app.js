const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const webhookRouter = require('./routes/webhook');
const apiRouter = require('./routes/api');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Request logging ───────────────────────────────────────────────────────────
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// ── JSON body parser (captures raw bytes for HMAC verification) ───────────────
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook/whatsapp', webhookRouter);
app.use('/api', apiRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
