import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    deps: {
      inline: ['@absmartly/javascript-sdk', '@absmartly/sdk-plugins'],
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/unit/shared/client-bundle-generator.test.ts',
      'tests/unit/zaraz/experiment-view-tracking.test.ts',
    ],
  },
})
