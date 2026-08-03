'use strict';

const { toUsd } = require('../src/services/priceComparison');

describe('toUsd', () => {
  it('converts EUR to USD', () => {
    expect(toUsd(100, 'EUR')).toBeCloseTo(108, 0);
  });

  it('returns same value for USD', () => {
    expect(toUsd(100, 'USD')).toBe(100);
  });

  it('converts CNY to USD', () => {
    expect(toUsd(1000, 'CNY')).toBeCloseTo(138, 0);
  });

  it('falls back to rate 1 for unknown currencies', () => {
    expect(toUsd(50, 'XYZ')).toBe(50);
  });

  it('handles lowercase currency codes', () => {
    expect(toUsd(100, 'eur')).toBeCloseTo(108, 0);
  });
});
