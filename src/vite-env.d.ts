/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Prism's language components are side-effect-only JS modules without types.
declare module 'prismjs/components/*';

// Prettier plugin subpaths (loaded dynamically); cast to Plugin at the call site.
declare module 'prettier/plugins/*';
