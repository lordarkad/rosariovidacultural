import { Hono } from 'hono'
import { listEventSources, listEvents } from '../db/curation.repo'
import { getEventDetail } from '../db/detail.repo'
import { CurationEventsQuerySchema, DetailQuerySchema, IdParamSchema } from '../lib/query-schemas'
import { validate } from '../lib/validate'
import type { AppEnv } from '../types/app'

const router = new Hono<AppEnv>()

router.get('/', validate('query', CurationEventsQuerySchema), async (c) => {
  const q = c.req.valid('query')
  const { rows, total } = await listEvents(c.env.DB, q, c.get('now')())
  c.header('X-Total-Count', String(total))
  c.header('X-Page', String(q.page))
  c.header('X-Per-Page', String(q.per_page))
  return c.json({ success: true, data: rows })
})

// antes de `/:id`: «sources» no es un UUID
router.get('/sources', async (c) => c.json({ success: true, data: await listEventSources(c.env.DB) }))

router.get('/:id', validate('param', IdParamSchema), validate('query', DetailQuerySchema), async (c) => {
  const { id } = c.req.valid('param')
  const { lat, lon } = c.req.valid('query')
  const origin = lat !== undefined && lon !== undefined ? { lat, lon } : null
  const event = await getEventDetail(c.env.DB, id, origin, c.get('now')())
  if (!event) return c.json({ success: false, error: 'Evento no encontrado' }, 404)
  return c.json({ success: true, data: event })
})

export default router
