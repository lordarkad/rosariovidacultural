import type { Intent, MusicGenre, SearchItem } from '@tript/shared'
import { BAND_ORDER, classifyEvent, classifyPlace } from './bands'
import { distanceInfo } from './geo'
import { normalizeText } from './normalize'
import type { OpeningPeriod } from './opening-hours'
import type { SearchWindow } from './windows'

/** Evento tal como lo entrega el repo: `lat`/`lon` ya son los efectivos (propios o heredados del lugar, E-1). */
export interface EventRow {
  id: string
  title: string
  title_norm: string
  intents: Intent[]
  music_genres: MusicGenre[]
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
}

export interface PlaceRow {
  id: string
  name: string
  name_norm: string
  kind: NonNullable<SearchItem['place_kind']>
  intents: Intent[]
  opening_hours: OpeningPeriod[] | null
  address: string | null
  address_norm: string | null
  lat: number
  lon: number
  image_url: string | null
}

export interface SearchOrigin {
  lat: number
  lon: number
  radius_m: number
}

export interface SearchParams {
  intents: Intent[]
  musica: MusicGenre[]
  gratis: boolean
  window: SearchWindow
  origin: SearchOrigin | null
  q: string | null
}

interface Ranked {
  item: SearchItem
  titleNorm: string
  startKey: number | null
  matches: number
  /** `distance_m` redondeado: el orden coincide con lo que ve el cliente (F-10). */
  distance: number | null
}

const BAND_INDEX = new Map(BAND_ORDER.map((b, i) => [b, i]))

const matchCount = (itemIntents: Intent[], wanted: Set<Intent>): number =>
  itemIntents.reduce((n, i) => n + (wanted.has(i) ? 1 : 0), 0)

const textMatches = (q: string, ...fields: Array<string | null>): boolean =>
  fields.some((f) => f !== null && f.includes(q))

/** Orden F-10: franja → con ubicación → más coincidencias → distancia → hora → título normalizado → id. */
function compare(a: Ranked, b: Ranked): number {
  const bandDiff = BAND_INDEX.get(a.item.band)! - BAND_INDEX.get(b.item.band)!
  if (bandDiff) return bandDiff
  const located = Number(!a.item.location_known) - Number(!b.item.location_known)
  if (located) return located
  if (a.matches !== b.matches) return b.matches - a.matches
  if (a.distance !== b.distance) {
    if (a.distance === null) return 1
    if (b.distance === null) return -1
    return a.distance - b.distance
  }
  if (a.startKey !== b.startKey) {
    if (a.startKey === null) return 1
    if (b.startKey === null) return -1
    return a.startKey - b.startKey
  }
  if (a.titleNorm !== b.titleNorm) return a.titleNorm < b.titleNorm ? -1 : 1
  return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0
}

/**
 * Aplica en orden: origen/radio, filtros, franja y orden. Es función pura con reloj inyectado:
 * el repo solo hace un prefiltro grueso en SQL y la regla exacta vive acá.
 */
export function buildSearchResults(
  rows: { events: EventRow[]; places: PlaceRow[] },
  params: SearchParams,
  now: Date,
): SearchItem[] {
  const { window: w, origin } = params
  const wanted = new Set(params.intents)
  // F-16: con musica_en_vivo en `i`, `musica` restringe el resultado a eventos de esos géneros
  const genreFilter = wanted.has('musica_en_vivo') && params.musica.length > 0
  const q = params.q ? normalizeText(params.q) : ''
  const ranked: Ranked[] = []

  for (const e of rows.events) {
    const geo = distanceInfo(origin, e.lat, e.lon)
    if (origin && (geo.distance === null || geo.distance > origin.radius_m)) continue
    const matches = matchCount(e.intents, wanted)
    if (wanted.size > 0 && matches === 0) continue
    if (genreFilter && !e.music_genres.some((g) => params.musica.includes(g))) continue
    if (params.gratis && e.price_status !== 'free') continue
    if (q && !textMatches(q, e.title_norm, e.venue_norm, e.address_norm)) continue
    const c = classifyEvent(e, w, now)
    if (!c) continue
    ranked.push({
      item: {
        kind: 'event',
        id: e.id,
        title: e.title,
        intents: e.intents,
        band: c.band,
        place_kind: null,
        start_date: e.start_date,
        end_date: e.end_date,
        start_time: e.start_time,
        open_now: null,
        venue_name: e.venue_name,
        address: e.address,
        lat: e.lat,
        lon: e.lon,
        location_known: e.lat !== null && e.lon !== null,
        distance_m: geo.distance_m,
        walk_minutes: geo.walk_minutes,
        price_status: e.price_status,
        price_from_ars: e.price_from_ars,
        image_url: e.image_url,
      },
      titleNorm: e.title_norm,
      startKey: c.startKey,
      matches,
      distance: geo.distance_m,
    })
  }

  // Los lugares no tienen género ni precio: ni `musica` ni `gratis` los dejan pasar (F-4, F-16)
  if (!genreFilter && !params.gratis) {
    for (const p of rows.places) {
      const geo = distanceInfo(origin, p.lat, p.lon)
      if (origin && (geo.distance === null || geo.distance > origin.radius_m)) continue
      const matches = matchCount(p.intents, wanted)
      if (wanted.size > 0 && matches === 0) continue
      if (q && !textMatches(q, p.name_norm, p.address_norm)) continue
      const c = classifyPlace(p, w, now)
      if (!c) continue
      ranked.push({
        item: {
          kind: 'place',
          id: p.id,
          title: p.name,
          intents: p.intents,
          band: c.band,
          place_kind: p.kind,
          start_date: null,
          end_date: null,
          start_time: null,
          open_now: c.open_now,
          venue_name: null,
          address: p.address,
          lat: p.lat,
          lon: p.lon,
          location_known: true,
          distance_m: geo.distance_m,
          walk_minutes: geo.walk_minutes,
          price_status: 'unknown',
          price_from_ars: null,
          image_url: p.image_url,
        },
        titleNorm: p.name_norm,
        startKey: c.startKey,
        matches,
        distance: geo.distance_m,
      })
    }
  }

  return ranked.sort(compare).map((r) => r.item)
}

export function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; total: number } {
  const start = (page - 1) * perPage
  return { items: items.slice(start, start + perPage), total: items.length }
}

/** Pin del mapa: los ítems sin ubicación (E-1) no tienen. */
export function toSearchPin(
  item: SearchItem,
): { kind: SearchItem['kind']; id: string; title: string; lat: number; lon: number } | null {
  if (item.lat === null || item.lon === null) return null
  return { kind: item.kind, id: item.id, title: item.title, lat: item.lat, lon: item.lon }
}
