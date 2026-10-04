import { Hono } from 'hono'
import type { Context } from 'hono'
import type { SearchItem } from '@tript/shared'
import { findZone } from '../db/zones.repo'
import { fetchCandidates } from '../db/search.repo'
import { pointInBbox } from '../domain/geo'
import {
  buildSearchResults,
  paginate,
  toSearchPin,
  type SearchOrigin,
} from '../domain/search-pipeline'
import { InvalidWindowError, resolveWindow } from '../domain/windows'
import { validate } from '../lib/validate'
import { SearchQuerySchema, type SearchQuery } from '../lib/query-schemas'
import type { AppEnv } from '../types/app'

const MAX_PINS = 100

const router = new Hono<AppEnv>()

interface Fail {
  status: 400 | 404
  error: string
}

const isFail = (r: SearchItem[] | Fail): r is Fail => !Array.isArray(r)

/** Pipeline común de `searchItems` y `searchPins`: ventana → origen (zona o coordenadas) → candidatos → resultados. */
async function runSearch(c: Context<AppEnv>, q: SearchQuery): Promise<SearchItem[] | Fail> {
  const now = c.get('now')()
  let window
  try {
    window = resolveWindow(q.cuando, q.fecha, now)
  } catch (e) {
    if (e instanceof InvalidWindowError) return { status: 400, error: e.message }
    throw e
  }

  let origin: SearchOrigin | null = null
  if (q.zone !== undefined) {
    const zone = await findZone(c.env.DB, q.zone)
    if (!zone) return { status: 404, error: 'Zona no encontrada' }
    origin = { lat: zone.lat, lon: zone.lon, radius_m: zone.radius_m }
  } else if (q.lat !== undefined && q.lon !== undefined) {
    origin = { lat: q.lat, lon: q.lon, radius_m: q.radio_m }
  }

  const rows = await fetchCandidates(c.env.DB, window, origin, now)
  return buildSearchResults(
    rows,
    { intents: q.intents, musica: q.musica, gratis: q.gratis, window, origin, q: q.q },
    now,
  )
}

router.get('/', validate('query', SearchQuerySchema), async (c) => {
  const q = c.req.valid('query')
  const result = await runSearch(c, q)
  if (isFail(result)) return c.json({ success: false, error: result.error }, result.status)
  const page = paginate(result, q.page, q.per_page)
  return c.json({ success: true, data: page.items }, 200, {
    'X-Total-Count': String(page.total),
    'X-Page': String(q.page),
    'X-Per-Page': String(q.per_page),
  })
})

router.get('/pins', validate('query', SearchQuerySchema), async (c) => {
  const q = c.req.valid('query')
  const result = await runSearch(c, q)
  if (isFail(result)) return c.json({ success: false, error: result.error }, result.status)
  const pins = result
    .map(toSearchPin)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .filter((p) => !q.bbox || pointInBbox(p.lat, p.lon, q.bbox))
  return c.json({ success: true, data: pins.slice(0, MAX_PINS) }, 200, {
    'X-Total-Count': String(pins.length),
    'X-Truncated': String(pins.length > MAX_PINS),
  })
})

export default router
