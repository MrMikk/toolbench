import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AppProps } from '../../sdk';
import { CopyButton, Field, Input, Toolbar } from '../../ui';
import {
  contrastRatio,
  parseColor,
  rgbToHex,
  rgbToHsl,
  wcagLevel,
  type RGB,
} from './logic';

const STORAGE_KEY = 'input';
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

export default function ColorApp({ ctx }: AppProps) {
  const [input, setInput] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    ctx.storage.get<string>(STORAGE_KEY).then((saved) => {
      setInput(typeof saved === 'string' && saved ? saved : '#0ea5e9');
      loaded.current = true;
    });
  }, [ctx]);

  useEffect(() => {
    if (!loaded.current) return;
    void ctx.storage.set<string>(STORAGE_KEY, input);
  }, [ctx, input]);

  const rgb = useMemo(() => (input.trim() ? parseColor(input) : null), [input]);

  const rows = useMemo(() => {
    if (!rgb) return null;
    const hsl = rgbToHsl(rgb);
    return {
      hex: rgbToHex(rgb),
      rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      onWhite: contrastRatio(rgb, WHITE),
      onBlack: contrastRatio(rgb, BLACK),
    };
  }, [rgb]);

  return (
    <div class="stack">
      <Toolbar>
        <Field label="Color (hex, rgb() or hsl())">
          <Input
            value={input}
            class={input.trim() && !rgb ? 'has-error' : ''}
            placeholder="#0ea5e9, rgb(14 165 233), hsl(199 89% 48%)…"
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          />
        </Field>
        <Field label="Pick">
          <input
            type="color"
            class="color-picker"
            aria-label="Pick a color"
            value={rgb ? rgbToHex(rgb) : '#000000'}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          />
        </Field>
      </Toolbar>

      {input.trim() && !rgb && <p class="error-text">Unrecognised color.</p>}

      {rows && (
        <>
          <div class="swatch" style={{ background: rows.hex }} />

          <div class="kv-table">
            {(['hex', 'rgb', 'hsl'] as const).map((k) => (
              <div class="kv-row" key={k}>
                <span class="kv-label">{k.toUpperCase()}</span>
                <span class="kv-value">{rows[k]}</span>
                <CopyButton variant="ghost" value={rows[k]} />
              </div>
            ))}
          </div>

          <Field label="Contrast (WCAG)">
            <div class="kv-table">
              <div class="kv-row">
                <span class="kv-label">On white</span>
                <span class="kv-value">{rows.onWhite.toFixed(2)}:1</span>
                <span class={`badge badge-${wcagLevel(rows.onWhite) === 'Fail' ? 'fail' : 'pass'}`}>
                  {wcagLevel(rows.onWhite)}
                </span>
              </div>
              <div class="kv-row">
                <span class="kv-label">On black</span>
                <span class="kv-value">{rows.onBlack.toFixed(2)}:1</span>
                <span class={`badge badge-${wcagLevel(rows.onBlack) === 'Fail' ? 'fail' : 'pass'}`}>
                  {wcagLevel(rows.onBlack)}
                </span>
              </div>
            </div>
          </Field>
        </>
      )}
    </div>
  );
}
