'use strict';

const { parseSupplierMessage, extractMessageText } = require('../src/services/messageParser');

describe('parseSupplierMessage', () => {
  it('parses a full structured message', () => {
    const msg = `Product: Steel Pipes
Quantity: 500 kg
Unit Price: 2.50 USD
Delivery: 14 days
Notes: FOB Shanghai`;

    const result = parseSupplierMessage(msg);
    expect(result).toMatchObject({
      productName: 'Steel Pipes',
      quantity: 500,
      unit: 'kg',
      unitPrice: 2.5,
      currency: 'USD',
      deliveryDays: 14,
      notes: 'FOB Shanghai',
    });
  });

  it('parses a minimal message (product + price only)', () => {
    const result = parseSupplierMessage('Product: Widget\nPrice: 10.00 USD');
    expect(result).not.toBeNull();
    expect(result.productName).toBe('Widget');
    expect(result.unitPrice).toBe(10.0);
  });

  it('returns null when product is missing', () => {
    expect(parseSupplierMessage('Price: 10 USD')).toBeNull();
  });

  it('returns null when price is missing', () => {
    expect(parseSupplierMessage('Product: Widget\nQuantity: 100 pcs')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseSupplierMessage('')).toBeNull();
    expect(parseSupplierMessage(null)).toBeNull();
  });

  it('defaults currency to USD when not specified', () => {
    const result = parseSupplierMessage('Product: Bolts\nPrice: 0.05');
    expect(result).not.toBeNull();
    expect(result.currency).toBe('USD');
  });

  it('detects EUR currency in price line', () => {
    const result = parseSupplierMessage('Product: Gears\nUnit Price: 5.00 EUR\nQuantity: 200 pcs');
    expect(result.currency).toBe('EUR');
  });

  it('parses comma-formatted numbers', () => {
    const result = parseSupplierMessage('Product: Copper Wire\nPrice: 1,500.00 USD\nQty: 1,000 kg');
    expect(result.unitPrice).toBe(1500.0);
    expect(result.quantity).toBe(1000);
  });
});

describe('extractMessageText', () => {
  it('extracts body from text message', () => {
    const msg = { type: 'text', text: { body: 'hello' } };
    expect(extractMessageText(msg)).toBe('hello');
  });

  it('returns null for non-text message types', () => {
    expect(extractMessageText({ type: 'image', image: {} })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(extractMessageText(null)).toBeNull();
  });
});
