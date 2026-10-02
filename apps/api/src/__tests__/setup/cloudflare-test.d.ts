/// <reference types="@cloudflare/vitest-plugin/types" />
import type { D1Migration } from '@cloudflare/vitest-plugin'

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database
      INGEST_TOKEN: string
      ENVIRONMENT: string
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}
