import type { Intent, MusicGenre, SearchItem } from '@tript/shared'
import type { Cuando, SearchQuery } from '@/services/api'
import { bandLabel, formatDate } from '@/lib/format'
import { RADIO_DEFAULT, clampRadius, formatRadius } from '@/lib/geo'

export const INTENTS: { value: Intent; label: string }[] = [
  { value: 'comer', label: 'Comer' },
  { value: 'tomar_algo', label: 'Tomar algo' },
  { value: 'espectaculo', label: 'Ver espectáculo' },
  { value: 'musica_en_vivo', label: 'Música en vivo' },
  { value: 'bailar', label: 'Bailar' },
  { value: 'con_chicos', label: 'Con chicos' },
]

export const GENRES: { value: MusicGenre; label: string }[] = [
  { value: 'jazz', label: 'Jazz' },
  { value: 'rock', label: 'Rock' },
  { value: 'folklore', label: 'Folklore' },
  { value: 'electronica', label: 'Electrónica' },
  { value: 'tango', label: 'Tango' },
  { value: 'cumbia', label: 'Cumbia' },
  { value: 'clasica', label: 'Clásica' },
  { value: 'chamame', label: 'Chamamé' },
]

export const CUANDO: { value: Cuando; label: string }[] = [
  { value: 'ahora', label: 'Ahora' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'manana', label: 'Mañana' },
  { value: 'finde', label: 'Finde' },
  { value: 'fecha', label: 'Elegir' },
]

const INTENT_VALUES = new Set<string>(INTENTS.map((i) => i.value))
const GENRE_VALUES = new Set<string>(GENRES.map((g) => g.value))
const CUANDO_VALUES = new Set<string>(CUANDO.map((c) => c.value))
const DATE = /^\d{4}-\d{2}-\d{2}$/
const ZONE = /^[a-z0-9-]+$/

/** Los subtipos de música solo valen con estas intenciones (F-16/F-17). */
export const MUSIC_INTENTS: Intent[] = ['musica_en_vivo', 'bailar']

export const hasMusicIntent = (i: Intent[] | undefined): boolean =>
  (i ?? []).some((v) => MUSIC_INTENTS.includes(v))

type RawQuery = Record<string, string | null | (string | null)[] | undefined>

const first = (raw: RawQuery, key: string): string | undefined => {
  const v = raw[key]
  const s = Array.isArray(v) ? v[0] : v
  return s ?? undefined
}

const list = (raw: RawQuery, key: string, known: Set<string>): string[] =>
  [...new Set((first(raw, key) ?? '').split(',').filter((v) => known.has(v)))]

/** Lee la búsqueda de la URL (S2-3). Lo que no se reconoce se descarta, nunca rompe la pantalla. */
export function parseSearch(raw: RawQuery): SearchQuery {
  const q: SearchQuery = {}

  const i = list(raw, 'i', INTENT_VALUES) as Intent[]
  if (i.length) q.i = i

  const musica = list(raw, 'musica', GENRE_VALUES) as MusicGenre[]
  if (musica.length && hasMusicIntent(q.i)) q.musica = musica

  if (first(raw, 'gratis') === 'true') q.gratis = true

  const cuando = first(raw, 'cuando')
  if (cuando && CUANDO_VALUES.has(cuando)) {
    const fecha = first(raw, 'fecha')
    if (cuando !== 'fecha') q.cuando = cuando as Cuando
    else if (fecha && DATE.test(fecha)) Object.assign(q, { cuando: 'fecha', fecha })
  }

  const z = first(raw, 'z')
  if (z && ZONE.test(z)) q.z = z

  // La zona y el origen por coordenadas son excluyentes (E-8): si vienen las dos, gana la zona.
  if (!q.z) {
    const lat = coord(first(raw, 'lat'), 90)
    const lon = coord(first(raw, 'lon'), 180)
    if (lat !== undefined && lon !== undefined) {
      q.lat = lat
      q.lon = lon
      const radio = first(raw, 'radio_m')
      if (radio !== undefined && radio !== '' && Number.isFinite(Number(radio))) q.radio_m = clampRadius(Number(radio))
    }
  }

  const text = first(raw, 'q')?.trim()
  if (text) q.q = text.slice(0, 80)

  return q
}

const coord = (v: string | undefined, max: number): number | undefined => {
  if (v === undefined || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined
}

const round5 = (n: number): string => String(Math.round(n * 1e5) / 1e5)

/** Inversa de `parseSearch`: el objeto que se le pasa al router. */
export function toRouteQuery(q: SearchQuery): Record<string, string> {
  const out: Record<string, string> = {}
  if (q.i?.length) out.i = q.i.join(',')
  if (q.musica?.length && hasMusicIntent(q.i)) out.musica = q.musica.join(',')
  if (q.gratis) out.gratis = 'true'
  if (q.cuando) out.cuando = q.cuando
  if (q.cuando === 'fecha' && q.fecha) out.fecha = q.fecha
  if (q.z) out.z = q.z
  else if (q.lat !== undefined && q.lon !== undefined) {
    out.lat = round5(q.lat)
    out.lon = round5(q.lon)
    if (q.radio_m !== undefined) out.radio_m = String(q.radio_m)
  }
  if (q.q) out.q = q.q
  return out
}

export interface BandGroup {
  band: string
  label: string
  items: SearchItem[]
}

/** Agrupa respetando el orden del servidor (F-10): una franja nueva abre grupo, la misma sigue el anterior. */
export function groupByBand(items: SearchItem[]): BandGroup[] {
  const groups: BandGroup[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.band === item.band) last.items.push(item)
    else groups.push({ band: item.band, label: bandLabel(item.band), items: [item] })
  }
  return groups
}

export interface PhraseParts {
  que: string
  donde: string
  cuando: string
}

/** Frase de la búsqueda (S2-13): «Comer · Toda la ciudad · Hoy». */
export function describeSearch(q: SearchQuery, zoneName?: string): PhraseParts {
  const names = (q.i ?? []).map((v) => INTENTS.find((x) => x.value === v)?.label ?? v)
  const que = q.q ? [...names, `“${q.q}”`] : names
  if (q.gratis) que.push('Gratis')
  const cuando =
    q.cuando === 'fecha' && q.fecha
      ? formatDate(q.fecha)
      : (CUANDO.find((c) => c.value === (q.cuando ?? 'hoy'))?.label ?? 'Hoy')
  return {
    que: que.length ? que.join(' + ') : 'Todo',
    donde: q.z
      ? (zoneName ?? q.z)
      : q.lat !== undefined && q.lon !== undefined
        ? `Cerca · ${formatRadius(q.radio_m ?? RADIO_DEFAULT)}`
        : 'Toda la ciudad',
    cuando,
  }
}
