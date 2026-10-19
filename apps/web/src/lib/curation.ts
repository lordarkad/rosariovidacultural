import type {
  CurationEvent,
  CurationPlace,
  EventMissingField,
  EventState,
  PlaceKind,
  PlaceMissingField,
  PlaceOrigin,
} from '@tript/shared'
import type { CurationEventsQuery, CurationPlacesQuery } from '@/services/api'

export const PAGE_SIZE = 50
export const EXPORT_PAGE_SIZE = 100
const PAGE_MAX = 10000
const Q_MAX = 100
const FUENTE_MAX = 20

export const ESTADOS: { value: EventState; label: string }[] = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'pasado', label: 'Pasado' },
  { value: 'sin_ver', label: 'Sin ver hace +7 d' },
]

export const EVENT_MISSING: { value: EventMissingField; label: string }[] = [
  { value: 'imagen', label: 'Imagen' },
  { value: 'lugar', label: 'Lugar' },
  { value: 'hora', label: 'Hora' },
  { value: 'precio', label: 'Precio' },
  { value: 'descripcion', label: 'Descripción' },
  { value: 'direccion', label: 'Dirección' },
  { value: 'coordenadas', label: 'Coordenadas' },
]

export const PLACE_MISSING: { value: PlaceMissingField; label: string }[] = [
  { value: 'imagen', label: 'Imagen' },
  { value: 'horario', label: 'Horario' },
  { value: 'direccion', label: 'Dirección' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'web', label: 'Web' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'nota', label: 'Nota' },
]

export const ORIGENES: { value: PlaceOrigin; label: string }[] = [
  { value: 'curated', label: 'Curado' },
  { value: 'osm', label: 'OpenStreetMap' },
]

export const TIPOS: { value: PlaceKind; label: string }[] = [
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'bar', label: 'Bar' },
  { value: 'cafe', label: 'Café' },
  { value: 'heladeria', label: 'Heladería' },
  { value: 'comida_rapida', label: 'Comida rápida' },
  { value: 'sala', label: 'Sala' },
  { value: 'otro', label: 'Otro' },
]

const labelOf = <T extends string>(list: { value: T; label: string }[], v: string): string =>
  list.find((x) => x.value === v)?.label ?? v
export const estadoLabel = (v: string) => labelOf(ESTADOS, v)
export const eventMissingLabel = (v: string) => labelOf(EVENT_MISSING, v)
export const placeMissingLabel = (v: string) => labelOf(PLACE_MISSING, v)
export const tipoLabel = (v: string) => labelOf(TIPOS, v)
export const origenLabel = (v: string) => labelOf(ORIGENES, v)

// ——— Filtros ⇄ URL ———

export interface EventsFilters {
  q?: string
  fuente?: string[]
  estado?: EventState[]
  faltan?: EventMissingField[]
  page?: number
}

export interface PlacesFilters {
  q?: string
  origen?: PlaceOrigin[]
  tipo?: PlaceKind[]
  faltan?: PlaceMissingField[]
  page?: number
}

type RawQuery = Record<string, string | null | (string | null)[] | undefined>

const first = (raw: RawQuery, key: string): string | undefined => {
  const v = raw[key]
  const s = Array.isArray(v) ? v[0] : v
  return s ?? undefined
}

const known = <T extends string>(raw: RawQuery, key: string, options: { value: T }[]): T[] => {
  const ok = new Set<string>(options.map((o) => o.value))
  return [...new Set((first(raw, key) ?? '').split(',').filter((v) => ok.has(v)))] as T[]
}

function common(raw: RawQuery): { q?: string; page?: number } {
  const out: { q?: string; page?: number } = {}
  const q = first(raw, 'q')?.trim().slice(0, Q_MAX)
  if (q) out.q = q
  const page = first(raw, 'page')
  if (page !== undefined && /^\d+$/.test(page)) {
    const n = Number(page)
    if (n >= 1 && n <= PAGE_MAX) out.page = n
  }
  return out
}

