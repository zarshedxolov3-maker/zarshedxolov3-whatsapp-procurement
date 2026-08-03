const { calculatePricing, compareWithTitan, estimateWeightKg } = require('../src/services/pricing');

describe('estimateWeightKg', () => {
  it('returns iPhone weight for iphone product', () => {
    expect(estimateWeightKg('iPhone 15 Pro')).toBe(0.2);
  });

  it('returns default weight for unknown product', () => {
    expect(estimateWeightKg('Unknown Device')).toBe(0.2);
  });

  it('returns MacBook weight for macbook product', () => {
    expect(estimateWeightKg('MacBook Pro')).toBe(1.4);
  });
});

describe('calculatePricing', () => {
  it('throws when price is invalid', () => {
    expect(() => calculatePricing({ price: -10, quantity: 5 })).toThrow();
    expect(() => calculatePricing({ price: 0, quantity: 5 })).toThrow();
  });

  it('throws when quantity is invalid', () => {
    expect(() => calculatePricing({ price: 100, quantity: 0 })).toThrow();
  });

  it('calculates cargoCost correctly', () => {
    // cargoRatePerKg=5, weight=0.2kg, qty=10 → cargo = 5 * 0.2 * 10 = 10
    const result = calculatePricing({
      price: 950,
      quantity: 10,
      product: 'iPhone',
      cargoRatePerKg: 5,
    });
    expect(result.cargoCost).toBe(10);
    expect(result.totalPurchaseCost).toBe(9500);
    // costPerUnit = (9500 + 10) / 10 = 951
    expect(result.costPerUnit).toBe(951);
  });

  it('calculates margin correctly for given selling price', () => {
    const result = calculatePricing({
      price: 100,
      quantity: 1,
      cargoRatePerKg: 0,
      sellingPrice: 120,
    });
    // profit = 120 - 100 = 20, margin = 20/120 = 16.67%
    expect(result.profitPerUnit).toBe(20);
    expect(result.marginPercent).toBeCloseTo(16.67, 1);
  });

  it('suggests a selling price to achieve default margin', () => {
    const result = calculatePricing({
      price: 100,
      quantity: 1,
      cargoRatePerKg: 0,
      marginPercent: 20,
    });
    // suggestedSellingPrice = 100 / (1 - 0.20) = 125
    expect(result.suggestedSellingPrice).toBeCloseTo(125, 1);
  });

  it('returns zero margin when sellingPrice equals costPerUnit', () => {
    const result = calculatePricing({
      price: 100,
      quantity: 1,
      cargoRatePerKg: 0,
      sellingPrice: 100,
    });
    expect(result.profitPerUnit).toBe(0);
    expect(result.marginPercent).toBe(0);
  });
});

describe('compareWithTitan', () => {
  it('marks as competitive when unit cost is below titan price', () => {
    const result = compareWithTitan(900, 1000);
    expect(result.competitive).toBe(true);
    expect(result.priceDiff).toBe(-100);
  });

  it('marks as not competitive when unit cost is above titan price', () => {
    const result = compareWithTitan(1100, 1000);
    expect(result.competitive).toBe(false);
    expect(result.priceDiff).toBe(100);
  });

  it('returns nulls when titan price is not a positive number', () => {
    const result = compareWithTitan(950, null);
    expect(result.titanPrice).toBeNull();
    expect(result.competitive).toBeNull();
  });

  it('calculates priceDiffPercent correctly', () => {
    const result = compareWithTitan(1050, 1000);
    expect(result.priceDiffPercent).toBeCloseTo(5, 1);
  });
});
