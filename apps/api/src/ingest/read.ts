import type { D1Database } from '@cloudflare/workers-types'
import type { IngestEvent, IngestPlace, SourceTier } from '@tript/shared'
import { parse } from '../db/json'
import { normalizeText } from '../domain/normalize'
import type {
  EventFields,
  EventRecord,
  EventState,
  PlaceFields,
  PlaceRecord,
  PlaceState,
  SourceEntry,
} from './types'

const json = (v: unknown): string => JSON.stringify(v)
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)]

// Cada consulta recibe sus listas como UN parámetro JSON consumido con json_each: D1 limita a 100
// parámetros enlazados por consulta, y así el costo no depende del tamaño del lote.
const EVENT_IDS_BY_KEYS = `SELECT event_id FROM event_sources WHERE source_key IN (SELECT value FROM json_each(?1))`
const eventIdsByCandidate = (param: number) => `SELECT e.id FROM events e WHERE EXISTS (
  SELECT 1 FROM json_each(?${param}) p
  WHERE json_extract(p.value, '$.t') = e.title_norm AND json_extract(p.value, '$.d') = e.start_date)`

interface EventDbRow {
  seq: number
  id: string
  source_key: string
  title: string
  title_norm: string
  description: string | null
  intents: string
  music_genres: string
  start_date: string
  end_date: string
  start_time: string | null
  starts_at_utc: string | null
  date_text: string | null
  venue_name: string | null
  venue_norm: string | null
  address: string | null
  address_norm: string | null
  lat: number | null
  lon: number | null
  place_source_key: string | null
  price_status: 'free' | 'paid' | 'unknown'
  price_from_ars: number | null
  image_url: string | null
  created_at: string
}

interface SourceDbRow {
  source_key: string
  event_id: string
  arrival: number
  source_name: string
  source_tier: SourceTier
  source_url: string
  via_json: string
}

/** Fase 1: eventos del lote y sus candidatos a duplicado, con todas sus fuentes. Una llamada a D1. */
export async function readEventState(db: D1Database, items: IngestEvent[]): Promise<EventState> {
  if (items.length === 0) return { byKey: new Map(), candidates: [], maxSeq: 0, maxArrival: 0 }
  const keys = json(items.map((i) => i.source_key))
  const pairs = json(
    uniq(items.map((i) => `${normalizeText(i.title)}|${i.start_date}`)).map((p) => {
      const [t, d] = p.split('|')
      return { t, d }
    }),
  )
  const [byKey, byCandidate, sources, max] = await db.batch([
    db.prepare(`SELECT * FROM events WHERE id IN (${EVENT_IDS_BY_KEYS})`).bind(keys),
    db.prepare(`SELECT * FROM events WHERE id IN (${eventIdsByCandidate(1)})`).bind(pairs),
    db
      .prepare(
        `SELECT * FROM event_sources WHERE event_id IN (${EVENT_IDS_BY_KEYS} UNION ${eventIdsByCandidate(2)}) ORDER BY arrival`,
      )
      .bind(keys, pairs),
    db.prepare(
      `SELECT (SELECT COALESCE(MAX(seq), 0) FROM events) AS max_seq,
              (SELECT COALESCE(MAX(arrival), 0) FROM event_sources) AS max_arrival`,
    ),
  ])

  const sourcesByEvent = new Map<string, SourceEntry[]>()
  for (const s of (sources!.results as unknown as SourceDbRow[]) ?? []) {
    const list = sourcesByEvent.get(s.event_id) ?? []
    list.push({
      source_key: s.source_key,
      arrival: s.arrival,
      name: s.source_name,
      tier: s.source_tier,
      url: s.source_url,
      via: parse(s.via_json, []),
    })
    sourcesByEvent.set(s.event_id, list)
  }
  const toRecord = (r: EventDbRow): EventRecord => {
    const fields: EventFields = {
      title: r.title,
      title_norm: r.title_norm,
      description: r.description,
      intents: parse(r.intents, []),
      music_genres: parse(r.music_genres, []),
      start_date: r.start_date,
      end_date: r.end_date,
      start_time: r.start_time,
      starts_at_utc: r.starts_at_utc,
      date_text: r.date_text,
      venue_name: r.venue_name,
      venue_norm: r.venue_norm,
      address: r.address,
      address_norm: r.address_norm,
      lat: r.lat,
      lon: r.lon,
      place_source_key: r.place_source_key,
      price_status: r.price_status,
      price_from_ars: r.price_from_ars,
      image_url: r.image_url,
    }
    return {
      seq: r.seq,
      id: r.id,
      persisted: true,
      created_at: r.created_at,
      canonical: r.source_key,
      fields,
      sources: sourcesByEvent.get(r.id) ?? [],
    }
  }

  const records = new Map<string, EventRecord>()
  for (const r of [...(byKey!.results as unknown as EventDbRow[]), ...(byCandidate!.results as unknown as EventDbRow[])]) {
    if (!records.has(r.id)) records.set(r.id, toRecord(r))
  }
  const incoming = new Set(items.map((i) => i.source_key))
  const byKeyMap = new Map<string, EventRecord>()
  for (const rec of records.values()) {
    for (const s of rec.sources) if (incoming.has(s.source_key)) byKeyMap.set(s.source_key, rec)
  }
  const candidates = [...records.values()]
  const m = max!.results[0] as { max_seq: number; max_arrival: number }
  return { byKey: byKeyMap, candidates, maxSeq: m.max_seq, maxArrival: m.max_arrival }
}

