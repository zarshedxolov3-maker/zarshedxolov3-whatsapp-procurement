const express = require('express');
const {
  getProcurements,
  getProcurementById,
  deleteProcurement,
  upsertTitanPrice,
  getTitanPrices,
} = require('../services/database');
const { parseSupplierMessage } = require('../services/parser');
const { calculatePricing, compareWithTitan } = require('../services/pricing');
const { insertProcurement, getTitanPrice } = require('../services/database');

const router = express.Router();

// ── Procurements ──────────────────────────────────────────────────────────────

/**
 * GET /api/procurements
 * Query params: limit, offset, supplier, product
 */
router.get('/procurements', (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const { supplier, product } = req.query;
    const result = getProcurements({ limit, offset, supplier, product });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/procurements/:id
 */
router.get('/procurements/:id', (req, res, next) => {
  try {
    const record = getProcurementById(parseInt(req.params.id, 10));
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/procurements
 * Manually create a procurement record from a raw message text.
 * Body: { message, supplier?, sellingPrice?, marginPercent? }
 */
router.post('/procurements', (req, res, next) => {
  try {
    const { message, supplier, sellingPrice, marginPercent } = req.body || {};
    if (!message) return res.status(400).json({ error: '`message` field is required' });

    const parsed = parseSupplierMessage(message, supplier || null);
    if (!parsed.price) {
      return res.status(422).json({ error: 'Could not extract a price from the message' });
    }

    const pricingResult =
      parsed.price && parsed.quantity
        ? calculatePricing({
            price: parsed.price,
            quantity: parsed.quantity,
            product: parsed.product || '',
            ...(sellingPrice !== undefined ? { sellingPrice: Number(sellingPrice) } : {}),
            ...(marginPercent !== undefined ? { marginPercent: Number(marginPercent) } : {}),
          })
        : null;

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
      raw_message: message,
    };

    const saved = insertProcurement(record);
    res.status(201).json({ parsed, pricing: pricingResult, titanComparison, saved });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/procurements/:id
 */
router.delete('/procurements/:id', (req, res, next) => {
  try {
    const deleted = deleteProcurement(parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// ── Parse endpoint (dry-run, no DB save) ─────────────────────────────────────

/**
 * POST /api/parse
 * Body: { message, supplier?, sellingPrice?, marginPercent? }
 */
router.post('/parse', (req, res, next) => {
  try {
    const { message, supplier, sellingPrice, marginPercent } = req.body || {};
    if (!message) return res.status(400).json({ error: '`message` field is required' });

    const parsed = parseSupplierMessage(message, supplier || null);

    const pricingResult =
      parsed.price && parsed.quantity
        ? calculatePricing({
            price: parsed.price,
            quantity: parsed.quantity,
            product: parsed.product || '',
            ...(sellingPrice !== undefined ? { sellingPrice: Number(sellingPrice) } : {}),
            ...(marginPercent !== undefined ? { marginPercent: Number(marginPercent) } : {}),
          })
        : null;

    res.json({ parsed, pricing: pricingResult });
  } catch (err) {
    next(err);
  }
});

// ── Titan Prices ──────────────────────────────────────────────────────────────

/**
 * GET /api/titan-prices
 */
router.get('/titan-prices', (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    res.json(getTitanPrices({ limit, offset }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/titan-prices
 * Body: { product, model?, storage?, color?, region?, currency, price }
 */
router.post('/titan-prices', (req, res, next) => {
  try {
    const { product, model, storage, color, region, currency, price } = req.body || {};
    if (!product || !currency || price === undefined) {
      return res
        .status(400)
        .json({ error: '`product`, `currency`, and `price` fields are required' });
    }
    upsertTitanPrice({ product, model, storage, color, region, currency, price: Number(price) });
    res.status(201).json({ message: 'Titan price saved' });
  } catch (err) {
    next(err);
  }
});

// ── Health ────────────────────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
