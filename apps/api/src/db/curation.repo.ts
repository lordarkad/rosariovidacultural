import type { D1Database } from '@cloudflare/workers-types'
import type {
  CurationEvent,
  CurationPlace,
  EventMissingField,
  EventSourceCount,
  EventState,
  Intent,
  MusicGenre,
  PlaceMissingField,
} from '@tript/shared'
import { normalizeText } from '../domain/normalize'
import { businessDate } from '../domain/time'
import { buildSourceLinks, type SourceDbRow } from './detail.repo'
import { parse } from './json'
import { EVENT_TTL_MS } from './search.repo'

export interface Page<T> {
  rows: T[]
  total: number
}

export interface CurationEventsFilter {
  q: string | null
  fuente: string[]
  estado: EventState[]
  faltan: EventMissingField[]
  page: number
  per_page: number
}

export interface CurationPlacesFilter {
  q: string | null
  origen: string[]
  tipo: string[]
  faltan: PlaceMissingField[]
  page: number
  per_page: number
}

const ESTADOS: EventState[] = ['vigente', 'pasado', 'sin_ver']
/** Orden de `EventMissingField` en el contrato: así sale `missing`. */
const EVENT_MISSING: EventMissingField[] = ['imagen', 'lugar', 'hora', 'precio', 'descripcion', 'direccion', 'coordenadas']
const PLACE_MISSING: PlaceMissingField[] = ['imagen', 'horario', 'direccion', 'telefono', 'web', 'cocina', 'nota']

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ')
const blank = (col: string) => `(${col} IS NULL OR TRIM(${col}) = '')`

/**
 * Eventos con el lugar vinculado resuelto (misma unión que `getEventDetail`) y, por fila, el estado y un
 * indicador 0/1 por campo faltante. Es la única definición de «estado» y «faltante»: el filtro y `missing` salen de acá.
 */
const EVENTS_BASE = `
  WITH base AS (
    SELECT e.*,
           p.id AS place_id, p.name AS place_name, p.address AS place_address,
           p.lat AS place_lat, p.lon AS place_lon,
           COALESCE(e.venue_name, p.name) AS eff_venue,
           COALESCE(e.venue_norm, p.name_norm) AS eff_venue_norm,
           COALESCE(e.address, p.address) AS eff_address,
           COALESCE(e.address_norm, p.address_norm) AS eff_address_norm,
           COALESCE(e.lat, p.lat) AS eff_lat,
           COALESCE(e.lon, p.lon) AS eff_lon,
           CASE WHEN e.last_seen_at < ?1 THEN 2 WHEN e.end_date < ?2 THEN 1 ELSE 0 END AS estado_n,
           CASE WHEN e.image_url IS NULL OR e.image_url = '' THEN 1 ELSE 0 END AS m_imagen,
           CASE WHEN e.start_time IS NULL THEN 1 ELSE 0 END AS m_hora,
           CASE WHEN e.price_status = 'unknown' THEN 1 ELSE 0 END AS m_precio,
           CASE WHEN ${blank('e.description')} THEN 1 ELSE 0 END AS m_descripcion,
           CASE WHEN ${blank('COALESCE(e.address, p.address)')} THEN 1 ELSE 0 END AS m_direccion,
           CASE WHEN COALESCE(e.lat, p.lat) IS NULL OR COALESCE(e.lon, p.lon) IS NULL THEN 1 ELSE 0 END AS m_coordenadas,
           CASE WHEN p.id IS NULL AND ${blank('COALESCE(e.venue_name, p.name)')}
                     AND ${blank('COALESCE(e.address, p.address)')}
                     AND (COALESCE(e.lat, p.lat) IS NULL OR COALESCE(e.lon, p.lon) IS NULL)
                THEN 1 ELSE 0 END AS m_lugar
    FROM events e
    LEFT JOIN place_keys k ON k.source_key = e.place_source_key
    LEFT JOIN places p ON p.id = k.place_id
  )`

