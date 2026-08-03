const { parseSupplierMessage } = require('./parser');
const { calculatePricing, compareWithTitan } = require('./pricing');
const { insertProcurement, getTitanPrice } = require('./database');

/**
 * Processes an inbound WhatsApp message event object from Meta's Webhook payload.
 *
 * @param {object} message  - The message object from value.messages[0]
 * @param {string} from     - Sender's phone number (used as supplier identifier)
 * @returns {object|null}   - Saved procurement record, or null if not parseable
 */
function processInboundMessage(message, from) {
  if (!message || message.type !== 'text') return null;

  const text = message.text?.body;
  if (!text) return null;

  let parsed;
  try {
    parsed = parseSupplierMessage(text, from);
  } catch {
    return null;
  }

  // Skip if no price was detected (message is likely not a quote)
  if (!parsed.price) return null;

  const pricingResult =
    parsed.price && parsed.quantity
      ? calculatePricing({
          price: parsed.price,
          quantity: parsed.quantity,
          product: parsed.product || '',
        })
      : null;

  // Titan comparison
  const titanRecord = getTitanPrice({
    product: parsed.product,
    model: parsed.model,
    storage: parsed.storage,
    region: parsed.region,
  });

  const titanComparison =
    titanRecord && pricingResult
      ? compareWithTitan(pricingResult.costPerUnit, titanRecord.price)
      : { titanPrice: null, priceDiff: null, priceDiffPercent: null, competitive: null };

  const record = {
    supplier: parsed.supplier,
    product: parsed.product,
    model: parsed.model,
    storage: parsed.storage,
    color: parsed.color,
    region: parsed.region,
    quantity: parsed.quantity,
    currency: parsed.currency,
    price: parsed.price,
    date: parsed.date,
    cargo_cost: pricingResult ? pricingResult.cargoCost : null,
    cost_per_unit: pricingResult ? pricingResult.costPerUnit : null,
    selling_price: pricingResult ? pricingResult.sellingPrice : null,
    profit: pricingResult ? pricingResult.totalProfit : null,
    margin: pricingResult ? pricingResult.marginPercent : null,
    titan_price: titanComparison.titanPrice,
    price_diff: titanComparison.priceDiff,
    raw_message: text,
  };

  return insertProcurement(record);
}

/**
 * Extracts all inbound message events from a Meta Webhook payload.
 * Handles the nested entry/changes/value/messages structure.
 *
 * @param {object} body - Parsed request body
 * @returns {Array<{message, from}>}
 */
function extractMessages(body) {
  const results = [];
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const messages = change?.value?.messages || [];
      for (const message of messages) {
        results.push({ message, from: message.from });
      }
    }
  }
  return results;
}

module.exports = { processInboundMessage, extractMessages };
