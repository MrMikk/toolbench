export type EncoderMode =
  | 'url-encode'
  | 'url-decode'
  | 'base64-encode'
  | 'base64-decode'
  | 'html-encode'
  | 'html-decode';

export interface EncoderOp {
  id: EncoderMode;
  label: string;
  group: string;
  run: (input: string) => string;
}

// --- Base64 (UTF-8 safe) ---
function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(input: string): string {
  const binary = atob(input.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// --- HTML entities ---
const HTML_ENCODE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const HTML_NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function htmlEncode(input: string): string {
  return input.replace(/[&<>"']/g, (c) => HTML_ENCODE[c]);
}

function htmlDecode(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return entity in HTML_NAMED ? HTML_NAMED[entity] : match;
  });
}

export const ENCODER_OPS: readonly EncoderOp[] = [
  { id: 'url-encode', label: 'URL · Encode', group: 'URL', run: (s) => encodeURIComponent(s) },
  { id: 'url-decode', label: 'URL · Decode', group: 'URL', run: (s) => decodeURIComponent(s) },
  { id: 'base64-encode', label: 'Base64 · Encode', group: 'Base64', run: utf8ToBase64 },
  { id: 'base64-decode', label: 'Base64 · Decode', group: 'Base64', run: base64ToUtf8 },
  { id: 'html-encode', label: 'HTML entities · Encode', group: 'HTML', run: htmlEncode },
  { id: 'html-decode', label: 'HTML entities · Decode', group: 'HTML', run: htmlDecode },
];

export function runEncoder(mode: EncoderMode, input: string): string {
  const op = ENCODER_OPS.find((o) => o.id === mode);
  if (!op) throw new Error(`Unknown transform: ${mode}`);
  return op.run(input);
}
