/// <reference types="vite/client" />

// Vite handles CSS side-effect imports; TS 6 (TS2882) needs the ambient declaration.
declare module '*.css';

interface ImportMetaEnv {
  /** Optional absolute API origin for deployed web builds. */
  readonly VITE_API_URL?: string;
  /** "false" disables the MSW mock backend in dev (see src/mocks/enable.ts). */
  readonly VITE_ENABLE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
