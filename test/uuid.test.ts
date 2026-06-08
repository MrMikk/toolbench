// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generate, hexToken, nanoid, numericPin, uuidV4 } from '../src/apps/uuid/logic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('uuid / token generator', () => {
  it('produces RFC-4122 v4 UUIDs', () => {
    expect(uuidV4()).toMatch(UUID_RE);
  });

  it('nanoid has the requested length and a URL-safe alphabet', () => {
    const id = nanoid(21);
    expect(id).toHaveLength(21);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hex token is the right length and hex-only', () => {
    expect(hexToken(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('numeric pin is digits of the requested length', () => {
    expect(numericPin(8)).toMatch(/^[0-9]{8}$/);
  });

  it('generate clamps the count to 1–100', () => {
    expect(generate('uuid', 0)).toHaveLength(1);
    expect(generate('uuid', 999)).toHaveLength(100);
    expect(generate('hex', 3)).toHaveLength(3);
  });

  it('generates distinct values', () => {
    const list = generate('uuid', 50);
    expect(new Set(list).size).toBe(50);
  });
});
