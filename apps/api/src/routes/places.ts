import { Hono } from 'hono'
import { getPlaceDetail } from '../db/detail.repo'
import { DetailQuerySchema, IdParamSchema } from '../lib/query-schemas'
import { validate } from '../lib/validate'
import type { AppEnv } from '../types/app'

const router = new Hono<AppEnv>()

router.get('/:id', validate('param', IdParamSchema), validate('query', DetailQuerySchema), async (c) => {
  const { id } = c.req.valid('param')
  const { lat, lon } = c.req.valid('query')
  const origin = lat !== undefined && lon !== undefined ? { lat, lon } : null
  const place = await getPlaceDetail(c.env.DB, id, origin, c.get('now')())
  if (!place) return c.json({ success: false, error: 'Lugar no encontrado' }, 404)
  return c.json({ success: true, data: place })
})

export default router
