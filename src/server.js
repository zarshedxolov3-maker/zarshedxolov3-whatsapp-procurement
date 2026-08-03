'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] TradeBay WhatsApp Procurement running on ${HOST}:${PORT}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  server.close(() => {
    const { closeDb } = require('./db/database');
    closeDb();
    console.log('[server] Closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
