export type TokenKind = 'uuid' | 'nanoid' | 'hex' | 'pin';

export const TOKEN_KINDS: { id: TokenKind; label: string }[] = [
  { id: 'uuid', label: 'UUID v4' },
  { id: 'nanoid', label: 'NanoID (21 chars)' },
  { id: 'hex', label: 'Hex token (32 chars)' },
  { id: 'pin', label: 'Numeric PIN (6 digits)' },
];

// 64 URL-safe symbols; 64 divides 256 so masking bytes with 63 is unbiased.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function uuidV4(): string {
  return crypto.randomUUID();
}

export function nanoid(size = 21): string {
  let id = '';
  for (const b of randomBytes(size)) id += ALPHABET[b & 63];
  return id;
}

export function hexToken(bytes = 16): string {
  return Array.from(randomBytes(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function numericPin(len = 6): string {
  let pin = '';
  for (const b of randomBytes(len)) pin += (b % 10).toString();
  return pin;
}

/** Generate `count` (clamped 1–100) values of the requested kind. */
export function generate(kind: TokenKind, count: number): string[] {
  const n = Math.max(1, Math.min(100, Math.floor(count) || 1));
  const make = {
    uuid: () => uuidV4(),
    nanoid: () => nanoid(),
    hex: () => hexToken(),
    pin: () => numericPin(),
  }[kind];
  return Array.from({ length: n }, make);
}