interface PlaceDbRow {
  seq: number
  id: string
  source_key: string
  name: string
  name_norm: string
  kind: PlaceFields['kind']
  origin: PlaceFields['origin']
  intents: string
  offers: string
  cuisine: string
  address: string | null
  address_norm: string | null
  lat: number
  lon: number
  opening_hours: string | null
  hours_text: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  outdoor: number | null
  note: string | null
  image_url: string | null
  created_at: string
  matched_key?: string
}

const toPlaceRecord = (r: PlaceDbRow): PlaceRecord => ({
  seq: r.seq,
  id: r.id,
  source_key: r.source_key,
  persisted: true,
  created_at: r.created_at,
  fields: {
    name: r.name,
    name_norm: r.name_norm,
    kind: r.kind,
    origin: r.origin,
    intents: parse(r.intents, []),
    offers: parse(r.offers, []),
    cuisine: parse(r.cuisine, []),
    address: r.address,
    address_norm: r.address_norm,
    lat: r.lat,
    lon: r.lon,
    opening_hours: parse(r.opening_hours, null),
    hours_text: r.hours_text,
    phone: r.phone,
    website: r.website,
    instagram: r.instagram,
    outdoor: r.outdoor === null ? null : r.outdoor === 1,
    note: r.note,
    image_url: r.image_url,
  },
})

/**
 * Fase 2: lugares por clave (los del lote, los que referencian sus eventos y los de los eventos
 * candidatos) y los de igual nombre normalizado, candidatos a fusión. Una llamada a D1.
 */
export async function readPlaceState(
  db: D1Database,
  items: IngestPlace[],
  extraKeys: string[],
): Promise<PlaceState> {
  const keys = uniq([...items.map((i) => i.source_key), ...extraKeys])
  const names = uniq(items.map((i) => normalizeText(i.name)))
  if (keys.length === 0) return { byKey: new Map(), nearby: [], maxSeq: 0 }
  const [byKey, nearby, max] = await db.batch([
    db
      .prepare(
        `SELECT p.*, k.source_key AS matched_key FROM place_keys k
         JOIN places p ON p.id = k.place_id
         WHERE k.source_key IN (SELECT value FROM json_each(?1))`,
      )
      .bind(json(keys)),
    db.prepare(`SELECT * FROM places WHERE name_norm IN (SELECT value FROM json_each(?1))`).bind(json(names)),
    db.prepare(`SELECT COALESCE(MAX(seq), 0) AS max_seq FROM places`),
  ])
  const records = new Map<string, PlaceRecord>()
  const rec = (r: PlaceDbRow): PlaceRecord => {
    let p = records.get(r.id)
    if (!p) {
      p = toPlaceRecord(r)
      records.set(r.id, p)
    }
    return p
  }
  const byKeyMap = new Map<string, PlaceRecord>()
  for (const r of byKey!.results as unknown as PlaceDbRow[]) byKeyMap.set(r.matched_key!, rec(r))
  const nearbyRecords = (nearby!.results as unknown as PlaceDbRow[]).map(rec)
  return {
    byKey: byKeyMap,
    nearby: nearbyRecords,
    maxSeq: (max!.results[0] as { max_seq: number }).max_seq,
  }
}
