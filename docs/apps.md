# Mini apps

Toolbench currently ships **15 mini apps**. Everything runs entirely in the
browser — no requests leave the page except the ones you configure yourself in
Health Checks. Each app persists its state (inputs, options) to IndexedDB, so
your work survives reloads, and each app is its own lazily-loaded chunk.

Every app is reachable three ways: the launcher grid on the home screen, a
direct URL (`/a/<slug>`), and the **⌘K / Ctrl+K spotlight**. Apps marked
*spotlight commands* below also contribute their own actions to the palette
while open. Reopening the site jumps straight back to the **last tool you
used** — navigate Home any time to reach the launcher.

| App | Slug | What it does |
| --- | --- | --- |
| [Encoder / Decoder](#encoder--decoder) | `encoder` | URL, Base64 and HTML-entity encoding/decoding |
| [Formatter](#formatter) | `formatter` | Beautify 16 languages; minify JSON/XML |
| [JWT Inspector](#jwt-inspector) | `jwt` | Decode JWT header, payload and time claims |
| [Hash & HMAC](#hash--hmac) | `hash` | SHA-1/256/384/512 digests and HMACs |
| [UUID / Token](#uuid--token) | `uuid` | UUIDs, NanoIDs, hex tokens, PINs in bulk |
| [Timestamp](#timestamp) | `time` | Unix ⇄ ISO 8601 ⇄ local ⇄ relative time |
| [Color Converter](#color-converter) | `color` | HEX ⇄ RGB ⇄ HSL, color picker, WCAG contrast |
| [Regex Tester](#regex-tester) | `regex` | Live matches, groups, replace preview |
| [Diff Viewer](#diff-viewer) | `diff` | Line-level diff between two texts |
| [Case Converter](#case-converter) | `case` | camelCase, snake_case, slugs and more |
| [Number Base](#number-base) | `base` | Binary/octal/decimal/hex, BigInt-sized |
| [Cron Explainer](#cron-explainer) | `cron` | Cron → English + next run times |
| [JSON ⇄ CSV](#json--csv) | `convert` | Convert between JSON arrays and CSV |
| [Health Checks](#health-checks) | `health` | HTTP/curl/JS checks with history |
| [Cloud Monitor](#cloud-monitor) | `gcloud` | Cloud Run & Cloud SQL inventory, metrics, logs |

---

## Encoder / Decoder

`/a/encoder` — Convert text through common wire encodings.

- Six modes: **URL encode / decode**, **Base64 encode / decode**, **HTML
  entities encode / decode**.
- Base64 is UTF-8 safe (`TextEncoder`/`TextDecoder` around `btoa`/`atob`), so
  emoji and non-Latin text round-trip correctly.
- HTML mode covers the named entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`,
  `&#39;`) plus numeric entities (`&#123;`, `&#xABC;`).
- Spotlight commands: one per mode (e.g. *Encoder: Base64 decode*).

## Formatter

`/a/formatter` — Beautify code and markup; minify JSON and XML.

- **16 languages**: JSON, JSON5, JavaScript, JSX, TypeScript, TSX, CSS, SCSS,
  Less, HTML, Vue, XML, YAML, Markdown, GraphQL and SQL.
- JSON and XML use a built-in, dependency-free formatter (instant). The other
  languages format via **Prettier** (and **sql-formatter** for SQL), which are
  dynamically imported per language — a formatter only downloads the first
  time you use it.
- **Minify** is available for JSON and XML only, where it can be done
  losslessly; the button is disabled (with a tooltip) for other languages.
- Auto-detect recognises JSON and XML; pick anything else explicitly.
- Indent options: 2 spaces, 4 spaces, or tabs. The editor fills the viewport.
- Spotlight commands: *Formatter: Auto-detect* plus one per language.

## JWT Inspector

`/a/jwt` — Decode a JSON Web Token and inspect its claims.

- Paste a `header.payload.signature` token; the header and payload are
  base64url-decoded and pretty-printed as JSON.
- Time claims (`iat`, `nbf`, `exp`) are shown as ISO timestamps **and**
  relative time ("expires in 2 hours"), with a Valid window / **Expired**
  badge.
- ⚠️ **Decode only — the signature is displayed but never verified.** Don't
  use this to make trust decisions.
- Spotlight commands: *JWT: Load sample token*, *JWT: Clear*.

## Hash & HMAC

`/a/hash` — Compute digests and keyed MACs locally via the Web Crypto API.

- Algorithms: **SHA-1, SHA-256, SHA-384, SHA-512**.
- Leave the key empty for a plain digest; provide a key to compute an
  **HMAC** instead.
- Hex output with an uppercase toggle; recomputes live as you type.
- Input and key never leave the browser (`SubtleCrypto`).
- Spotlight commands: one per algorithm.

## UUID / Token

`/a/uuid` — Generate identifiers and secrets in bulk.

- Four types: **UUID v4** (`crypto.randomUUID`), **NanoID** (21-char,
  URL-safe), **hex token** (32 chars), **numeric PIN** (6 digits).
- Generate **1–100 at a time**; every press produces fresh values.
- All randomness comes from `crypto.getRandomValues` — cryptographically
  strong, never `Math.random`.
- Spotlight commands: *UUID: Generate* plus one per type.

## Timestamp

`/a/time` — Translate any point in time between representations.

- Accepts Unix time (auto-detects seconds vs. milliseconds), ISO 8601, or any
  parseable date string.
- Outputs **Unix seconds, Unix milliseconds, ISO 8601 (UTC), local time, and
  relative time** ("2 days ago") side by side.
- Spotlight command: *Timestamp: Use now*.

## Color Converter

`/a/color` — Convert colors and check accessibility.

- Accepts `#hex`, `rgb()` and `hsl()` input (e.g. `#0ea5e9`,
  `rgb(14 165 233)`, `hsl(199 89% 48%)`).
- A native **color picker** sits beside the field: it tracks the current
  color, and choosing a color fills the input with its hex value.
- Shows all three notations plus a live swatch.
- **WCAG contrast ratios** against white and black, with AAA / AA / Fail
  badges computed per the WCAG luminance spec.

## Regex Tester

`/a/regex` — Try JavaScript regular expressions against sample text.

- All six flags as toggles: `g`, `i`, `m`, `s`, `u`, `y`.
- Live match highlighting with match count, numbered capture groups and
  **named groups**.
- **Replace preview** supporting `$1`, `$<name>` and literal templates.
- Guarded against runaway patterns (100k match cap) so a bad regex can't hang
  the tab.

## Diff Viewer

`/a/diff` — Compare two texts line by line.

- Minimal diff via the **longest-common-subsequence** algorithm — only real
  changes show as `+` / `−`.
- Added/removed line counts at a glance.
- Spotlight command: *Diff: Swap sides*.

## Case Converter

`/a/case` — Re-case text into every common identifier style at once.

- Eight styles, all shown simultaneously with copy buttons: **camelCase,
  PascalCase, snake_case, kebab-case, CONSTANT_CASE, Title Case, Sentence
  case, url-slug**.
- Tokenizes intelligently — it understands input that is already camelCase,
  snake_case, kebab-case or plain words.

## Number Base

`/a/base` — Convert integers between bases, at any size.

- Binary ⇄ octal ⇄ decimal ⇄ hex, shown together with copy buttons.
- **BigInt-backed**, so 256-bit hashes and other huge integers convert
  exactly, with no float precision loss.
- Auto-detects `0x` / `0o` / `0b` prefixes, or force a radix explicitly.

## Cron Explainer

`/a/cron` — Understand a cron schedule before you deploy it.

- Parses standard 5-field expressions (`min hour dom mon dow`) plus aliases
  like `@hourly` and `@daily`; supports `*`, ranges (`1-5`), steps (`*/15`)
  and lists. `0` and `7` both mean Sunday.
- Output: a plain-English description and the **next 5 run times (UTC)**.
- One-click presets: every minute, every 15 minutes, hourly, daily, weekdays
  09:00, monthly — also available as spotlight commands.

## JSON ⇄ CSV

`/a/convert` — Convert tabular data both directions.

- JSON array of objects → CSV, and CSV → JSON, with **auto-detection** of
  which way you mean.
- RFC-4180 compliant: quoted fields, escaped quotes and embedded newlines all
  round-trip correctly.
- Spotlight commands: one per direction plus auto.

## Health Checks

`/a/health` — A tiny client-side uptime dashboard. The one app that makes
network requests — only to the endpoints **you** configure.

- **HTTP checks**: any method (GET/POST/PUT/PATCH/DELETE/HEAD), custom
  headers and body, per-check timeout, expected status (`2xx`, ranges like
  `200-204`, or exact), and body assertions (contains / regex).
- **Import from curl**: paste a `curl` command and it becomes a check.
- **JS checks**: write an async function for anything HTTP can't express; it
  runs sandboxed in a **Web Worker**, receives `{ fetch }`, and returns
  `{ ok, status?, message?, latencyMs? }`.
- Organize with groups (collapsible), drag-and-drop reorder, and per-check
  enable/disable.
- Checks run in parallel (4 lanes) and **auto-run when you open the app**;
  each check keeps a history of its last 50 runs, drawn as a sparkline.
- Spotlight commands: *Health: Run all checks*, *Health: Add check*.
- Note: checks run from your browser, so the target must be reachable from it
  and allow cross-origin requests (CORS) where applicable.

## Cloud Monitor

`/a/gcloud` — A read-only dashboard for **Cloud Run** and **Cloud SQL**:
resource inventory, key metrics, and recent logs, pulled straight from Google
Cloud in your browser. Like Health Checks, it makes real network requests —
only to Google's APIs, authenticated as you.

- **Inventory**: Cloud Run services (per region) via the Run Admin API, and
  Cloud SQL instances via the SQL Admin API, with status/region/tier/version.
- **Metrics** (Cloud Monitoring `timeSeries`): for Run — requests, p99 latency,
  CPU, memory, instance count; for SQL — CPU, memory, disk, connections. Shown
  as sparklines over a selectable range (1h / 6h / 24h / 7d).
- **Logs** (Cloud Logging `entries:list`): the most recent entries for the
  selected resource, filterable by severity.

### How authentication works

Authentication uses **Google Identity Services' browser token model** — a
client-side OAuth 2.0 flow with **no client secret and no backend**. Nothing is
proxied through Toolbench: requests go directly from your browser to Google, and
your access token never leaves the page (it lives in `sessionStorage` for the
session only, never in IndexedDB).

You bring your **own OAuth Client ID**, so the app talks to *your* project as
*you*, with read-only scopes. One-time setup in the
[Google Cloud Console](https://console.cloud.google.com/):

1. Select your project.
2. **APIs & Services → Library**: enable the **Cloud Run Admin**, **Cloud SQL
   Admin**, **Cloud Monitoring**, and **Cloud Logging** APIs.
3. **APIs & Services → OAuth consent screen**: set it up (User type **External**
   is fine) and add your own Google account as a **test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   Application type **Web application**. Under **Authorized JavaScript origins**,
   add this site's origin (shown on the connect screen, e.g.
   `https://mrmikk.github.io`).
5. Click **Create**, then copy the Client ID (it ends in
   `.apps.googleusercontent.com`).
6. Paste the Client ID and your **project ID** into Cloud Monitor and click
   **Connect**. Choose **Narrow** scopes (`monitoring.read` + `logging.read` +
   `cloud-platform.read-only`) or **Broad** (`cloud-platform.read-only`) if a
   call reports a missing scope.

The connect screen has the same steps under "How do I create a Client ID?".

Only the non-secret Client ID, project ID, and your view preferences persist
locally; the access token does not. **Sign out** revokes and clears it. Tokens
are short-lived (~1h) — when one expires the app prompts you to **Reconnect**.

- Spotlight commands: *Refresh*, *Sign out*, *Last 1 hour*, *Last 24 hours*.
- Caveats: Cloud Run is regional with no cheap "list all", so you supply a
  comma-separated region list. Errors are mapped to actionable messages — an
  un-enabled API, a missing scope, or a CORS/network failure each say what to
  fix. Being browser-only, it needs network access and can't run offline.

---

## Adding a new app

See the [README](../README.md#adding-an-app): create
`src/apps/<slug>/index.tsx` and add one entry to `src/apps/registry.tsx` —
routing, the launcher card and spotlight pick it up automatically. Keep pure
logic in a `logic.ts` next to the component so it can be unit-tested without
the DOM (every app in `test/` follows this pattern).
