import type { D1Database } from '@cloudflare/workers-types'
import type { EventDetail, Intent, MusicGenre, PlaceDetail, SourceLink } from '@tript/shared'
import { haversineM, walkMinutes } from '../domain/geo'
import { isOpenAt, type OpeningPeriod } from '../domain/opening-hours'
import { nextOccurrence } from '../domain/occurrences'
import { addDays, businessDate } from '../domain/time'
import { EVENT_TTL_MS } from './search.repo'

const HOUR_MS = 3_600_000
/** E-9: más de 36 h sin verse, el Detalle avisa «datos de ayer». */
const STALE_AFTER_MS = 36 * HOUR_MS
const MAX_UPCOMING = 20

const parse = <T>(s: string | null, fallback: T): T => (s === null ? fallback : (JSON.parse(s) as T))

export interface Origin {
  lat: number
  lon: number
}

function distanceFields(origin: Origin | null, lat: number | null, lon: number | null) {
  if (!origin || lat === null || lon === null) return { distance_m: null, walk_minutes: null }
  const distance_m = Math.round(haversineM(origin.lat, origin.lon, lat, lon))
  return { distance_m, walk_minutes: walkMinutes(distance_m) }
}

// El id puede ser el de una fila absorbida por una fusión: sigue resolviendo a la vigente (E-12, F-15)
const RESOLVED_EVENT_ID = `COALESCE((SELECT event_id FROM event_id_redirects WHERE old_id = ?1), ?1)`
const RESOLVED_PLACE_ID = `COALESCE((SELECT place_id FROM place_id_redirects WHERE old_id = ?1), ?1)`

interface EventDbRow {
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
  date_text: string | null
  venue_name: string | null
  venue_norm: string | null
  address: string | null
  address_norm: string | null
  lat: number | null
  lon: number | null
  price_status: 'free' | 'paid' | 'unknown'
  price_from_ars: number | null
  image_url: string | null
  last_seen_at: string
  place_id: string | null
  place_name: string | null
  place_address: string | null
  place_lat: number | null
  place_lon: number | null
}

interface SourceDbRow {
  source_key: string
  source_name: string
  source_url: string
  via_json: string
  arrival: number
}

interface SiblingDbRow {
  id: string
  venue_name: string | null
  address: string | null
  venue_norm: string | null
  address_norm: string | null
  place_id: string | null
  place_name: string | null
  place_address: string | null
}

/** Dos eventos están en otra sede si difiere el lugar vinculado, o el `venue_name`/`address` normalizado (E-2). */
const sedeKey = (r: { place_id: string | null; venue_norm: string | null; address_norm: string | null }): string =>
  r.place_id ? `p:${r.place_id}` : `v:${r.venue_norm ?? ''}|a:${r.address_norm ?? ''}`

export async function getEventDetail(
  db: D1Database,
  id: string,
  origin: Origin | null,
  now: Date,
): Promise<EventDetail | null> {
  const expiry = new Date(now.getTime() - EVENT_TTL_MS).toISOString()
  const [eventRes, sourcesRes, siblingsRes] = await db.batch([
    db
      .prepare(
        `SELECT e.*, p.id AS place_id, p.name AS place_name, p.address AS place_address,
                p.lat AS place_lat, p.lon AS place_lon
         FROM events e
         LEFT JOIN place_keys k ON k.source_key = e.place_source_key
         LEFT JOIN places p ON p.id = k.place_id
         WHERE e.id = ${RESOLVED_EVENT_ID} AND e.last_seen_at >= ?2`,
      )
      .bind(id, expiry),
    db
      .prepare(
        `SELECT source_key, source_name, source_url, via_json, arrival FROM event_sources
         WHERE event_id = ${RESOLVED_EVENT_ID} ORDER BY arrival`,
      )
      .bind(id),
    db
      .prepare(
        `WITH self(id) AS (SELECT ${RESOLVED_EVENT_ID})
         SELECT e2.id, e2.venue_name, e2.address, e2.venue_norm, e2.address_norm,
                p2.id AS place_id, p2.name AS place_name, p2.address AS place_address
         FROM events e2
         LEFT JOIN place_keys k2 ON k2.source_key = e2.place_source_key
         LEFT JOIN places p2 ON p2.id = k2.place_id
         WHERE e2.id != (SELECT id FROM self) AND e2.last_seen_at >= ?2
           AND e2.title_norm = (SELECT title_norm FROM events WHERE id = (SELECT id FROM self))
           AND EXISTS (
             SELECT 1 FROM event_sources s2
             WHERE s2.event_id = e2.id
               AND s2.source_url IN (SELECT source_url FROM event_sources WHERE event_id = (SELECT id FROM self)))
         ORDER BY e2.seq`,
      )
      .bind(id, expiry),
  ])

  const r = (eventRes!.results as unknown as EventDbRow[])[0]
  if (!r) return null

  const lat = r.lat ?? r.place_lat
  const lon = r.lon ?? r.place_lon
  const sources = sourcesRes!.results as unknown as SourceDbRow[]
  // la primaria va primero; las demás fuentes y los links «vía» después, sin repetir URL
  const ordered = [...sources].sort(
    (a, b) => Number(b.source_key === r.source_key) - Number(a.source_key === r.source_key) || a.arrival - b.arrival,
  )
  const links: SourceLink[] = []
  const seen = new Set<string>()
  const push = (l: SourceLink) => {
    if (!seen.has(l.url)) {
      seen.add(l.url)
      links.push(l)
    }
  }
  for (const s of ordered) push({ name: s.source_name, url: s.source_url })
  for (const s of ordered) for (const v of parse<SourceLink[]>(s.via_json, [])) push(v)

  const mine = sedeKey(r)
  const also_at = (siblingsRes!.results as unknown as SiblingDbRow[])
    .filter((s) => sedeKey(s) !== mine)
    .map((s) => ({ id: s.id, venue_name: s.venue_name ?? s.place_name, address: s.address ?? s.place_address }))

  return {
    id: r.id,
    title: r.title,
    description: r.description,
    intents: parse<Intent[]>(r.intents, []),
    music_genres: parse<MusicGenre[]>(r.music_genres, []),
    start_date: r.start_date,
    end_date: r.end_date,
    start_time: r.start_time,
    date_text: r.date_text,
    venue_name: r.venue_name ?? r.place_name,
    address: r.address ?? r.place_address,
    lat,
    lon,
    location_known: lat !== null && lon !== null,
    ...distanceFields(origin, lat, lon),
    place: r.place_id ? { id: r.place_id, name: r.place_name!, address: r.place_address } : null,
    price_status: r.price_status,
    price_from_ars: r.price_from_ars,
    image_url: r.image_url,
    sources: links,
    also_at,
    last_seen_at: r.last_seen_at,
    is_stale: now.getTime() - Date.parse(r.last_seen_at) > STALE_AFTER_MS,
  } as EventDetail
}

