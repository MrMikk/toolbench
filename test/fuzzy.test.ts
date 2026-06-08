import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyFilter } from '../src/shell/fuzzy';

describe('fuzzyScore', () => {
  it('matches subsequences', () => {
    expect(fuzzyScore('fmt', 'Formatter')).not.toBeNull();
    expect(fuzzyScore('enc', 'Encoder / Decoder')).not.toBeNull();
  });

  it('returns null when chars are missing or out of order', () => {
    expect(fuzzyScore('zzz', 'Formatter')).toBeNull();
    expect(fuzzyScore('rof', 'Formatter')).toBeNull();
  });

  it('treats an empty query as a match', () => {
    expect(fuzzyScore('', 'anything')).toBe(0);
  });

  it('ranks word-boundary matches higher than mid-word ones', () => {
    const boundary = fuzzyScore('ad', 'Add Item')!;
    const midWord = fuzzyScore('ad', 'Gradual')!;
    expect(boundary).toBeGreaterThan(midWord);
  });
});

describe('fuzzyFilter', () => {
  const items = ['Encoder', 'Formatter', 'Home'];

  it('filters and ranks by relevance', () => {
    expect(fuzzyFilter('form', items, (s) => s)).toEqual(['Formatter']);
  });

  it('returns a copy of all items for a blank query', () => {
    expect(fuzzyFilter('  ', items, (s) => s)).toHaveLength(3);
  });
});
