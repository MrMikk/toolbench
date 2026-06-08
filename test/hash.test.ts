// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeHash, digest, hmac } from '../src/apps/hash/logic';

describe('hash', () => {
  it('computes known SHA-256 digests', async () => {
    expect(await digest('SHA-256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('computes a known SHA-1 digest', async () => {
    expect(await digest('SHA-1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('hashes empty input deterministically', async () => {
    expect(await digest('SHA-256', '')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('computes a known HMAC-SHA256 vector', async () => {
    // RFC 4231-style: key "key", data "The quick brown fox jumps over the lazy dog"
    expect(await hmac('SHA-256', 'key', 'The quick brown fox jumps over the lazy dog')).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    );
  });

  it('computeHash switches to HMAC only when a key is present', async () => {
    expect(await computeHash('SHA-256', 'abc', '')).toBe(await digest('SHA-256', 'abc'));
    expect(await computeHash('SHA-256', 'abc', 'k')).toBe(await hmac('SHA-256', 'k', 'abc'));
  });
});
