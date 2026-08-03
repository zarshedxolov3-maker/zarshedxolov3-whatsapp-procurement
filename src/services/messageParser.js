'use strict';

/**
 * Parses supplier WhatsApp messages to extract structured quote data.
 *
 * Expected natural-language patterns (case-insensitive):
 *   Product: <name>
 *   Qty / Quantity: <number> <unit>
 *   Price / Unit Price: <number> <currency>
 *   Delivery: <number> days
 *   Notes: <text>
 *
 * Example message:
 *   Product: Steel Pipes
 *   Quantity: 500 kg
 *   Unit Price: 2.50 USD
 *   Delivery: 14 days
 *   Notes: FOB Shanghai
 */

const PATTERNS = {
  product: /(?:product|item|goods)[:\s]+(.+)/i,
  quantity: /(?:qty|quantity|amount)[:\s]+([\d.,]+)\s*([a-z]+)?/i,
  unitPrice: /(?:unit\s*price|price\s*per\s*unit|price|cost)[:\s]+([\d.,]+)\s*([A-Z]{3})?/i,
  currency: /\b(USD|EUR|GBP|CNY|AED|KGS|KZT|RUB|UZS)\b/i,
  deliveryDays: /(?:delivery|lead\s*time|days)[:\s]+([\d]+)\s*(?:days?|d\b)/i,
  notes: /(?:notes?|remarks?|terms?|conditions?)[:\s]+(.+)/i,
};

/**
 * @param {string} text - Raw message text from WhatsApp.
 * @returns {object|null} Parsed quote fields or null if minimum data not found.
 */
function parseSupplierMessage(text) {
  if (!text || typeof text !== 'string') return null;

  const normalized = text.trim();

  const productMatch = normalized.match(PATTERNS.product);
  const quantityMatch = normalized.match(PATTERNS.quantity);
  const priceMatch = normalized.match(PATTERNS.unitPrice);
  const deliveryMatch = normalized.match(PATTERNS.deliveryDays);
  const notesMatch = normalized.match(PATTERNS.notes);

  // Determine currency: explicit in price line, or standalone currency mention
  let currency = 'USD';
  if (priceMatch && priceMatch[2]) {
    currency = priceMatch[2].toUpperCase();
  } else {
    const currencyMatch = normalized.match(PATTERNS.currency);
    if (currencyMatch) currency = currencyMatch[1].toUpperCase();
  }

  const unitPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
  const productName = productMatch ? productMatch[1].trim() : null;

  // Require at minimum a product name and a price to create a quote
  if (!productName || unitPrice === null || isNaN(unitPrice)) {
    return null;
  }

  const quantity = quantityMatch ? parseFloat(quantityMatch[1].replace(/,/g, '')) : null;
  const unit = quantityMatch && quantityMatch[2] ? quantityMatch[2].toLowerCase() : null;
  const deliveryDays = deliveryMatch ? parseInt(deliveryMatch[1], 10) : null;
  const notes = notesMatch ? notesMatch[1].trim() : null;

  return {
    productName,
    quantity,
    unit,
    unitPrice,
    currency,
    deliveryDays,
    notes,
  };
}

/**
 * Extracts the text body from an incoming WhatsApp Cloud API message object.
 * @param {object} message - WhatsApp message object from webhook payload.
 * @returns {string|null}
 */
function extractMessageText(message) {
  if (!message) return null;
  if (message.type === 'text' && message.text) {
    return message.text.body || null;
  }
  return null;
}

module.exports = { parseSupplierMessage, extractMessageText };
