import { describe, it, expect } from 'vitest';
import { createAppStorage } from '../src/sdk/storage';

describe('app storage', () => {
  it('stores and retrieves structured values', async () => {
    const s = createAppStorage('test-basic');
    await s.set('k', { n: 1, list: [true, 'x'] });
    expect(await s.get('k')).toEqual({ n: 1, list: [true, 'x'] });
  });

  it('returns undefined for missing keys', async () => {
    const s = createAppStorage('test-missing');
    expect(await s.get('nope')).toBeUndefined();
  });

  it('namespaces values by app slug', async () => {
    const a = createAppStorage('ns-a');
    const b = createAppStorage('ns-b');
    await a.set('shared', 'A');
    await b.set('shared', 'B');
    expect(await a.get('shared')).toBe('A');
    expect(await b.get('shared')).toBe('B');
  });

  it('lists and deletes keys', async () => {
    const s = createAppStorage('test-keys');
    await s.set('x', 1);
    await s.set('y', 2);
    expect((await s.keys()).sort()).toEqual(['x', 'y']);
    await s.delete('x');
    expect(await s.get('x')).toBeUndefined();
    expect(await s.keys()).toEqual(['y']);
  });
});
