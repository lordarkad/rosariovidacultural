import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      'apps/api/vitest.config.ts',
      'apps/api/vitest.d1.config.mts',
      'apps/dashboard/vitest.config.ts',
    ],
  },
})
