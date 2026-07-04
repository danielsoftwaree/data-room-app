/// <reference types="vite/client" />

// Vite handles CSS side-effect imports; TS 6 (TS2882) needs the ambient declaration.
declare module '*.css';

interface ImportMetaEnv {
  /** Clerk publishable key (auth scaffolded, not implemented — see docs/auth-clerk.md). */
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  /** Optional absolute API origin for deployed web builds. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
