export type Radix = 2 | 8 | 10 | 16;

export interface Bases {
  bin: string;
  oct: string;
  dec: string;
  hex: string;
}

function parseDigits(str: string, radix: number): bigint {
  if (!str) throw new Error('No digits to parse.');
  const base = BigInt(radix);
  let acc = 0n;
  for (const ch of str) {
    const d = parseInt(ch, radix);
    if (Number.isNaN(d) || d >= radix) {
      throw new Error(`"${ch}" is not a valid base-${radix} digit.`);
    }
    acc = acc * base + BigInt(d);
  }
  return acc;
}

/** Parse a number, auto-detecting 0x/0o/0b prefixes when `radix` is omitted. */
export function parseNumber(input: string, radix?: Radix): bigint {
  let s = input.trim().toLowerCase();
  if (!s) throw new Error('Enter a number.');

  let negative = false;
  if (s[0] === '-') {
    negative = true;
    s = s.slice(1);
  } else if (s[0] === '+') {
    s = s.slice(1);
  }

  let effective = radix;
  if (effective === undefined) {
    if (s.startsWith('0x')) {
      effective = 16;
      s = s.slice(2);
    } else if (s.startsWith('0b')) {
      effective = 2;
      s = s.slice(2);
    } else if (s.startsWith('0o')) {
      effective = 8;
      s = s.slice(2);
    } else {
      effective = 10;
    }
  } else {
    const prefix = { 16: '0x', 2: '0b', 8: '0o', 10: '' }[effective];
    if (prefix && s.startsWith(prefix)) s = s.slice(2);
  }

  const value = parseDigits(s, effective);
  return negative ? -value : value;
}

export function toBases(value: bigint): Bases {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const sign = negative ? '-' : '';
  return {
    bin: sign + abs.toString(2),
    oct: sign + abs.toString(8),
    dec: sign + abs.toString(10),
    hex: sign + abs.toString(16),
  };
}
