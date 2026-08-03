require('dotenv').config();
const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(
    `[${new Date().toISOString()}] TradeBay Procurement Intelligence running on port ${config.port} (${config.nodeEnv})`,
  );
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[${new Date().toISOString()}] Received ${signal}. Shutting down gracefully…`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] HTTP server closed.`);
    process.exit(0);
  });

  // Force exit after 10 s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
