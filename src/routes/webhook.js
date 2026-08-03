'use strict';

const express = require('express');
const router = express.Router();
const verifySignature = require('../middleware/verifySignature');
const { logWebhookEvent, processMessage } = require('../services/webhookProcessor');

/**
 * GET /webhook/whatsapp
 * WhatsApp Cloud API hub verification handshake.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ error: 'Verification failed' });
});

/**
 * POST /webhook/whatsapp
 * Receives incoming WhatsApp Cloud API events.
 * Validates X-Hub-Signature-256 before processing.
 */
router.post('/', verifySignature, (req, res) => {
  // Acknowledge immediately — WhatsApp requires a 200 within 20 s
  res.sendStatus(200);

  const body = req.body || {};

  if (body.object !== 'whatsapp_business_account') return;

  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;

      const value = change.value || {};
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      for (const message of messages) {
        const contact = contacts.find((c) => c.wa_id === message.from) || null;

        try {
          logWebhookEvent('message', message.id, { message, contact });
          processMessage(message, contact);
        } catch (err) {
          // Log but never re-throw — we already sent 200
          console.error('[webhook] Error processing message', message.id, err);
        }
      }

      // Handle status updates
      const statuses = value.statuses || [];
      for (const status of statuses) {
        logWebhookEvent('status', status.id, status);
      }
    }
  }
});

module.exports = router;
