import { rm } from 'node:fs/promises';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// The MSW worker script must live in public/ so the dev server can register it,
// but it is dev-only: keep it out of the production artifact.
function stripMswWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'strip-msw-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await rm(path.join(outDir, 'mockServiceWorker.js'), { force: true });
    },
  };
}

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    stripMswWorker(),
  ],
  // Some workspace packages ship a built CommonJS dist (unlike the other
  // workspace packages, which export TS source). Vite does not pre-bundle linked
  // workspace packages by default, so its CJS named exports would not resolve
  // as ESM in dev. Forcing it into optimizeDeps lets esbuild convert CJS -> ESM
  // and expose the named exports (validateNodeName, NODE_NAME_MAX_LENGTH, ...).
  optimizeDeps: {
    include: ['@repo/domain', '@repo/config', '@repo/contracts'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
