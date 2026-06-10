# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                          # dev server
pnpm test                         # run all tests once (vitest)
pnpm vitest run test/cron.test.ts # run a single test file
pnpm test:watch                   # vitest watch mode
pnpm typecheck                    # tsc --noEmit
pnpm build                        # typecheck + production build to dist/
```

Package manager is **pnpm** (pinned via `packageManager`). There is no lint
script; `pnpm build` (tsc) is the correctness gate that CI runs.

## Documentation policy

**After every change or feature, update `README.md` and `docs/apps.md` to
match.** Concretely: a new app gets a row in both README and docs/apps.md
tables plus a section in docs/apps.md; a changed app (new options, modes,
commands, limits) gets its docs section and its registry `description`
refreshed. Docs describe actual behavior — verify claims against the code, and
treat a PR as incomplete until the docs reflect it.

## Architecture

Toolbench is a client-side mini-apps platform: one Preact shell hosting
independent, browser-only tools. No backend; state lives in IndexedDB.

The big-picture contract spans three layers:

- **`src/sdk/`** — the host↔app contract. `AppContext` gives an app exactly
  three capabilities: `storage` (async KV, backed by a *separate IndexedDB
  database per app slug* — `toolbench:<slug>` — so apps can't collide),
  `navigate(slug)`, and `registerCommands()` (spotlight contributions that
  live only while the app is mounted). Grow the SDK only when a real app
  needs it.
- **`src/apps/registry.tsx`** — the single source of truth. A `MiniApp` entry
  = slug + title + description + icon + `load: () => import('./<slug>')`.
  Routing (`/a/<slug>`), the launcher grid, and the ⌘K spotlight all derive
  from this array; the shell is never touched when adding an app.
- **`src/shell/`** — router, nav, spotlight (fuzzy matching in `fuzzy.ts`),
  theme. Apps must not import from `shell/`; they see only the SDK and
  `src/ui/` primitives (`Button`, `Field`, `Select`, `Toolbar`, `CopyButton`,
  and `CodeEditor` in `ui/code.tsx`).

### Per-app conventions

Each app is `src/apps/<slug>/` with `index.tsx` (component) and `logic.ts`
(pure, DOM-free logic). Tests in `test/<slug>.test.ts` import from `logic.ts`
directly — keep logic testable without rendering. Component tests use
`@testing-library/preact` with jsdom and `fake-indexeddb` (see
`test/setup.ts`).

Apps persist their UI state via `ctx.storage` under a `'state'` key, using a
`loaded` ref to avoid writing back before the initial read resolves — copy an
existing app (e.g. `src/apps/formatter/index.tsx`) for the pattern.

### Bundle discipline

Every app is its own code-split chunk via the registry's dynamic `load`.
Heavy dependencies must be dynamically imported at the point of use, not at
module top level — the formatter's Prettier plugins and sql-formatter are the
reference pattern (each language's formatter is a separate lazy chunk).
JSON/XML formatting is hand-rolled and dependency-free on purpose.

### Deployment

CI (`.github/workflows/ci.yml`) tests + builds every push and deploys `main`
to GitHub Pages. The site serves from `/toolbench/` (Vite `base`; override
with `BASE_PATH=/`). Pages has no SPA fallback, so the build copies
`index.html` → `404.html`. The PWA plugin precaches all built assets — be
mindful that large new dependencies grow the offline install.
