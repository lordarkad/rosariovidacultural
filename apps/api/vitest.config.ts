import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.d1.test.ts'],
  },
  resolve: {
    alias: {
      '@tript/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
})
