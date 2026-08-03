/**
 * Parses a free-text WhatsApp supplier message and extracts procurement fields.
 *
 * Expected message formats (flexible):
 *   Apple iPhone 15 Pro, 256GB, Natural Titanium, Japan, qty 10, USD 950, 2024-01-15
 *   Samsung Galaxy S24 Ultra 512GB Black Global 5pcs $1100
 *
 * Extracted fields:
 *   supplier, product, model, storage, color, region, quantity, currency, price, date
 */

const STORAGE_PATTERN = /(\d+\s*(?:GB|TB))/i;
const QUANTITY_PATTERN = /(?:qty|quantity|pcs?|units?)[:\s]+(\d+)|(\d+)\s*(?:pcs?|units?)/i;
const CURRENCY_PRICE_PATTERN =
  /(?:(USD|EUR|AED|CNY|RUB|GBP|JPY|KRW|SGD)\s*(\d[\d,.]*))|(?:\$\s*(\d[\d,.]*))|(?:(\d[\d,.]*)\s*(USD|EUR|AED|CNY|RUB|GBP|JPY|KRW|SGD))/i;
const DATE_PATTERN = /(\d{4}-\d{2}-\d{2})|(\d{2}[-/.]\d{2}[-/.]\d{4})|(\d{2}[-/.]\d{2}[-/.]\d{2})/;

const REGIONS = [
  'Global',
  'Japan',
  'USA',
  'EU',
  'Europe',
  'China',
  'HK',
  'Hong Kong',
  'Korea',
  'Korea South',
  'UAE',
  'Russia',
  'MiddleEast',
  'Middle East',
  'Singapore',
  'Taiwan',
  'India',
];
const REGION_PATTERN = new RegExp(`\\b(${REGIONS.join('|')})\\b`, 'i');

const COLORS = [
  'Black',
  'White',
  'Silver',
  'Gold',
  'Blue',
  'Red',
  'Green',
  'Purple',
  'Pink',
  'Yellow',
  'Orange',
  'Gray',
  'Grey',
  'Titanium',
  'Natural Titanium',
  'Black Titanium',
  'White Titanium',
  'Blue Titanium',
  'Desert Titanium',
  'Midnight',
  'Starlight',
  'Graphite',
  'Sierra Blue',
  'Alpine Green',
  'Deep Purple',
  'Space Black',
  'Space Gray',
  'Space Grey',
  'Coral',
  'Rose Gold',
  'Phantom Black',
  'Phantom White',
  'Cream',
  'Lavender',
];
const COLOR_PATTERN = new RegExp(`\\b(${COLORS.join('|')})\\b`, 'i');

const KNOWN_BRANDS = [
  'Apple',
  'Samsung',
  'Xiaomi',
  'Huawei',
  'OPPO',
  'Vivo',
  'OnePlus',
  'Google',
  'Sony',
  'LG',
  'Motorola',
  'Nokia',
  'Realme',
  'Nothing',
  'Honor',
  'Tecno',
  'Infinix',
  'Asus',
  'Lenovo',
];

/**
 * Normalises a price string like "1,050.00" → 1050.00
 */
function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Normalises a date string to ISO YYYY-MM-DD.
 */
function normaliseDate(raw) {
  if (!raw) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY or DD-MM-YYYY
  const parts = raw.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    // YY format – assume 20xx
    return `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return raw;
}

/**
 * Attempts to extract brand + model from the message text.
 * Returns { product, model }
 */
function extractProductModel(text) {
  const brand = KNOWN_BRANDS.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(text));
  let product = brand || null;

  // Remove storage, color, region, qty/price tokens to isolate model text
  let cleaned = text
    .replace(STORAGE_PATTERN, '')
    .replace(COLOR_PATTERN, '')
    .replace(REGION_PATTERN, '')
    .replace(QUANTITY_PATTERN, '')
    .replace(CURRENCY_PRICE_PATTERN, '')
    .replace(DATE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove commas / punctuation and split tokens
  const tokens = cleaned.replace(/[,;]/g, ' ').split(/\s+/).filter(Boolean);

  // Model = tokens after the brand name (heuristic: up to 4 tokens)
  let modelTokens;
  if (brand) {
    const idx = tokens.findIndex((t) => t.toLowerCase() === brand.toLowerCase());
    modelTokens = tokens.slice(idx + 1, idx + 5);
  } else {
    modelTokens = tokens.slice(0, 4);
    if (modelTokens.length > 0) product = modelTokens[0];
  }

  const model = modelTokens.join(' ') || null;
  return { product, model };
}

/**
 * Main parser function.
 * @param {string} text - Raw message text from supplier.
 * @param {string} [supplier] - Supplier identifier (phone / name).
 * @returns {object} Parsed procurement record.
 */
function parseSupplierMessage(text, supplier = null) {
  if (!text || typeof text !== 'string') {
    throw new Error('Message text must be a non-empty string');
  }

  // Truncate input to prevent ReDoS on pathological inputs
  const safeText = text.slice(0, 1000);

  const storageMatch = safeText.match(STORAGE_PATTERN);
  const storage = storageMatch ? storageMatch[1].toUpperCase().replace(/\s+/, '') : null;

  const qtyMatch = safeText.match(QUANTITY_PATTERN);
  const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2], 10) : null;

  const priceMatch = safeText.match(CURRENCY_PRICE_PATTERN);
  let currency = null;
  let price = null;
  if (priceMatch) {
    if (priceMatch[1]) {
      currency = priceMatch[1].toUpperCase();
      price = parsePrice(priceMatch[2]);
    } else if (priceMatch[3]) {
      currency = 'USD';
      price = parsePrice(priceMatch[3]);
    } else if (priceMatch[4] && priceMatch[5]) {
      currency = priceMatch[5].toUpperCase();
      price = parsePrice(priceMatch[4]);
    }
  }

  const colorMatch = safeText.match(COLOR_PATTERN);
  const color = colorMatch ? colorMatch[1] : null;

  const regionMatch = safeText.match(REGION_PATTERN);
  const region = regionMatch ? regionMatch[1] : null;

  const dateMatch = safeText.match(DATE_PATTERN);
  const rawDate = dateMatch ? dateMatch[0] : null;
  const date = rawDate ? normaliseDate(rawDate) : new Date().toISOString().slice(0, 10);

  const { product, model } = extractProductModel(safeText);

  return {
    supplier: supplier || null,
    product,
    model,
    storage,
    color,
    region,
    quantity,
    currency,
    price,
    date,
  };
}

module.exports = { parseSupplierMessage };
