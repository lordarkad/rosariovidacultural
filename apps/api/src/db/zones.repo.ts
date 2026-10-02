import type { D1Database } from '@cloudflare/workers-types'
import type { Zone } from '@tript/shared'

export async function listZones(db: D1Database): Promise<Zone[]> {
  const { results } = await db
    .prepare('SELECT id, name, kind, lat, lon, radius_m FROM zones ORDER BY sort_order')
    .all<Zone>()
  return results
}

export async function findZone(db: D1Database, id: string): Promise<Zone | null> {
  return db
    .prepare('SELECT id, name, kind, lat, lon, radius_m FROM zones WHERE id = ?1')
    .bind(id)
    .first<Zone>()
}
