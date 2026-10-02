import { Hono } from 'hono'
import { IngestBatchSchema } from '@tript/shared'
import { validate } from '../lib/validate'
import { ingestAuth } from '../middleware/ingest-auth'
import { runIngest } from '../ingest/run-ingest'
import type { AppEnv } from '../types/app'

const router = new Hono<AppEnv>()

// auth (401) → estructura del lote (400) → validación por ítem (rejected, dentro de runIngest)
router.post('/', ingestAuth, validate('json', IngestBatchSchema), async (c) => {
  const result = await runIngest(c.env.DB, c.req.valid('json'), c.get('now')())
  return c.json({ success: true, data: result })
})

export default router
