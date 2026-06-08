import { describe, it, expect } from 'vitest';
import { parseNumber, toBases } from '../src/apps/base/logic';

describe('number base converter', () => {
  it('converts decimal to every base', () => {
    expect(toBases(parseNumber('255'))).toEqual({
      bin: '11111111',
      oct: '377',
      dec: '255',
      hex: 'ff',
    });
  });

  it('auto-detects 0x / 0b / 0o prefixes', () => {
    expect(parseNumber('0xff')).toBe(255n);
    expect(parseNumber('0b1010')).toBe(10n);
    expect(parseNumber('0o777')).toBe(511n);
  });

  it('respects an explicit input base', () => {
    expect(parseNumber('777', 8)).toBe(511n);
    expect(parseNumber('ff', 16)).toBe(255n);
  });

  it('handles negatives and very large integers', () => {
    expect(toBases(parseNumber('-10')).bin).toBe('-1010');
    const big = '123456789012345678901234567890';
    expect(toBases(parseNumber(big)).dec).toBe(big);
  });

  it('rejects invalid digits and empty input', () => {
    expect(() => parseNumber('0x1g')).toThrow();
    expect(() => parseNumber('2', 2)).toThrow();
    expect(() => parseNumber('')).toThrow();
  });
});