interface EventRow {
  id: string
  source_key: string
  source_name: string
  source_tier: CurationEvent['source_tier']
  source_url: string
  via_json: string
  title: string
  description: string | null
  intents: string
  music_genres: string
  start_date: string
  end_date: string
  start_time: string | null
  date_text: string | null
  eff_venue: string | null
  eff_address: string | null
  eff_lat: number | null
  eff_lon: number | null
  place_id: string | null
  place_name: string | null
  place_address: string | null
  price_status: CurationEvent['price_status']
  price_from_ars: number | null
  image_url: string | null
  last_seen_at: string
  estado_n: number
  m_imagen: number
  m_hora: number
  m_precio: number
  m_descripcion: number
  m_direccion: number
  m_coordenadas: number
  m_lugar: number
}

/** `q` ya normalizado y no vacío: subcadena sobre título, sede y dirección efectivas y fuentes que lo contienen. */
async function matchingSources(db: D1Database, q: string): Promise<string[]> {
  const { results } = await db.prepare('SELECT DISTINCT source_name FROM events').all<{ source_name: string }>()
  return results.map((r) => r.source_name).filter((n) => normalizeText(n).includes(q))
}

export async function listEvents(db: D1Database, f: CurationEventsFilter, now: Date): Promise<Page<CurationEvent>> {
  const expiry = new Date(now.getTime() - EVENT_TTL_MS).toISOString()
  const where: string[] = []
  const params: unknown[] = []

  const q = f.q ? normalizeText(f.q) : ''
  if (q) {
    const sources = await matchingSources(db, q)
    const parts = [
      'instr(title_norm, ?) > 0',
      'instr(eff_venue_norm, ?) > 0',
      'instr(eff_address_norm, ?) > 0',
    ]
    params.push(q, q, q)
    if (sources.length > 0) {
      parts.push(`source_name IN (${placeholders(sources.length)})`)
      params.push(...sources)
    }
    where.push(`(${parts.join(' OR ')})`)
  }
  if (f.fuente.length > 0) {
    where.push(`source_name IN (${placeholders(f.fuente.length)})`)
    params.push(...f.fuente)
  }
  if (f.estado.length > 0) {
    where.push(`estado_n IN (${placeholders(f.estado.length)})`)
    params.push(...f.estado.map((s) => ESTADOS.indexOf(s)))
  }
  if (f.faltan.length > 0) where.push(`(${f.faltan.map((m) => `m_${m} = 1`).join(' OR ')})`)
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  // `?1` y `?2` van numerados; los demás son anónimos y se numeran después, así que se pasan en este orden
  const base = [expiry, businessDate(now)]
  const offset = (f.page - 1) * f.per_page
  const [rowsRes, countRes] = await db.batch([
    db
      .prepare(
        `${EVENTS_BASE}
         SELECT * FROM base ${clause}
         ORDER BY estado_n, start_date, start_time IS NULL, start_time, title_norm, id
         LIMIT ? OFFSET ?`,
      )
      .bind(...base, ...params, f.per_page, offset),
    db.prepare(`${EVENTS_BASE} SELECT COUNT(*) AS n FROM base ${clause}`).bind(...base, ...params),
  ])
  const rows = rowsRes!.results as unknown as EventRow[]
  const total = (countRes!.results[0] as { n: number }).n

  const bySource = new Map<string, SourceDbRow[]>()
  if (rows.length > 0) {
    const { results } = await db
      .prepare(
        `SELECT event_id, source_key, source_name, source_url, via_json, arrival FROM event_sources
         WHERE event_id IN (${placeholders(rows.length)})`,
      )
      .bind(...rows.map((r) => r.id))
      .all<SourceDbRow & { event_id: string }>()
    for (const s of results) bySource.set(s.event_id, [...(bySource.get(s.event_id) ?? []), s])
  }

  return {
    total,
    rows: rows.map((r) => {
      const links = buildSourceLinks(r.source_key, bySource.get(r.id) ?? [])
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        intents: parse<Intent[]>(r.intents, []),
        music_genres: parse<MusicGenre[]>(r.music_genres, []),
        estado: ESTADOS[r.estado_n]!,
        start_date: r.start_date,
        end_date: r.end_date,
        start_time: r.start_time,
        date_text: r.date_text,
        venue_name: r.eff_venue,
        address: r.eff_address,
        lat: r.eff_lat,
        lon: r.eff_lon,
        place: r.place_id ? { id: r.place_id, name: r.place_name!, address: r.place_address } : null,
        price_status: r.price_status,
        price_from_ars: r.price_from_ars,
        image_url: r.image_url,
        source_name: r.source_name,
        source_tier: r.source_tier,
        // un evento siempre tiene al menos su fuente primaria (minItems 1 del contrato)
        sources: links.length > 0 ? links : [{ name: r.source_name, url: r.source_url }, ...parse(r.via_json, [])],
        last_seen_at: r.last_seen_at,
        missing: EVENT_MISSING.filter((m) => (r as unknown as Record<string, number>)[`m_${m}`] === 1),
      } as CurationEvent
    }),
  }
}

