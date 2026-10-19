import { Hono } from 'hono'
import { listPlaces } from '../db/curation.repo'
import { getPlaceDetail } from '../db/detail.repo'
import { CurationPlacesQuerySchema, DetailQuerySchema, IdParamSchema } from '../lib/query-schemas'
import { validate } from '../lib/validate'
import type { AppEnv } from '../types/app'

const router = new Hono<AppEnv>()

router.get('/', validate('query', CurationPlacesQuerySchema), async (c) => {
  const q = c.req.valid('query')
  const { rows, total } = await listPlaces(c.env.DB, q)
  c.header('X-Total-Count', String(total))
  c.header('X-Page', String(q.page))
  c.header('X-Per-Page', String(q.per_page))
  return c.json({ success: true, data: rows })
})

router.get('/:id', validate('param', IdParamSchema), validate('query', DetailQuerySchema), async (c) => {
  const { id } = c.req.valid('param')
  const { lat, lon } = c.req.valid('query')
  const origin = lat !== undefined && lon !== undefined ? { lat, lon } : null
  const place = await getPlaceDetail(c.env.DB, id, origin, c.get('now')())
  if (!place) return c.json({ success: false, error: 'Lugar no encontrado' }, 404)
  return c.json({ success: true, data: place })
})

export default router
