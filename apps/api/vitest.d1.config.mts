import { defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

// Tests contra D1 real (Miniflare) con las migraciones aplicadas. Solo `*.d1.test.ts`.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(resolve(here, 'migrations'))
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            INGEST_TOKEN: 'test-ingest-token',
            ENVIRONMENT: 'test',
          },
        },
      }),
    ],
    test: {
      name: 'api-d1',
      globals: true,
      include: ['src/**/*.d1.test.ts'],
      setupFiles: ['./src/__tests__/setup/apply-migrations.ts'],
    },
    resolve: {
      alias: {
        '@tript/shared': resolve(here, '../../packages/shared/src'),
      },
    },
  }
})
