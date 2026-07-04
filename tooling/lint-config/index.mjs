import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/.promptql/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // React correctness rules for all React code (web app + ui package).
  { ...reactHooks.configs.flat['recommended-latest'], files: ['**/*.tsx'] },
  // Guards Vite HMR boundaries: components must be the only exports of component files.
  { ...reactRefresh.configs.vite, files: ['apps/web/src/**/*.tsx'] },
);
