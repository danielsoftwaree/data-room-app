import { fileURLToPath } from 'node:url';
import * as tailwindcss from 'prettier-plugin-tailwindcss';

// Resolve the design-system stylesheet relative to this config file so the
// path works no matter which file prettier is currently formatting.
const tailwindStylesheet = fileURLToPath(
  new URL('../../packages/ui/src/styles/globals.css', import.meta.url),
);

export default {
  singleQuote: true,
  semi: true,
  printWidth: 100,
  trailingComma: 'all',
  // Pass the resolved plugin object so consumers don't need the plugin installed themselves.
  plugins: [tailwindcss],
  tailwindStylesheet,
  tailwindFunctions: ['cn', 'cva'],
};
