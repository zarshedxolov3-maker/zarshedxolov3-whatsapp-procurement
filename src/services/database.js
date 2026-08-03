

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config');

let _db = null;

function getDb() {
  if (_db) return _db;

  const dbPath = config.database.path;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initialise(_db);
  return _db;
}

function initialise(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS procurements (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier      TEXT,
      product       TEXT,
      model         TEXT,
      storage       TEXT,
      color         TEXT,
      region        TEXT,
      quantity      INTEGER,
      currency      TEXT,
      price         REAL,
      date          TEXT,
      cargo_cost    REAL,
      cost_per_unit REAL,
      selling_price REAL,
      profit        REAL,
      margin        REAL,
      titan_price   REAL,
      price_diff    REAL,
      raw_message   TEXT,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS titan_prices (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product    TEXT NOT NULL,
      model      TEXT,
      storage    TEXT,
      color      TEXT,
      region     TEXT,
      currency   TEXT NOT NULL,
      price      REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
}

// ── Procurement CRUD ──────────────────────────────────────────────────────────

function insertProcurement(record) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO procurements
      (supplier, product, model, storage, color, region, quantity, currency,
       price, date, cargo_cost, cost_per_unit, selling_price, profit, margin,
       titan_price, price_diff, raw_message)
    VALUES
      (@supplier, @product, @model, @storage, @color, @region, @quantity, @currency,
       @price, @date, @cargo_cost, @cost_per_unit, @selling_price, @profit, @margin,
       @titan_price, @price_diff, @raw_message)
  `);
  const result = stmt.run(record);
  return { id: result.lastInsertRowid, ...record };
}

function getProcurements({ limit = 50, offset = 0, supplier, product } = {}) {
  const db = getDb();
  const conditions = [];
  const params = {};

  if (supplier) {
    conditions.push('supplier LIKE @supplier');
    params.supplier = `%${supplier}%`;
  }
  if (product) {
    conditions.push('product LIKE @product');
    params.product = `%${product}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT * FROM procurements ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM procurements ${where}`)
    .get(params).count;

  return { rows, total, limit, offset };
}

function getProcurementById(id) {
  return getDb().prepare('SELECT * FROM procurements WHERE id = ?').get(id);
}

function deleteProcurement(id) {
  const result = getDb().prepare('DELETE FROM procurements WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Titan Price CRUD ──────────────────────────────────────────────────────────

function upsertTitanPrice(record) {
  const db = getDb();
  db.prepare(`
    INSERT INTO titan_prices (product, model, storage, color, region, currency, price)
    VALUES (@product, @model, @storage, @color, @region, @currency, @price)
  `).run(record);
}

function getTitanPrice({ product, model, storage, region }) {
  const db = getDb();
  const conditions = [];
  const params = {};

  if (product) {
    conditions.push('product LIKE @product');
    params.product = `%${product}%`;
  }
  if (model) {
    conditions.push('model LIKE @model');
    params.model = `%${model}%`;
  }
  if (storage) {
    conditions.push('storage = @storage');
    params.storage = storage;
  }
  if (region) {
    conditions.push('region = @region');
    params.region = region;
  }

  if (conditions.length === 0) return null;

  const where = `WHERE ${conditions.join(' AND ')}`;
  return db
    .prepare(`SELECT * FROM titan_prices ${where} ORDER BY updated_at DESC LIMIT 1`)
    .get(params);
}

function getTitanPrices({ limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM titan_prices ORDER BY updated_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM titan_prices').get().count;
  return { rows, total, limit, offset };
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  getDb,
  insertProcurement,
  getProcurements,
  getProcurementById,
  deleteProcurement,
  upsertTitanPrice,
  getTitanPrice,
  getTitanPrices,
  closeDb,
};