/** Lee la URL de `/curacion/eventos`. Lo que no se reconoce se descarta, nunca rompe la pantalla. */
export function parseEventsFilters(raw: RawQuery): EventsFilters {
  const f: EventsFilters = common(raw)
  const fuente = [...new Set((first(raw, 'fuente') ?? '').split(',').map((s) => s.trim()).filter(Boolean))]
    .map((s) => s.slice(0, Q_MAX))
    .slice(0, FUENTE_MAX)
  if (fuente.length) f.fuente = fuente
  const estado = known(raw, 'estado', ESTADOS)
  if (estado.length) f.estado = estado
  const faltan = known(raw, 'faltan', EVENT_MISSING)
  if (faltan.length) f.faltan = faltan
  return f
}

/** Lee la URL de `/curacion/lugares`. */
export function parsePlacesFilters(raw: RawQuery): PlacesFilters {
  const f: PlacesFilters = common(raw)
  const origen = known(raw, 'origen', ORIGENES)
  if (origen.length) f.origen = origen
  const tipo = known(raw, 'tipo', TIPOS)
  if (tipo.length) f.tipo = tipo
  const faltan = known(raw, 'faltan', PLACE_MISSING)
  if (faltan.length) f.faltan = faltan
  return f
}

/** Filtros → query de la URL: sin vacíos y sin la página 1. */
export function filtersToQuery(f: EventsFilters | PlacesFilters): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(f)) {
    if (key === 'page') {
      if (typeof value === 'number' && value > 1) out.page = String(value)
    } else if (Array.isArray(value)) {
      if (value.length) out[key] = value.join(',')
    } else if (typeof value === 'string' && value) out[key] = value
  }
  return out
}

/** Los filtros de la pantalla son los mismos parámetros del API, más el tamaño de página. */
export const eventsApiQuery = (f: EventsFilters, perPage = PAGE_SIZE): CurationEventsQuery => ({
  ...f,
  page: f.page ?? 1,
  per_page: perPage,
})
export const placesApiQuery = (f: PlacesFilters, perPage = PAGE_SIZE): CurationPlacesQuery => ({
  ...f,
  page: f.page ?? 1,
  per_page: perPage,
})

export const hasFilters = (f: EventsFilters | PlacesFilters): boolean =>
  Object.keys(filtersToQuery({ ...f, page: undefined })).length > 0

// ——— Fechas (Buenos Aires, UTC−3 sin horario de verano) ———

const OFFSET_MS = -3 * 3_600_000
const localDate = (d: Date): string => new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10)
const dayNumber = (isoDate: string): number => Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000

/** «hoy» o «N d»: días calendario entre la última vez que se vio y ahora, en hora de Buenos Aires. */
export function vistoLabel(lastSeenAt: string, now: Date = new Date()): string {
  const days = Math.max(0, dayNumber(localDate(now)) - dayNumber(localDate(new Date(lastSeenAt))))
  return days === 0 ? 'hoy' : `${days} d`
}

/** `24/10` o `24/10 → 30/10` si el evento dura más de un día. */
export function fechaLabel(start: string, end: string): string {
  const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  return start === end ? short(start) : `${short(start)} → ${short(end)}`
}

export function precioLabel(status: string, from: number | null): string {
  if (status === 'free') return 'Gratis'
  if (status === 'paid') return from !== null ? `Desde $${from.toLocaleString('es-AR')}` : 'Pago'
  return '—'
}

// ——— CSV ———

export interface CsvColumn<T> {
  header: string
  /** `number`: lo generó la API (coma decimal, sin apóstrofo). `text`: viene de terceros. */
  kind?: 'text' | 'number'
  value: (row: T) => string | number | null | undefined | string[]
}

const FORMULA = /^[=+\-@\t\r]/

export function csvCell(value: string | number | null | undefined | string[], kind: 'text' | 'number' = 'text'): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value).replace('.', ',')
  let s = Array.isArray(value) ? value.join(' | ') : value
  if (kind === 'text' && FORMULA.test(s)) s = `'${s}`
  return /[;"\n\r]|^\s/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** UTF-8 con BOM, separador `;` (Excel en español) y CRLF. */
export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const line = (cells: string[]) => `${cells.join(';')}\r\n`
  return (
    '﻿' +
    line(columns.map((c) => csvCell(c.header))) +
    rows.map((r) => line(columns.map((c) => csvCell(c.value(r), c.kind)))).join('')
  )
}

