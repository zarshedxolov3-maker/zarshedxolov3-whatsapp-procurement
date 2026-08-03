

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0',
  },

  database: {
    path: process.env.DATABASE_PATH || './data/tradebay.db',
  },

  pricing: {
    cargoRatePerKg: parseFloat(process.env.CARGO_RATE_PER_KG || '5'),
    defaultMarginPercent: parseFloat(process.env.DEFAULT_MARGIN_PERCENT || '15'),
    currency: process.env.DEFAULT_CURRENCY || 'USD',
  },

  titanMoscow: {
    apiUrl: process.env.TITAN_MOSCOW_API_URL || '',
    apiKey: process.env.TITAN_MOSCOW_API_KEY || '',
  },
};

module.exports = config;
