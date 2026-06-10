import type { ComponentChildren } from 'preact';
import type { MiniApp } from '../sdk';

type IconProps = { class?: string };
const svg = (children: ComponentChildren) => ({ class: cls }: IconProps) => (
  <svg
    class={cls}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const EncoderIcon = svg(
  <>
    <path d="m8 9-4 3 4 3" />
    <path d="m16 9 4 3-4 3" />
    <path d="m13 6-2 12" />
  </>,
);

const FormatterIcon = svg(
  <>
    <path d="M4 6h16" />
    <path d="M7 12h13" />
    <path d="M7 18h10" />
    <path d="M4 12h.01" />
    <path d="M4 18h.01" />
  </>,
);

const JwtIcon = svg(
  <>
    <circle cx="7.5" cy="15.5" r="3.5" />
    <path d="m10 13 9-9" />
    <path d="m16 7 2 2" />
    <path d="m13 10 2 2" />
  </>,
);

const HashIcon = svg(
  <>
    <path d="M4 9h16" />
    <path d="M4 15h16" />
    <path d="M10 3 8 21" />
    <path d="M16 3l-2 18" />
  </>,
);

const UuidIcon = svg(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="12" r="2.2" />
    <path d="M14 10h4" />
    <path d="M14 14h4" />
  </>,
);

const TimeIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);

const ColorIcon = svg(<path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10Z" />);

const RegexIcon = svg(
  <>
    <path d="M7 5H5v14h2" />
    <path d="M17 5h2v14h-2" />
    <path d="M12 9v6" />
    <path d="m9.5 10.5 5 3" />
    <path d="m14.5 10.5-5 3" />
  </>,
);

const DiffIcon = svg(
  <>
    <rect x="3" y="4" width="7" height="16" rx="1" />
    <rect x="14" y="4" width="7" height="16" rx="1" />
  </>,
);

const CaseIcon = svg(
  <>
    <path d="M4 7V5h16v2" />
    <path d="M12 5v14" />
    <path d="M9 19h6" />
  </>,
);

const BaseIcon = svg(
  <>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 7h8" />
    <path d="M8 11h2" />
    <path d="M14 11h2" />
    <path d="M8 15h2" />
    <path d="M14 15h2" />
  </>,
);

const CronIcon = svg(
  <>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <path d="M12 13v3l2 1" />
  </>,
);

const ConvertIcon = svg(
  <>
    <path d="M14 4 18 8l-4 4" />
    <path d="M18 8H6" />
    <path d="m10 20-4-4 4-4" />
    <path d="M6 16h12" />
  </>,
);

const HealthIcon = svg(<path d="M3 12h4l2 5 4-10 2 5h6" />);

/** The single source of truth for registered mini apps. Adding one = add an entry. */
export const apps: MiniApp[] = [
  {
    slug: 'encoder',
    title: 'Encoder / Decoder',
    description: 'URL, Base64 and HTML-entity encoding and decoding.',
    icon: EncoderIcon,
    load: () => import('./encoder'),
  },
  {
    slug: 'formatter',
    title: 'Formatter',
    description: 'Beautify many languages (JS, TS, CSS, HTML, YAML, SQL…); minify JSON/XML.',
    icon: FormatterIcon,
    load: () => import('./formatter'),
  },
  {
    slug: 'jwt',
    title: 'JWT Inspector',
    description: 'Decode a JWT header and payload, with claim and expiry details.',
    icon: JwtIcon,
    load: () => import('./jwt'),
  },
  {
    slug: 'hash',
    title: 'Hash & HMAC',
    description: 'SHA-1/256/384/512 digests and HMACs, computed in the browser.',
    icon: HashIcon,
    load: () => import('./hash'),
  },
  {
    slug: 'uuid',
    title: 'UUID / Token',
    description: 'Generate UUIDs, NanoIDs, hex tokens and numeric PINs in bulk.',
    icon: UuidIcon,
    load: () => import('./uuid'),
  },
  {
    slug: 'time',
    title: 'Timestamp',
    description: 'Convert between Unix time, ISO 8601, local time and relative.',
    icon: TimeIcon,
    load: () => import('./time'),
  },
  {
    slug: 'color',
    title: 'Color Converter',
    description: 'HEX ⇄ RGB ⇄ HSL with WCAG contrast checking.',
    icon: ColorIcon,
    load: () => import('./color'),
  },
  {
    slug: 'regex',
    title: 'Regex Tester',
    description: 'Live matches, capture groups, flags and replace preview.',
    icon: RegexIcon,
    load: () => import('./regex'),
  },
  {
    slug: 'diff',
    title: 'Diff Viewer',
    description: 'Line-level diff between two texts with add/remove stats.',
    icon: DiffIcon,
    load: () => import('./diff'),
  },
  {
    slug: 'case',
    title: 'Case Converter',
    description: 'camelCase, snake_case, kebab-case, Title Case, slugs and more.',
    icon: CaseIcon,
    load: () => import('./case'),
  },
  {
    slug: 'base',
    title: 'Number Base',
    description: 'Convert between binary, octal, decimal and hex (big integers).',
    icon: BaseIcon,
    load: () => import('./base'),
  },
  {
    slug: 'cron',
    title: 'Cron Explainer',
    description: 'Describe a cron expression in English and preview next runs.',
    icon: CronIcon,
    load: () => import('./cron'),
  },
  {
    slug: 'convert',
    title: 'JSON ⇄ CSV',
    description: 'Convert between JSON arrays and CSV, with auto-detection.',
    icon: ConvertIcon,
    load: () => import('./convert'),
  },
  {
    slug: 'health',
    title: 'Health Checks',
    description: 'Monitor web apps with HTTP, curl or JS checks — run on open.',
    icon: HealthIcon,
    load: () => import('./health'),
  },
];

export function findApp(slug: string): MiniApp | undefined {
  return apps.find((a) => a.slug === slug);
}
