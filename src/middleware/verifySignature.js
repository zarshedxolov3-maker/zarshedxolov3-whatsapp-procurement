'use strict';

const crypto = require('crypto');

/**
 * Middleware: validates X-Hub-Signature-256 from WhatsApp Cloud API.
 * Rejects requests that fail HMAC-SHA256 verification.
 */
function verifySignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return res.status(500).json({ error: 'Server misconfiguration: missing app secret' });
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  next();
}

module.exports = verifySignature;
