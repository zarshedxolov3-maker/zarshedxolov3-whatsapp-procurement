'use strict';

const { getDb } = require('../db/database');

/**
 * Normalises a price to USD for comparison.
 * In production, swap RATES for a live FX feed.
 */
const FX_RATES_TO_USD = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CNY: 0.138,
  AED: 0.272,
  KGS: 0.0115,
  KZT: 0.0022,
  RUB: 0.011,
  UZS: 0.000079,
};

function toUsd(amount, currency) {
  const rate = FX_RATES_TO_USD[currency.toUpperCase()] || 1;
  return amount * rate;
}

/**
 * Compare all quotes for a given product name (case-insensitive).
 * Returns ranked list with converted USD prices.
 *
 * @param {string} productName
 * @returns {Array<object>} Sorted quotes, cheapest first.
 */
function compareQuotesByProduct(productName) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT q.*, s.name AS supplier_name, s.wa_id AS supplier_wa_id
       FROM quotes q
       JOIN suppliers s ON s.id = q.supplier_id
       WHERE LOWER(q.product_name) = LOWER(?)
       ORDER BY q.created_at DESC`,
    )
    .all(productName);

  if (!rows.length) return [];

  const ranked = rows.map((row) => ({
    ...row,
    unit_price_usd: toUsd(row.unit_price, row.currency),
  }));

  ranked.sort((a, b) => a.unit_price_usd - b.unit_price_usd);

  return ranked.map((row, index) => ({
    rank: index + 1,
    quoteId: row.id,
    supplierName: row.supplier_name || row.supplier_wa_id,
    productName: row.product_name,
    unitPrice: row.unit_price,
    currency: row.currency,
    unitPriceUsd: parseFloat(row.unit_price_usd.toFixed(4)),
    quantity: row.quantity,
    unit: row.unit,
    deliveryDays: row.delivery_days,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

/**
 * Returns the single cheapest quote for a product.
 * @param {string} productName
 * @returns {object|null}
 */
function getBestQuote(productName) {
  const results = compareQuotesByProduct(productName);
  return results.length ? results[0] : null;
}

/**
 * Stores a price comparison snapshot for auditing.
 * @param {string} productName
 * @param {number} bestQuoteId
 * @returns {number} Inserted row id.
 */
function savePriceComparison(productName, bestQuoteId) {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO price_comparisons (product_name, best_quote_id) VALUES (?, ?)')
    .run(productName, bestQuoteId);
  return result.lastInsertRowid;
}

module.exports = { compareQuotesByProduct, getBestQuote, savePriceComparison, toUsd };
