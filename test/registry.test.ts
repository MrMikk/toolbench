import { describe, it, expect } from 'vitest';
import { apps, findApp } from '../src/apps/registry';

describe('app registry', () => {
  it('has unique slugs', () => {
    const slugs = apps.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every app has valid metadata and a loader', () => {
    for (const app of apps) {
      expect(app.slug).toMatch(/^[a-z0-9-]+$/);
      expect(app.title).toBeTruthy();
      expect(typeof app.load).toBe('function');
    }
  });

  it('findApp resolves known slugs and rejects unknown ones', () => {
    expect(findApp('encoder')?.slug).toBe('encoder');
    expect(findApp('does-not-exist')).toBeUndefined();
  });

  it('every lazy module exposes a default component export', async () => {
    for (const app of apps) {
      const mod = await app.load();
      expect(typeof mod.default).toBe('function');
    }
  });
});