interface PlaceDbRow {
  id: string
  name: string
  kind: PlaceDetail['kind']
  origin: PlaceDetail['origin']
  intents: string
  offers: string
  cuisine: string
  address: string | null
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
  last_seen_at: string
}

interface UpcomingDbRow {
  id: string
  title: string
  start_date: string
  end_date: string
  start_time: string | null
  price_status: 'free' | 'paid' | 'unknown'
  price_from_ars: number | null
}

export async function getPlaceDetail(
  db: D1Database,
  id: string,
  origin: Origin | null,
  now: Date,
): Promise<PlaceDetail | null> {
  const expiry = new Date(now.getTime() - EVENT_TTL_MS).toISOString()
  // prefiltro grueso: los eventos que terminaron antes de ayer ya pasaron seguro
  const notEndedBefore = addDays(businessDate(now), -1)
  const [placeRes, eventsRes] = await db.batch([
    db.prepare(`SELECT * FROM places WHERE id = ${RESOLVED_PLACE_ID}`).bind(id),
    db
      .prepare(
        `WITH self(id) AS (SELECT ${RESOLVED_PLACE_ID})
         SELECT e.id, e.title, e.start_date, e.end_date, e.start_time, e.price_status, e.price_from_ars
         FROM events e JOIN place_keys k ON k.source_key = e.place_source_key
         WHERE k.place_id = (SELECT id FROM self) AND e.last_seen_at >= ?2 AND e.end_date >= ?3`,
      )
      .bind(id, expiry, notEndedBefore),
  ])

  const r = (placeRes!.results as unknown as PlaceDbRow[])[0]
  if (!r) return null

  const hours = parse<OpeningPeriod[] | null>(r.opening_hours, null)
  const upcoming_events = (eventsRes!.results as unknown as UpcomingDbRow[])
    .map((e) => ({ e, next: nextOccurrence(e, now) }))
    .filter((x): x is { e: UpcomingDbRow; next: Date } => x.next !== null)
    .sort((a, b) => a.next.getTime() - b.next.getTime() || (a.e.id < b.e.id ? -1 : 1))
    .slice(0, MAX_UPCOMING)
    .map(({ e }) => ({
      id: e.id,
      title: e.title,
      start_date: e.start_date,
      start_time: e.start_time,
      price_status: e.price_status,
      price_from_ars: e.price_from_ars,
    }))

  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    origin: r.origin,
    intents: parse<Intent[]>(r.intents, []),
    offers: parse(r.offers, []),
    cuisine: parse<string[]>(r.cuisine, []),
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    location_known: true,
    ...distanceFields(origin, r.lat, r.lon),
    opening_hours: hours,
    hours_text: r.hours_text,
    open_now: isOpenAt(hours, now),
    phone: r.phone,
    website: r.website,
    instagram: r.instagram,
    outdoor: r.outdoor === null ? null : r.outdoor === 1,
    note: r.note,
    image_url: r.image_url,
    upcoming_events,
    last_seen_at: r.last_seen_at,
  } as PlaceDetail
}
