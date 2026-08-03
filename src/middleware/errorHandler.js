

const config = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (config.nodeEnv !== 'test') {
    console.error(`[${new Date().toISOString()}] Error ${status}: ${message}`);
    if (err.stack && config.nodeEnv !== 'production') {
      console.error(err.stack);
    }
  }

  res.status(status).json({
    error: {
      message,
      status,
      ...(config.nodeEnv !== 'production' && err.stack ? { stack: err.stack } : {}),
    },
  });
}

module.exports = { errorHandler };
