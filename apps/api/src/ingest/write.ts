import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import type { EventPlan, PlacePlan } from './types'

const MAX_PAYLOAD_BYTES = 900_000 // D1 admite hasta 2 MB por string: se parte antes de acercarse

/** Parte una lista en tandas cuyo JSON no supera el tope. Casi siempre es una sola. */
function chunk<T>(rows: T[]): T[][] {
  const out: T[][] = []
  let cur: T[] = []
  let size = 0
  for (const r of rows) {
    const n = JSON.stringify(r).length
    if (cur.length > 0 && size + n > MAX_PAYLOAD_BYTES) {
      out.push(cur)
      cur = []
      size = 0
    }
    cur.push(r)
    size += n
  }
  if (cur.length > 0) out.push(cur)
  return out
}

const PLACE_COLUMNS = [
  'id', 'source_key', 'name', 'name_norm', 'kind', 'origin', 'intents', 'offers', 'cuisine',
  'address', 'address_norm', 'lat', 'lon', 'opening_hours', 'hours_text', 'phone', 'website',
  'instagram', 'outdoor', 'note', 'image_url', 'created_at', 'last_seen_at',
] as const

const EVENT_COLUMNS = [
  'id', 'source_key', 'source_name', 'source_tier', 'source_url', 'via_json', 'title', 'title_norm',
  'description', 'intents', 'music_genres', 'start_date', 'end_date', 'start_time', 'starts_at_utc',
  'date_text', 'venue_name', 'venue_norm', 'address', 'address_norm', 'lat', 'lon',
  'place_source_key', 'price_status', 'price_from_ars', 'image_url', 'created_at', 'last_seen_at',
] as const

const SOURCE_COLUMNS = ['source_key', 'event_id', 'source_name', 'source_tier', 'source_url', 'via_json'] as const

/** `INSERT ... SELECT ... FROM json_each(?1) ON CONFLICT(key) DO UPDATE`: un solo parámetro, N filas. */
function bulkUpsert(
  table: string,
  columns: readonly string[],
  conflict: string,
  preserve: readonly string[],
): string {
  const cols = columns.join(', ')
  const selects = columns.map((c) => `json_extract(value, '$.${c}')`).join(', ')
  const sets = columns
    .filter((c) => c !== conflict && !preserve.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')
  // `WHERE true` evita la ambigüedad de parseo entre el WHERE de INSERT...SELECT y el ON CONFLICT
  return `INSERT INTO ${table} (${cols}) SELECT ${selects} FROM json_each(?1) WHERE true
          ON CONFLICT(${conflict}) DO UPDATE SET ${sets}`
}

const repointSql = (table: string, column: string): string =>
  `UPDATE ${table} SET ${column} = (
     SELECT json_extract(value, '$.to') FROM json_each(?1) WHERE json_extract(value, '$.from') = ${table}.${column})
   WHERE ${column} IN (SELECT json_extract(value, '$.from') FROM json_each(?1))`

const SQL = {
  placesUpsert: bulkUpsert('places', PLACE_COLUMNS, 'id', ['created_at']),
  placeKeysUpsert: `INSERT INTO place_keys (source_key, place_id)
    SELECT json_extract(value, '$.source_key'), json_extract(value, '$.place_id') FROM json_each(?1) WHERE true
    ON CONFLICT(source_key) DO UPDATE SET place_id = excluded.place_id`,
  placeRedirectsUpsert: `INSERT INTO place_id_redirects (old_id, place_id)
    SELECT json_extract(value, '$.old_id'), json_extract(value, '$.place_id') FROM json_each(?1) WHERE true
    ON CONFLICT(old_id) DO UPDATE SET place_id = excluded.place_id`,
  eventsUpsert: bulkUpsert('events', EVENT_COLUMNS, 'id', ['created_at']),
  eventSourcesUpsert: bulkUpsert('event_sources', SOURCE_COLUMNS, 'source_key', []),
  eventRedirectsUpsert: `INSERT INTO event_id_redirects (old_id, event_id)
    SELECT json_extract(value, '$.old_id'), json_extract(value, '$.event_id') FROM json_each(?1) WHERE true
    ON CONFLICT(old_id) DO UPDATE SET event_id = excluded.event_id`,
  touch: (table: string): string =>
    `UPDATE ${table} SET last_seen_at = ?2 WHERE id IN (SELECT value FROM json_each(?1))`,
  delete: (table: string): string => `DELETE FROM ${table} WHERE id IN (SELECT value FROM json_each(?1))`,
}

/**
 * Sentencias de escritura del lote, en un orden que respeta las uniques sin claves foráneas: primero se
 * repuntan y borran las filas absorbidas, después se hacen los upserts. Cada sentencia lleva su lista
 * entera como un único parámetro JSON, así el batch tiene un puñado de sentencias sea cual sea el lote.
 */
export function buildWriteStatements(
  db: D1Database,
  places: PlacePlan,
  events: EventPlan,
  now: string,
): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = []
  const add = (sql: string, rows: unknown[], ...extra: unknown[]) => {
    for (const part of chunk(rows)) out.push(db.prepare(sql).bind(JSON.stringify(part), ...extra))
  }

  // lugares
  add(repointSql('place_keys', 'place_id'), places.repoint)
  add(repointSql('place_id_redirects', 'place_id'), places.repoint)
  add(SQL.delete('places'), places.deletes)
  add(
    SQL.placesUpsert,
    places.upserts.map((p) => ({
      id: p.id,
      source_key: p.source_key,
      ...p.fields,
      created_at: p.created_at,
      last_seen_at: p.last_seen_at,
    })),
  )
  add(SQL.touch('places'), places.touched, now)
  add(SQL.placeKeysUpsert, places.keys)
  add(SQL.placeRedirectsUpsert, places.redirects)

  // eventos
  add(repointSql('event_sources', 'event_id'), events.repoint)
  add(repointSql('event_id_redirects', 'event_id'), events.repoint)
  add(SQL.delete('events'), events.deletes)
  add(
    SQL.eventsUpsert,
    events.upserts.map((e) => {
      const primary = e.sources.find((s) => s.source_key === e.canonical)!
      return {
        id: e.id,
        source_key: e.canonical,
        source_name: primary.name,
        source_tier: primary.tier,
        source_url: primary.url,
        via_json: JSON.stringify(primary.via),
        ...e.fields,
        created_at: e.created_at,
        last_seen_at: e.last_seen_at,
      }
    }),
  )
  add(SQL.touch('events'), events.touched, now)
  add(
    SQL.eventSourcesUpsert,
    events.sources.map((s) => ({
      source_key: s.source_key,
      event_id: s.event_id,
      source_name: s.name,
      source_tier: s.tier,
      source_url: s.url,
      via_json: JSON.stringify(s.via),
    })),
  )
  add(SQL.eventRedirectsUpsert, events.redirects)

  return out
}

export async function writeBatch(
  db: D1Database,
  places: PlacePlan,
  events: EventPlan,
  now: string,
): Promise<number> {
  const statements = buildWriteStatements(db, places, events, now)
  if (statements.length > 0) await db.batch(statements)
  return statements.length
}
