

const crypto = require('crypto');
const config = require('../config');

/**
 * Validates the X-Hub-Signature-256 header sent by Meta.
 * Must be applied BEFORE any body-parser middleware so the raw body is available.
 */
function verifySignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET || config.whatsapp.appSecret;
  if (!appSecret) {
    return res.status(500).json({ error: 'App secret not configured' });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(400).json({ error: 'Raw body not available for signature verification' });
  }

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  return next();
}

module.exports = { verifySignature };
