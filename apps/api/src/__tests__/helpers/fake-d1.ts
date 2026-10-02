import type { D1Database } from '@cloudflare/workers-types'

/** D1 que falla si se lo toca: prueba que la request se rechazó antes de llegar a la base. */
export const untouchableDb = (): D1Database =>
  new Proxy({} as D1Database, {
    get(_t, prop) {
      throw new Error(`D1 no debería tocarse (${String(prop)})`)
    },
  })

export const TEST_TOKEN = 'test-ingest-token'

export const envWithoutDb = (over: Record<string, unknown> = {}) => ({
  DB: untouchableDb(),
  INGEST_TOKEN: TEST_TOKEN,
  ENVIRONMENT: 'test',
  ...over,
})