export async function listEventSources(db: D1Database): Promise<EventSourceCount[]> {
  const { results } = await db
    .prepare('SELECT source_name AS name, COUNT(*) AS count FROM events GROUP BY source_name ORDER BY source_name')
    .all<EventSourceCount>()
  return results
}

const PLACES_BASE = `
  WITH base AS (
    SELECT p.*,
           CASE WHEN p.image_url IS NULL OR p.image_url = '' THEN 1 ELSE 0 END AS m_imagen,
           CASE WHEN p.opening_hours IS NULL THEN 1 ELSE 0 END AS m_horario,
           CASE WHEN ${blank('p.address')} THEN 1 ELSE 0 END AS m_direccion,
           CASE WHEN ${blank('p.phone')} THEN 1 ELSE 0 END AS m_telefono,
           CASE WHEN ${blank('p.website')} THEN 1 ELSE 0 END AS m_web,
           CASE WHEN p.cuisine = '[]' THEN 1 ELSE 0 END AS m_cocina,
           CASE WHEN ${blank('p.note')} THEN 1 ELSE 0 END AS m_nota
    FROM places p
  )`

interface PlaceRow {
  id: string
  name: string
  kind: CurationPlace['kind']
  origin: CurationPlace['origin']
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
  m_imagen: number
  m_horario: number
  m_direccion: number
  m_telefono: number
  m_web: number
  m_cocina: number
  m_nota: number
}

export async function listPlaces(db: D1Database, f: CurationPlacesFilter): Promise<Page<CurationPlace>> {
  const where: string[] = []
  const params: unknown[] = []

  const q = f.q ? normalizeText(f.q) : ''
  if (q) {
    where.push('(instr(name_norm, ?) > 0 OR instr(address_norm, ?) > 0)')
    params.push(q, q)
  }
  if (f.origen.length > 0) {
    where.push(`origin IN (${placeholders(f.origen.length)})`)
    params.push(...f.origen)
  }
  if (f.tipo.length > 0) {
    where.push(`kind IN (${placeholders(f.tipo.length)})`)
    params.push(...f.tipo)
  }
  if (f.faltan.length > 0) where.push(`(${f.faltan.map((m) => `m_${m} = 1`).join(' OR ')})`)
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const offset = (f.page - 1) * f.per_page
  const [rowsRes, countRes] = await db.batch([
    db
      .prepare(`${PLACES_BASE} SELECT * FROM base ${clause} ORDER BY name_norm, id LIMIT ? OFFSET ?`)
      .bind(...params, f.per_page, offset),
    db.prepare(`${PLACES_BASE} SELECT COUNT(*) AS n FROM base ${clause}`).bind(...params),
  ])
  const rows = rowsRes!.results as unknown as PlaceRow[]

  return {
    total: (countRes!.results[0] as { n: number }).n,
    rows: rows.map(
      (r) =>
        ({
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
          has_opening_hours: r.opening_hours !== null,
          hours_text: r.hours_text,
          phone: r.phone,
          website: r.website,
          instagram: r.instagram,
          outdoor: r.outdoor === null ? null : r.outdoor === 1,
          note: r.note,
          image_url: r.image_url,
          last_seen_at: r.last_seen_at,
          missing: PLACE_MISSING.filter((m) => (r as unknown as Record<string, number>)[`m_${m}`] === 1),
        }) as CurationPlace,
    ),
  }
}
