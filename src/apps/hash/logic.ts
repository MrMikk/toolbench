export type HashAlgo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export const HASH_ALGOS: readonly HashAlgo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hex digest of `text` (UTF-8) using the given SubtleCrypto algorithm. */
export async function digest(algo: HashAlgo, text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  return toHex(await crypto.subtle.digest(algo, data));
}

/** Hex HMAC of `text` keyed by `key`, both UTF-8. */
export async function hmac(algo: HashAlgo, key: string, text: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: algo },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(text));
  return toHex(sig);
}

/** Digest or HMAC depending on whether a key is supplied. */
export async function computeHash(
  algo: HashAlgo,
  text: string,
  key: string,
): Promise<string> {
  return key ? hmac(algo, key, text) : digest(algo, text);
}
