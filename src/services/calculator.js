'use strict';

const { getDb } = require('../db/database');

/**
 * Default duty rates by HS chapter (2-digit) as a fraction.
 * Extend as needed for your commodity mix.
 */
const DEFAULT_DUTY_RATES = {
  72: 0.05, // Iron and steel
  84: 0.025, // Machinery
  85: 0.025, // Electrical equipment
  39: 0.065, // Plastics
  63: 0.12, // Textiles
};
const FALLBACK_DUTY_RATE = 0.05;

/**
 * Calculates total landed cost and profit metrics for a quote.
 *
 * @param {object} params
 * @param {number} params.quoteId        - ID of the quote in the database.
 * @param {number} params.quantity       - Units or kg being ordered.
 * @param {number} params.shippingCost   - Total freight cost in USD.
 * @param {number} params.otherCosts     - Handling, insurance, misc (USD).
 * @param {number} [params.hsChapter]    - 2-digit HS code chapter for duty lookup.
 * @param {number} [params.dutyRate]     - Override duty rate (fraction, e.g. 0.05 = 5%).
 * @param {number} [params.sellingPrice] - Target retail/wholesale price per unit (USD).
 * @param {number} [params.unitPriceUsd] - Unit price in USD (overrides DB lookup).
 * @returns {object} Breakdown with total landed cost and profit figures.
 */
function calculateLandedCost({
  quoteId,
  quantity,
  shippingCost,
  otherCosts = 0,
  hsChapter,
  dutyRate,
  sellingPrice,
  unitPriceUsd,
}) {
  if (quantity == null || quantity <= 0) {
    throw new Error('quantity must be a positive number');
  }
  if (shippingCost == null || shippingCost < 0) {
    throw new Error('shippingCost must be a non-negative number');
  }

  let unitPrice = unitPriceUsd;

  if (unitPrice == null && quoteId != null) {
    const db = getDb();
    const row = db.prepare('SELECT unit_price, currency FROM quotes WHERE id = ?').get(quoteId);
    if (!row) throw new Error(`Quote ${quoteId} not found`);
    // Assume price is already in USD; caller should convert if needed
    unitPrice = row.unit_price;
  }

  if (unitPrice == null || unitPrice <= 0) {
    throw new Error('unitPrice must be a positive number');
  }

  const productCost = unitPrice * quantity;

  const effectiveDutyRate =
    dutyRate != null
      ? dutyRate
      : hsChapter != null
        ? (DEFAULT_DUTY_RATES[hsChapter] ?? FALLBACK_DUTY_RATE)
        : FALLBACK_DUTY_RATE;

  const dutiesCost = productCost * effectiveDutyRate;
  const totalLandedCost = productCost + shippingCost + dutiesCost + otherCosts;
  const landedCostPerUnit = totalLandedCost / quantity;

  let grossProfit = null;
  let profitMarginPct = null;
  let revenue = null;

  if (sellingPrice != null && sellingPrice > 0) {
    revenue = sellingPrice * quantity;
    grossProfit = revenue - totalLandedCost;
    profitMarginPct = (grossProfit / revenue) * 100;
  }

  const result = {
    quoteId: quoteId ?? null,
    quantity,
    unitPrice,
    productCost: round(productCost),
    shippingCost: round(shippingCost),
    dutiesRate: effectiveDutyRate,
    dutiesCost: round(dutiesCost),
    otherCosts: round(otherCosts),
    totalLandedCost: round(totalLandedCost),
    landedCostPerUnit: round(landedCostPerUnit),
    sellingPrice: sellingPrice ?? null,
    revenue: revenue != null ? round(revenue) : null,
    grossProfit: grossProfit != null ? round(grossProfit) : null,
    profitMarginPct: profitMarginPct != null ? round(profitMarginPct, 2) : null,
  };

  if (quoteId != null) {
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO cargo_calculations
          (quote_id, product_cost, shipping_cost, duties_cost, other_costs, total_landed_cost, selling_price, gross_profit, profit_margin_pct)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        quoteId,
        result.productCost,
        result.shippingCost,
        result.dutiesCost,
        result.otherCosts,
        result.totalLandedCost,
        result.sellingPrice,
        result.grossProfit,
        result.profitMarginPct,
      );
    } catch (_) {
      // Persist errors are non-fatal for the calculation result
    }
  }

  return result;
}

function round(value, decimals = 2) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

module.exports = { calculateLandedCost, DEFAULT_DUTY_RATES };