export const EVENT_CSV_COLUMNS: CsvColumn<CurationEvent>[] = [
  { header: 'ID', value: (e) => e.id },
  { header: 'Título', value: (e) => e.title },
  { header: 'Estado', value: (e) => estadoLabel(e.estado) },
  { header: 'Fecha inicio', value: (e) => e.start_date },
  { header: 'Fecha fin', value: (e) => e.end_date },
  { header: 'Hora', value: (e) => e.start_time },
  { header: 'Texto de fecha', value: (e) => e.date_text },
  { header: 'Sede', value: (e) => e.venue_name },
  { header: 'Dirección', value: (e) => e.address },
  { header: 'Latitud', kind: 'number', value: (e) => e.lat },
  { header: 'Longitud', kind: 'number', value: (e) => e.lon },
  { header: 'Lugar vinculado', value: (e) => e.place?.name },
  { header: 'Precio', value: (e) => e.price_status },
  { header: 'Desde (ARS)', kind: 'number', value: (e) => e.price_from_ars },
  { header: 'Fuente', value: (e) => e.source_name },
  { header: 'Nivel de fuente', value: (e) => e.source_tier },
  { header: 'URL de la fuente', value: (e) => e.sources[0]?.url },
  { header: 'Vías', value: (e) => e.sources.slice(1).map((s) => `${s.name} ${s.url}`) },
  { header: 'Intenciones', value: (e) => e.intents },
  { header: 'Géneros', value: (e) => e.music_genres },
  { header: 'Descripción', value: (e) => e.description },
  { header: 'Imagen', value: (e) => e.image_url },
  { header: 'Visto por última vez', value: (e) => e.last_seen_at },
  { header: 'Faltan', value: (e) => e.missing },
]

export const PLACE_CSV_COLUMNS: CsvColumn<CurationPlace>[] = [
  { header: 'ID', value: (p) => p.id },
  { header: 'Nombre', value: (p) => p.name },
  { header: 'Tipo', value: (p) => tipoLabel(p.kind) },
  { header: 'Origen', value: (p) => origenLabel(p.origin) },
  { header: 'Dirección', value: (p) => p.address },
  { header: 'Latitud', kind: 'number', value: (p) => p.lat },
  { header: 'Longitud', kind: 'number', value: (p) => p.lon },
  { header: 'Cocina', value: (p) => p.cuisine },
  { header: 'Ofrece', value: (p) => p.offers },
  { header: 'Intenciones', value: (p) => p.intents },
  { header: 'Horario estructurado', value: (p) => (p.has_opening_hours ? 'sí' : 'no') },
  { header: 'Horario (texto)', value: (p) => p.hours_text },
  { header: 'Teléfono', value: (p) => p.phone },
  { header: 'Web', value: (p) => p.website },
  { header: 'Instagram', value: (p) => p.instagram },
  { header: 'Al aire libre', value: (p) => (p.outdoor === null ? null : p.outdoor ? 'sí' : 'no') },
  { header: 'Nota', value: (p) => p.note },
  { header: 'Imagen', value: (p) => p.image_url },
  { header: 'Visto por última vez', value: (p) => p.last_seen_at },
  { header: 'Faltan', value: (p) => p.missing },
]

export const csvFileName = (kind: 'eventos' | 'lugares', now: Date = new Date()): string =>
  `curacion-${kind}-${localDate(now)}.csv`

/** Descarga el CSV en el navegador. */
export function downloadCsv(name: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ——— noindex y entorno ———

/** `<meta name="robots">` solo en las rutas de curación (además del header `X-Robots-Tag` de `_headers`). */
export function setRobotsMeta(noindex: boolean): void {
  const existing = document.head.querySelector('meta[name="robots"]')
  if (!noindex) {
    existing?.remove()
    return
  }
  const meta = existing ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
  meta.setAttribute('content', 'noindex, nofollow')
}

export const robotsGuard = (to: { meta: Record<string | symbol, unknown> }): void => setRobotsMeta(to.meta.noindex === true)

/** Cartel de entorno: lo fija el build (`VITE_ENV_LABEL`); sin él, producción. */
export const envLabel = (): string => import.meta.env.VITE_ENV_LABEL || 'producción'
