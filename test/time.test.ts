import { describe, it, expect } from 'vitest';
import { iso, parseInput, relativeTime, unixSeconds } from '../src/apps/time/logic';

describe('timestamp converter', () => {
  it('parses unix seconds', () => {
    expect(iso(parseInput('1516239022'))).toBe('2018-01-18T01:30:22.000Z');
  });

  it('detects millisecond timestamps by magnitude', () => {
    expect(iso(parseInput('1516239022000'))).toBe('2018-01-18T01:30:22.000Z');
  });

  it('parses ISO strings back to the same instant', () => {
    expect(unixSeconds(parseInput('2018-01-18T01:30:22Z'))).toBe(1516239022);
  });

  it('throws on unrecognised input', () => {
    expect(() => parseInput('not a date')).toThrow();
    expect(() => parseInput('')).toThrow();
  });

  it('formats relative time around a fixed clock', () => {
    const now = new Date('2020-01-01T00:00:00Z');
    expect(relativeTime(new Date('2020-01-01T00:00:00Z'), now)).toBe('now');
    expect(relativeTime(new Date('2020-01-01T02:00:00Z'), now)).toBe('in 2 hours');
    expect(relativeTime(new Date('2019-12-31T23:00:00Z'), now)).toBe('1 hour ago');
  });
});
