import { Hono } from 'hono'
import type { Bindings } from '../types/bindings'
import { listZones } from '../db/zones.repo'

const router = new Hono<{ Bindings: Bindings }>()

router.get('/', async (c) => c.json({ success: true, data: await listZones(c.env.DB) }))

export default router
