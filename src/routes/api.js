'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { compareQuotesByProduct, getBestQuote } = require('../services/priceComparison');
const { calculateLandedCost } = require('../services/calculator');

/**
 * GET /api/quotes?product=<name>
 * Lists all quotes, optionally filtered by product name.
 */
router.get('/quotes', (req, res) => {
  const db = getDb();
  const { product } = req.query;
  let rows;
  if (product) {
    rows = db
      .prepare(
        `SELECT q.*, s.name AS supplier_name, s.wa_id AS supplier_wa_id
         FROM quotes q JOIN suppliers s ON s.id = q.supplier_id
         WHERE LOWER(q.product_name) = LOWER(?)
         ORDER BY q.created_at DESC`,
      )
      .all(product);
  } else {
    rows = db
      .prepare(
        `SELECT q.*, s.name AS supplier_name, s.wa_id AS supplier_wa_id
         FROM quotes q JOIN suppliers s ON s.id = q.supplier_id
         ORDER BY q.created_at DESC LIMIT 100`,
      )
      .all();
  }
  res.json({ data: rows });
});

/**
 * GET /api/compare?product=<name>
 * Returns all quotes for a product ranked by unit price (cheapest first).
 */
router.get('/compare', (req, res) => {
  const { product } = req.query;
  if (!product) return res.status(400).json({ error: 'product query param required' });
  const results = compareQuotesByProduct(product);
  res.json({ data: results, best: results[0] || null });
});

/**
 * POST /api/calculate
 * Body: { quoteId, quantity, shippingCost, otherCosts, hsChapter, dutyRate, sellingPrice, unitPriceUsd }
 */
router.post('/calculate', (req, res) => {
  try {
    const result = calculateLandedCost(req.body);
    res.json({ data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/suppliers
 */
router.get('/suppliers', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC LIMIT 100').all();
  res.json({ data: rows });
});

/**
 * GET /api/best?product=<name>
 */
router.get('/best', (req, res) => {
  const { product } = req.query;
  if (!product) return res.status(400).json({ error: 'product query param required' });
  const best = getBestQuote(product);
  if (!best) return res.status(404).json({ error: 'No quotes found for that product' });
  res.json({ data: best });
});

module.exports = router;
