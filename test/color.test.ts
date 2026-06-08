import { describe, it, expect } from 'vitest';
import {
  contrastRatio,
  hslToRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
  wcagLevel,
} from '../src/apps/color/logic';

describe('color converter', () => {
  it('parses shorthand and full hex', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('0ea5e9')).toEqual({ r: 14, g: 165, b: 233 });
  });

  it('parses rgb() and hsl()', () => {
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for nonsense and out-of-range', () => {
    expect(parseColor('teal-ish')).toBeNull();
    expect(parseColor('rgb(300, 0, 0)')).toBeNull();
  });

  it('round-trips rgb → hex → hsl for primaries', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('computes WCAG contrast and levels', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
    expect(wcagLevel(21)).toBe('AAA');
    expect(wcagLevel(4.6)).toBe('AA');
    expect(wcagLevel(2)).toBe('Fail');
    expect(wcagLevel(3, true)).toBe('AA');
  });
});
