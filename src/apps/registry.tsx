import type { MiniApp } from '../sdk';

const EncoderIcon = ({ class: cls }: { class?: string }) => (
  <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m8 9-4 3 4 3" />
    <path d="m16 9 4 3-4 3" />
    <path d="m13 6-2 12" />
  </svg>
);

const FormatterIcon = ({ class: cls }: { class?: string }) => (
  <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 6h16" />
    <path d="M7 12h13" />
    <path d="M7 18h10" />
    <path d="M4 12h.01" />
    <path d="M4 18h.01" />
  </svg>
);

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
    description: 'Pretty-print or minify JSON and XML, with auto-detection.',
    icon: FormatterIcon,
    load: () => import('./formatter'),
  },
];

export function findApp(slug: string): MiniApp | undefined {
  return apps.find((a) => a.slug === slug);
}
