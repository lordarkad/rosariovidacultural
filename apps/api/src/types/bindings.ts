import type { D1Database } from '@cloudflare/workers-types'

export interface Bindings {
  DB: D1Database
  INGEST_TOKEN: string
  ENVIRONMENT: string
}
