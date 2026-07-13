/// <reference types="wxt/client" />

interface ImportMetaEnv {
  readonly BROWSER: 'chrome' | 'firefox';
  readonly MANIFEST_VERSION: 2 | 3;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
