# Toolbench

A client-side **mini-apps platform**: a single shell that hosts small, independent,
browser-only tools. State lives in the browser (IndexedDB); there is no backend.
Apps are reachable via the nav, URL slugs (`/a/<slug>`), and a `⌘K` / `Ctrl+K`
spotlight command palette. Reopening the site returns you to the last tool you
used.

Built with **Vite + Preact + TypeScript**. Installable as a PWA and deployed to
GitHub Pages.

## The apps

Fifteen tools, all running entirely in your browser — see
**[docs/apps.md](docs/apps.md)** for full documentation of each.

| App | Slug | Description |
| --- | --- | --- |
| Encoder / Decoder | `encoder` | URL, Base64 and HTML-entity encoding and decoding |
| Formatter | `formatter` | Beautify 16 languages via Prettier/sql-formatter; minify JSON/XML |
| JWT Inspector | `jwt` | Decode a JWT's header, payload and time claims (no verification) |
| Hash & HMAC | `hash` | SHA-1/256/384/512 digests and HMACs via Web Crypto |
| UUID / Token | `uuid` | UUID v4, NanoID, hex tokens and PINs, up to 100 at a time |
| Timestamp | `time` | Unix ⇄ ISO 8601 ⇄ local ⇄ relative time |
| Color Converter | `color` | HEX ⇄ RGB ⇄ HSL with a color picker and WCAG contrast badges |
| Regex Tester | `regex` | Live matches, capture groups, flags and replace preview |
| Diff Viewer | `diff` | Minimal line-level diff (LCS) between two texts |
| Case Converter | `case` | camelCase, snake_case, kebab-case, slugs and 4 more styles |
| Number Base | `base` | Binary/octal/decimal/hex conversion, BigInt-exact |
| Cron Explainer | `cron` | Cron expression → English + next 5 run times |
| JSON ⇄ CSV | `convert` | RFC-4180 conversion both ways, with auto-detection |
| Health Checks | `health` | HTTP/curl/JS uptime checks with history sparklines |
| Cloud Monitor | `gcloud` | Read-only Cloud Run & Cloud SQL inventory, metrics and logs |

Every app persists its state per-app to IndexedDB and loads as its own
code-split chunk. Heavy dependencies (Prettier's language plugins,
sql-formatter) are imported on first use, not up front.

## Quick start

```bash
pnpm install
pnpm dev        # dev server
pnpm test       # vitest unit + component tests
pnpm build      # typecheck + production build (outputs dist/)
pnpm preview    # preview the production build
```

## Architecture

```
src/
  shell/    host: router, nav, launcher, spotlight, theme
  sdk/      the host↔app contract: storage, context, types
  ui/       shared UI primitives
  apps/     mini apps + the registry (single source of truth)
docs/
  apps.md   per-app user documentation
```

The host stays tiny on purpose. The SDK (`src/sdk`) grows only when a real app
needs more — it is discovered, not designed up front.

### The app contract

A mini app is a `MiniApp` entry in `src/apps/registry.tsx`:

```ts
{
  slug: 'my-tool',                       // URL segment + spotlight id (unique)
  title: 'My Tool',
  description: 'What it does.',
  icon: MyIcon,
  load: () => import('./my-tool'),       // lazy: its own code-split chunk
}
```

The app's `default` export receives an `AppContext`:

```ts
export default function MyTool({ ctx }: AppProps) {
  // ctx.storage   — async, namespaced key/value persistence (IndexedDB)
  // ctx.navigate  — go to another app by slug
  // ctx.registerCommands — contribute spotlight commands while mounted
}
```

### Adding an app

1. Create `src/apps/<slug>/index.tsx` exporting a default component.
2. Add one entry to `apps` in `src/apps/registry.tsx`.

That's it — routing, the launcher card, and spotlight pick it up automatically;
the shell is never touched. Keep pure logic in a `logic.ts` beside the
component and unit-test it in `test/` (every existing app follows this
pattern). Document the new app in [docs/apps.md](docs/apps.md).

## Deployment

CI (`.github/workflows/ci.yml`) runs tests + build on every push/PR and deploys
`main` to **GitHub Pages**. Two one-time setup steps in the repo:

- **Settings → Pages → Build and deployment → Source: GitHub Actions.**
- The site serves from `/toolbench/`, set via Vite `base`. For a custom domain or
  root deploy, set `BASE_PATH=/` for the build.

Because GitHub Pages has no SPA history fallback, the build copies `index.html`
to `404.html` so deep links resolve.
