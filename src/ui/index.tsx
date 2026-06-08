import type { ComponentChildren, JSX } from 'preact';

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
