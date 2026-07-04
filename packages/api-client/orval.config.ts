import { defineConfig } from 'orval';

export default defineConfig({
  dataroom: {
    input: '../../apps/api/openapi.json',
    output: {
      target: './src/generated/endpoints.ts',
      schemas: './src/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/mutator.ts',
          name: 'customFetch',
        },
      },
    },
  },
});
