'use strict';

const { getDb } = require('../db/database');
const { parseSupplierMessage, extractMessageText } = require('../services/messageParser');

/**
 * Upserts a supplier record by WhatsApp ID.
 * @param {string} waId - WhatsApp phone number ID.
 * @param {string} [name] - Display name from contact profile.
 * @returns {number} Supplier row id.
 */
function upsertSupplier(waId, name) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM suppliers WHERE wa_id = ?').get(waId);
  if (existing) {
    if (name) {
      db.prepare('UPDATE suppliers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE wa_id = ?').run(name, waId);
    }
    return existing.id;
  }
  const result = db.prepare('INSERT INTO suppliers (wa_id, name) VALUES (?, ?)').run(waId, name || null);
  return result.lastInsertRowid;
}

/**
 * Saves a parsed quote to the database.
 */
function saveQuote(supplierId, parsed, waMessageId, rawMessage) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO quotes
        (supplier_id, wa_message_id, product_name, quantity, unit, unit_price, currency, delivery_days, notes, raw_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      supplierId,
      waMessageId || null,
      parsed.productName,
      parsed.quantity || null,
      parsed.unit || null,
      parsed.unitPrice,
      parsed.currency,
      parsed.deliveryDays || null,
      parsed.notes || null,
      rawMessage || null,
    );
  return result.lastInsertRowid;
}

/**
 * Logs a raw webhook event for auditability.
 */
function logWebhookEvent(eventType, waMessageId, payload) {
  const db = getDb();
  db.prepare('INSERT INTO webhook_events (event_type, wa_message_id, payload) VALUES (?, ?, ?)').run(
    eventType,
    waMessageId || null,
    typeof payload === 'string' ? payload : JSON.stringify(payload),
  );
}

/**
 * Processes a single WhatsApp message object from the webhook payload.
 * Returns { supplierId, quoteId } if a quote was extracted, otherwise { supplierId }.
 */
function processMessage(message, contact) {
  const waId = message.from;
  const name = contact?.profile?.name || null;
  const supplierId = upsertSupplier(waId, name);

  const text = extractMessageText(message);
  if (!text) return { supplierId };

  const parsed = parseSupplierMessage(text);
  if (!parsed) return { supplierId };

  const quoteId = saveQuote(supplierId, parsed, message.id, text);
  return { supplierId, quoteId, parsed };
}

module.exports = { upsertSupplier, saveQuote, logWebhookEvent, processMessage };
