/// <reference types="vite/client" />

// Vite handles CSS side-effect imports; TS 6 (TS2882) needs the ambient declaration.
declare module '*.css';
