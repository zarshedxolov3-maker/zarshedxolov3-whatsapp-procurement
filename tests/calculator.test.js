'use strict';

const { calculateLandedCost } = require('../src/services/calculator');

describe('calculateLandedCost', () => {
  const base = {
    quoteId: null,
    quantity: 100,
    shippingCost: 500,
    otherCosts: 50,
    unitPriceUsd: 10,
  };

  it('calculates total landed cost correctly', () => {
    const result = calculateLandedCost({ ...base, dutyRate: 0.05 });
    // productCost = 100 * 10 = 1000
    // dutiesCost  = 1000 * 0.05 = 50
    // total       = 1000 + 500 + 50 + 50 = 1600
    expect(result.productCost).toBe(1000);
    expect(result.dutiesCost).toBe(50);
    expect(result.totalLandedCost).toBe(1600);
    expect(result.landedCostPerUnit).toBe(16);
  });

  it('calculates gross profit and margin when sellingPrice is provided', () => {
    const result = calculateLandedCost({ ...base, dutyRate: 0.05, sellingPrice: 25 });
    // revenue = 25 * 100 = 2500
    // grossProfit = 2500 - 1600 = 900
    // margin = 900/2500 * 100 = 36%
    expect(result.revenue).toBe(2500);
    expect(result.grossProfit).toBe(900);
    expect(result.profitMarginPct).toBe(36);
  });

  it('leaves profit fields null when sellingPrice is not provided', () => {
    const result = calculateLandedCost({ ...base, dutyRate: 0.05 });
    expect(result.grossProfit).toBeNull();
    expect(result.profitMarginPct).toBeNull();
    expect(result.revenue).toBeNull();
  });

  it('uses fallback duty rate when no hsChapter or dutyRate provided', () => {
    const result = calculateLandedCost({ ...base });
    // fallback rate = 0.05
    expect(result.dutiesRate).toBe(0.05);
  });

  it('uses HS chapter duty rate', () => {
    const result = calculateLandedCost({ ...base, hsChapter: 72 });
    // chapter 72 = 0.05
    expect(result.dutiesRate).toBe(0.05);
    const result2 = calculateLandedCost({ ...base, hsChapter: 63 });
    // chapter 63 = 0.12
    expect(result2.dutiesRate).toBe(0.12);
  });

  it('throws on invalid quantity', () => {
    expect(() => calculateLandedCost({ ...base, quantity: 0 })).toThrow();
    expect(() => calculateLandedCost({ ...base, quantity: -5 })).toThrow();
  });

  it('throws on negative shippingCost', () => {
    expect(() => calculateLandedCost({ ...base, shippingCost: -1 })).toThrow();
  });

  it('throws on missing unitPrice when no quoteId', () => {
    expect(() => calculateLandedCost({ quantity: 10, shippingCost: 100 })).toThrow();
  });

  it('defaults otherCosts to 0', () => {
    const result = calculateLandedCost({ quoteId: null, quantity: 10, shippingCost: 0, unitPriceUsd: 5, dutyRate: 0 });
    expect(result.otherCosts).toBe(0);
    expect(result.totalLandedCost).toBe(50);
  });
});
