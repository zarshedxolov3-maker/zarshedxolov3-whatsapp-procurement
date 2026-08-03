const { parseSupplierMessage } = require('../src/services/parser');

describe('parseSupplierMessage', () => {
  it('throws when text is empty', () => {
    expect(() => parseSupplierMessage('')).toThrow();
  });

  it('throws when text is not a string', () => {
    expect(() => parseSupplierMessage(null)).toThrow();
  });

  it('extracts price, currency, storage, color, region, quantity and date', () => {
    const result = parseSupplierMessage(
      'Apple iPhone 15 Pro 256GB Natural Titanium Japan 10 pcs USD 950 2024-03-01',
    );
    expect(result.price).toBe(950);
    expect(result.currency).toBe('USD');
    expect(result.storage).toBe('256GB');
    expect(result.color).toBe('Natural Titanium');
    expect(result.region).toBe('Japan');
    expect(result.quantity).toBe(10);
    expect(result.date).toBe('2024-03-01');
  });

  it('sets the supplier from the second argument', () => {
    const result = parseSupplierMessage('iPhone 15 256GB USD 800 qty 5', '+15551234567');
    expect(result.supplier).toBe('+15551234567');
  });

  it('parses $ shorthand as USD', () => {
    const result = parseSupplierMessage('Samsung Galaxy S24 Ultra 512GB Black 5pcs $1100');
    expect(result.currency).toBe('USD');
    expect(result.price).toBe(1100);
  });

  it('parses price written as AMOUNT CURRENCY', () => {
    const result = parseSupplierMessage('Xiaomi 14 Ultra 512GB Black Global 3 units 900 EUR');
    expect(result.currency).toBe('EUR');
    expect(result.price).toBe(900);
  });

  it('returns today as date when no date is in the message', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = parseSupplierMessage('iPhone 15 128GB USD 850 qty 2');
    expect(result.date).toBe(today);
  });

  it('normalises DD/MM/YYYY date format', () => {
    const result = parseSupplierMessage('iPhone 15 128GB USD 850 qty 2 15/03/2024');
    expect(result.date).toBe('2024-03-15');
  });

  it('extracts Apple product', () => {
    const result = parseSupplierMessage('Apple MacBook Pro 16 512GB USD 2000 qty 2');
    expect(result.product).toBe('Apple');
  });

  it('handles message without quantity', () => {
    const result = parseSupplierMessage('iPhone 15 Pro 256GB USD 950');
    expect(result.quantity).toBeNull();
    expect(result.price).toBe(950);
  });

  it('handles comma-formatted price', () => {
    const result = parseSupplierMessage('iPhone 15 Pro 256GB USD 1,050.00 qty 5');
    expect(result.price).toBe(1050);
  });
});
