import { describe, it, expect } from 'vitest';
import { diffLines } from '../src/apps/diff/logic';

describe('diff viewer', () => {
  it('marks identical inputs as all equal', () => {
    const r = diffLines('a\nb\nc', 'a\nb\nc');
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.rows.every((row) => row.type === 'eq')).toBe(true);
  });

  it('detects a single inserted line', () => {
    const r = diffLines('a\nc', 'a\nb\nc');
    expect(r.added).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.rows.find((row) => row.type === 'add')?.text).toBe('b');
  });

  it('detects a single removed line', () => {
    const r = diffLines('a\nb\nc', 'a\nc');
    expect(r.added).toBe(0);
    expect(r.removed).toBe(1);
    expect(r.rows.find((row) => row.type === 'del')?.text).toBe('b');
  });

  it('represents a modified line as a removal plus an addition', () => {
    const r = diffLines('hello', 'world');
    expect(r.added).toBe(1);
    expect(r.removed).toBe(1);
  });

  it('preserves the common subsequence order', () => {
    const r = diffLines('a\nx\nb', 'a\ny\nb');
    expect(r.rows.filter((row) => row.type === 'eq').map((row) => row.text)).toEqual(['a', 'b']);
  });
});
