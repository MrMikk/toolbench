/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Project pages serve from https://<user>.github.io/toolbench/.
// Override with BASE_PATH=/ for a custom domain or local root serving.
const base = process.env.BASE_PATH ?? '/toolbench/';

/**
 * GitHub Pages has no SPA history fallback, so a hard refresh on a deep link
 * (e.g. /toolbench/a/encoder) 404s. Copying index.html -> 404.html makes Pages
 * serve the app shell for unknown paths, after which the client router resolves.
 */
function spaFallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const out = resolve(__dirname, 'dist');
      const index = resolve(out, 'index.html');
      if (existsSync(index)) copyFileSync(index, resolve(out, '404.html'));
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Toolbench',
        short_name: 'Toolbench',
        description: 'A client-side platform of small, independent tools.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
    spaFallback(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
