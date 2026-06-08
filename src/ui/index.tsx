import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';

type ButtonProps = JSX.IntrinsicElements['button'] & {
  variant?: 'primary' | 'default' | 'ghost';
};

export function Button({ variant = 'default', class: cls = '', children, ...rest }: ButtonProps) {
  return (
    <button class={`btn btn-${variant} ${cls}`} {...rest}>
      {children}
    </button>
  );
}

export function TextArea({ class: cls = '', ...rest }: JSX.IntrinsicElements['textarea']) {
  return <textarea class={`field textarea ${cls}`} spellcheck={false} {...rest} />;
}

export function Input({ class: cls = '', ...rest }: JSX.IntrinsicElements['input']) {
  return <input class={`field ${cls}`} spellcheck={false} autocomplete="off" {...rest} />;
}

export function Checkbox({
  label,
  class: cls = '',
  ...rest
}: JSX.IntrinsicElements['input'] & { label: ComponentChildren }) {
  return (
    <label class={`checkbox ${cls}`}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** A button that copies `value` to the clipboard and flashes confirmation. */
export function CopyButton({
  value,
  label = 'Copy',
  variant = 'default',
  class: cls = '',
}: {
  value: string;
  label?: string;
  variant?: 'primary' | 'default' | 'ghost';
  class?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <Button variant={variant} class={cls} onClick={copy} disabled={!value}>
      {copied ? 'Copied!' : label}
    </Button>
  );
}

export function Select({ class: cls = '', children, ...rest }: JSX.IntrinsicElements['select']) {
  return (
    <select class={`field select ${cls}`} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class="field-group">
      <span class="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Card({ class: cls = '', children, ...rest }: JSX.IntrinsicElements['div']) {
  return (
    <div class={`card ${cls}`} {...rest}>
      {children}
    </div>
  );
}

export function Toolbar({ children }: { children: ComponentChildren }) {
  return <div class="toolbar">{children}</div>;
}
