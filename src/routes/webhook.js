

const express = require('express');
const config = require('../config');
const { verifySignature } = require('../middleware/auth');
const { processInboundMessage, extractMessages } = require('../services/whatsapp');

const router = express.Router();

/**
 * GET /webhook/whatsapp
 * Meta webhook verification challenge.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || config.whatsapp.verifyToken;

  if (mode === 'subscribe' && token === verifyToken) {
    // Validate challenge contains only safe characters before reflecting
    if (!challenge || !/^[\w-]+$/.test(challenge)) {
      return res.status(400).json({ error: 'Invalid challenge parameter' });
    }
    return res.status(200).type('text/plain').send(challenge);
  }

  return res.status(403).json({ error: 'Forbidden' });
});

/**
 * POST /webhook/whatsapp
 * Receives inbound WhatsApp messages; validates Meta signature.
 */
router.post('/', verifySignature, (req, res) => {
  // Acknowledge receipt immediately (Meta requires 200 within 20 s)
  res.status(200).json({ status: 'ok' });

  const body = req.body;
  if (body?.object !== 'whatsapp_business_account') return;

  const messages = extractMessages(body);
  for (const { message, from } of messages) {
    try {
      processInboundMessage(message, from);
    } catch (err) {
      console.error('[webhook] Error processing message:', err.message);
    }
  }
});

module.exports = router;
