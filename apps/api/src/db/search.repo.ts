import type { D1Database } from '@cloudflare/workers-types'
import type { Intent, MusicGenre } from '@tript/shared'
import { bboxAround } from '../domain/geo'
import type { OpeningPeriod } from '../domain/opening-hours'
import type { EventRow, PlaceRow, SearchOrigin } from '../domain/search-pipeline'
import { addDays } from '../domain/time'
import type { SearchWindow } from '../domain/windows'

const DAY_MS = 24 * 3_600_000
/** E-9: un evento sin verse hace más de 7 días sale de los resultados. Los lugares no vencen. */
export const EVENT_TTL_MS = 7 * DAY_MS

const parse = <T>(s: string | null, fallback: T): T => (s === null ? fallback : (JSON.parse(s) as T))

interface EventDbRow {
  id: string
  title: string
  title_norm: string
  intents: string
  music_genres: string
  start_date: string
  end_date: string
  start_time: string | null
  venue_name: string | null
  venue_norm: string | null
  address: string | null
  address_norm: string | null
  lat: number | null
  lon: number | null
  price_status: 'free' | 'paid' | 'unknown'
  price_from_ars: number | null
  image_url: string | null
  place_name: string | null
  place_name_norm: string | null
  place_address: string | null
  place_address_norm: string | null
  place_lat: number | null
  place_lon: number | null
}

interface PlaceDbRow {
  id: string
  name: string
  name_norm: string
  kind: PlaceRow['kind']
  intents: string
  opening_hours: string | null
  address: string | null
  address_norm: string | null
  lat: number
  lon: number
  image_url: string | null
}

/** Coordenadas efectivas de un evento: las propias o, si no tiene, las del lugar vinculado (E-1). */
const EFFECTIVE_LAT = 'COALESCE(e.lat, p.lat)'
const EFFECTIVE_LON = 'COALESCE(e.lon, p.lon)'

/**
 * Candidatos de una búsqueda. SQL solo hace un prefiltro grueso (vencimiento, superposición de fechas con la
 * ventana ±1 día y recuadro alrededor del origen); la regla exacta —franja, radio, filtros, orden— vive en
 * `buildSearchResults`. Son 2 consultas en un solo `D1.batch`. El catálogo es de unos pocos miles de filas.
 */
export async function fetchCandidates(
  db: D1Database,
  window: SearchWindow,
  origin: SearchOrigin | null,
  now: Date,
): Promise<{ events: EventRow[]; places: PlaceRow[] }> {
  const dates = [...window.businessDates].sort()
  const minDate = addDays(dates[0]!, -1)
  const maxDate = addDays(dates[dates.length - 1]!, 1)
  const expiry = new Date(now.getTime() - EVENT_TTL_MS).toISOString()
  const box = origin ? bboxAround(origin.lat, origin.lon, origin.radius_m) : null

  const eventSql = `
    SELECT e.id, e.title, e.title_norm, e.intents, e.music_genres, e.start_date, e.end_date, e.start_time,
           e.venue_name, e.venue_norm, e.address, e.address_norm, e.lat, e.lon,
           e.price_status, e.price_from_ars, e.image_url,
           p.name AS place_name, p.name_norm AS place_name_norm, p.address AS place_address,
           p.address_norm AS place_address_norm, p.lat AS place_lat, p.lon AS place_lon
    FROM events e
    LEFT JOIN place_keys k ON k.source_key = e.place_source_key
    LEFT JOIN places p ON p.id = k.place_id
    WHERE e.last_seen_at >= ?1 AND e.start_date <= ?2 AND e.end_date >= ?3
    ${box ? `AND ${EFFECTIVE_LAT} BETWEEN ?4 AND ?5 AND ${EFFECTIVE_LON} BETWEEN ?6 AND ?7` : ''}`
  const placeSql = `
    SELECT id, name, name_norm, kind, intents, opening_hours, address, address_norm, lat, lon, image_url
    FROM places
    ${box ? 'WHERE lat BETWEEN ?1 AND ?2 AND lon BETWEEN ?3 AND ?4' : ''}`

  const eventArgs: unknown[] = [expiry, maxDate, minDate]
  const placeArgs: unknown[] = []
  if (box) {
    const [minLon, minLat, maxLon, maxLat] = box
    eventArgs.push(minLat, maxLat, minLon, maxLon)
    placeArgs.push(minLat, maxLat, minLon, maxLon)
  }
  const [events, places] = await db.batch([
    db.prepare(eventSql).bind(...eventArgs),
    db.prepare(placeSql).bind(...placeArgs),
  ])

  return {
    events: (events!.results as unknown as EventDbRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      title_norm: r.title_norm,
      intents: parse<Intent[]>(r.intents, []),
      music_genres: parse<MusicGenre[]>(r.music_genres, []),
      start_date: r.start_date,
      end_date: r.end_date,
      start_time: r.start_time,
      venue_name: r.venue_name ?? r.place_name,
      venue_norm: r.venue_norm ?? r.place_name_norm,
      address: r.address ?? r.place_address,
      address_norm: r.address_norm ?? r.place_address_norm,
      lat: r.lat ?? r.place_lat,
      lon: r.lon ?? r.place_lon,
      price_status: r.price_status,
      price_from_ars: r.price_from_ars,
      image_url: r.image_url,
    })),
    places: (places!.results as unknown as PlaceDbRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      name_norm: r.name_norm,
      kind: r.kind,
      intents: parse<Intent[]>(r.intents, []),
      opening_hours: parse<OpeningPeriod[] | null>(r.opening_hours, null),
      address: r.address,
      address_norm: r.address_norm,
      lat: r.lat,
      lon: r.lon,
      image_url: r.image_url,
    })),
  }
}
