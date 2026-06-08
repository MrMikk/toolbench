# Toolbench

A client-side **mini-apps platform**: a single shell that hosts small, independent,
browser-only tools. State lives in the browser (IndexedDB); there is no backend.
Apps are reachable via the nav, URL slugs (`/a/<slug>`), and a `⌘K` / `Ctrl+K`
spotlight command palette.

Built with **Vite + Preact + TypeScript**. Installable as a PWA and deployed to
GitHub Pages.

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
the shell is never touched.

## Deployment

CI (`.github/workflows/ci.yml`) runs tests + build on every push/PR and deploys
`main` to **GitHub Pages**. Two one-time setup steps in the repo:

- **Settings → Pages → Build and deployment → Source: GitHub Actions.**
- The site serves from `/toolbench/`, set via Vite `base`. For a custom domain or
  root deploy, set `BASE_PATH=/` for the build.

Because GitHub Pages has no SPA history fallback, the build copies `index.html`
to `404.html` so deep links resolve.
