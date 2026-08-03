const config = require('../config');

/**
 * Average device weights in grams by product keyword (fallback: 200g).
 */
const DEVICE_WEIGHTS = {
  iphone: 200,
  samsung: 185,
  ipad: 500,
  macbook: 1400,
  default: 200,
};

/**
 * Returns estimated weight in kg for a single unit based on product name.
 * @param {string} product
 * @returns {number}
 */
function estimateWeightKg(product) {
  const p = (product || '').toLowerCase();
  for (const [key, grams] of Object.entries(DEVICE_WEIGHTS)) {
    if (key !== 'default' && p.includes(key)) return grams / 1000;
  }
  return DEVICE_WEIGHTS.default / 1000;
}

/**
 * Calculates all cost and margin fields for a procurement record.
 *
 * @param {object} params
 * @param {number} params.price          - Unit purchase price
 * @param {number} params.quantity       - Number of units
 * @param {string} [params.product]      - Product name (for weight estimation)
 * @param {number} [params.cargoRatePerKg] - Override cargo rate $/kg
 * @param {number} [params.sellingPrice]   - Override selling price per unit (for margin calc)
 * @param {number} [params.marginPercent]  - Desired margin % for suggested price
 * @returns {object}
 */
function calculatePricing({
  price,
  quantity,
  product = '',
  cargoRatePerKg = config.pricing.cargoRatePerKg,
  sellingPrice = null,
  marginPercent = config.pricing.defaultMarginPercent,
}) {
  if (typeof price !== 'number' || price <= 0) {
    throw new Error('price must be a positive number');
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    throw new Error('quantity must be a positive number');
  }

  const weightPerUnitKg = estimateWeightKg(product);
  const totalWeightKg = weightPerUnitKg * quantity;

  const totalPurchaseCost = price * quantity;
  const cargoCost = Math.round(cargoRatePerKg * totalWeightKg * 100) / 100;
  const costPerUnit = Math.round(((totalPurchaseCost + cargoCost) / quantity) * 100) / 100;

  // Suggested selling price to achieve desired margin
  const suggestedSellingPrice = Math.round((costPerUnit / (1 - marginPercent / 100)) * 100) / 100;

  const effectiveSellingPrice = sellingPrice !== null ? sellingPrice : suggestedSellingPrice;

  const profitPerUnit = Math.round((effectiveSellingPrice - costPerUnit) * 100) / 100;
  const totalProfit = Math.round(profitPerUnit * quantity * 100) / 100;
  const margin =
    effectiveSellingPrice > 0
      ? Math.round((profitPerUnit / effectiveSellingPrice) * 100 * 100) / 100
      : 0;

  return {
    unitPurchasePrice: price,
    quantity,
    totalPurchaseCost,
    weightPerUnitKg,
    totalWeightKg,
    cargoCost,
    costPerUnit,
    suggestedSellingPrice,
    sellingPrice: effectiveSellingPrice,
    profitPerUnit,
    totalProfit,
    marginPercent: margin,
  };
}

/**
 * Compares a given unit cost with a Titan Moscow reference price.
 *
 * @param {number} unitCost       - Our cost per unit (with cargo)
 * @param {number} titanPrice     - Titan Moscow reference price for the same product
 * @returns {object}
 */
function compareWithTitan(unitCost, titanPrice) {
  if (typeof titanPrice !== 'number' || titanPrice <= 0) {
    return { titanPrice: null, priceDiff: null, priceDiffPercent: null, competitive: null };
  }
  const priceDiff = Math.round((unitCost - titanPrice) * 100) / 100;
  const priceDiffPercent =
    titanPrice > 0 ? Math.round((priceDiff / titanPrice) * 100 * 100) / 100 : null;
  return {
    titanPrice,
    priceDiff,
    priceDiffPercent,
    competitive: unitCost <= titanPrice,
  };
}

module.exports = { calculatePricing, compareWithTitan, estimateWeightKg };
