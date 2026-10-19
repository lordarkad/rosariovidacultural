import type {
  CurationEvent,
  CurationPlace,
  EventDetail,
  EventMissingField,
  EventSourceCount,
  EventState,
  Intent,
  MusicGenre,
  PlaceDetail,
  PlaceKind,
  PlaceMissingField,
  PlaceOrigin,
  SearchItem,
  SearchPin,
  Zone,
} from '@tript/shared'

export type Cuando = 'ahora' | 'hoy' | 'manana' | 'finde' | 'fecha'

/** Parámetros de `/search` y `/search/pins` (docs/api-spec.yml). */
export interface SearchQuery {
  i?: Intent[]
  musica?: MusicGenre[]
  gratis?: boolean
  cuando?: Cuando
  /** `YYYY-MM-DD`; solo con `cuando=fecha`. */
  fecha?: string
  /** Id de zona; excluyente con `lat`/`lon`. */
  z?: string
  lat?: number
  lon?: number
  radio_m?: number
  q?: string
}

export interface SearchPage {
  items: SearchItem[]
  total: number
  page: number
  perPage: number
}

export interface PinsResult {
  pins: SearchPin[]
  total: number
  /** Hay más de 100 pins: acotar con `bbox` (D-7). */
  truncated: boolean
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  signal?: AbortSignal
}

const baseUrl = (): string => (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

/** Serializa el query: omite vacíos y undefined, listas separadas por coma. */
export function toQueryString(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) qs.set(key, value.join(','))
      continue
    }
    qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

interface Envelope {
  success?: boolean
  data?: unknown
  error?: unknown
}

/** Cuerpo vacío o que no es JSON → `null`; el error se informa con el status. */
async function readEnvelope(res: Response): Promise<Envelope | null> {
  try {
    return (await res.json()) as Envelope
  } catch {
    return null
  }
}

async function getEnvelope<T>(
  path: string,
  { signal }: RequestOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(`${baseUrl()}${path}`, { signal, headers: { Accept: 'application/json' } })

  const body = await readEnvelope(res)

  if (!res.ok || !body || body.success !== true) {
    const message = typeof body?.error === 'string' ? body.error : `Error ${res.status}`
    throw new ApiError(res.status, message)
  }
  // El contrato manda: los valores de enum nuevos no se rechazan acá, los tolera cada formateador (S2).
  return { data: body.data as T, headers: res.headers }
}

const intHeader = (headers: Headers, name: string, fallback: number): number => {
  const n = Number.parseInt(headers.get(name) ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

export async function listZones(opts?: RequestOptions): Promise<Zone[]> {
  return (await getEnvelope<Zone[]>('/zones', opts)).data
}

export async function searchItems(
  query: SearchQuery & { page?: number; per_page?: number },
  opts?: RequestOptions,
): Promise<SearchPage> {
  const { data, headers } = await getEnvelope<SearchItem[]>(`/search${toQueryString(query)}`, opts)
  return {
    items: data,
    total: intHeader(headers, 'X-Total-Count', data.length),
    page: intHeader(headers, 'X-Page', query.page ?? 1),
    perPage: intHeader(headers, 'X-Per-Page', query.per_page ?? 20),
  }
}

export async function searchPins(
  query: SearchQuery & { bbox?: string },
  opts?: RequestOptions,
): Promise<PinsResult> {
  const { data, headers } = await getEnvelope<SearchPin[]>(`/search/pins${toQueryString(query)}`, opts)
  return {
    pins: data,
    total: intHeader(headers, 'X-Total-Count', data.length),
    truncated: headers.get('X-Truncated') === 'true',
  }
}

/** `origin` (lat+lon) calcula la distancia; si falta alguno de los dos no se envía ninguno (E-11). */
export async function getEvent(
  id: string,
  origin?: { lat?: number; lon?: number } | null,
  opts?: RequestOptions,
): Promise<EventDetail> {
  const hasOrigin = origin?.lat !== undefined && origin.lon !== undefined
  const qs = hasOrigin ? toQueryString({ lat: origin.lat, lon: origin.lon }) : ''
  return (await getEnvelope<EventDetail>(`/events/${encodeURIComponent(id)}${qs}`, opts)).data
}

/** Igual que `getEvent`: sin el par completo `lat`/`lon` no se envía ninguno y no hay distancia (L-2). */
export async function getPlace(
  id: string,
  origin?: { lat?: number; lon?: number } | null,
  opts?: RequestOptions,
): Promise<PlaceDetail> {
  const hasOrigin = origin?.lat !== undefined && origin.lon !== undefined
  const qs = hasOrigin ? toQueryString({ lat: origin.lat, lon: origin.lon }) : ''
  return (await getEnvelope<PlaceDetail>(`/places/${encodeURIComponent(id)}${qs}`, opts)).data
}

/** Parámetros de `/events` (listEvents). */
export interface CurationEventsQuery {
  q?: string
  fuente?: string[]
  estado?: EventState[]
  faltan?: EventMissingField[]
  page?: number
  per_page?: number
}

/** Parámetros de `/places` (listPlaces). */
export interface CurationPlacesQuery {
  q?: string
  origen?: PlaceOrigin[]
  tipo?: PlaceKind[]
  faltan?: PlaceMissingField[]
  page?: number
  per_page?: number
}

export interface ListPage<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

async function getList<T>(path: string, query: { page?: number; per_page?: number }, opts?: RequestOptions): Promise<ListPage<T>> {
  const { data, headers } = await getEnvelope<T[]>(`${path}${toQueryString(query)}`, opts)
  return {
    items: data,
    total: intHeader(headers, 'X-Total-Count', data.length),
    page: intHeader(headers, 'X-Page', query.page ?? 1),
    perPage: intHeader(headers, 'X-Per-Page', query.per_page ?? 50),
  }
}

export const listEvents = (query: CurationEventsQuery, opts?: RequestOptions): Promise<ListPage<CurationEvent>> =>
  getList<CurationEvent>('/events', query, opts)

export const listPlaces = (query: CurationPlacesQuery, opts?: RequestOptions): Promise<ListPage<CurationPlace>> =>
  getList<CurationPlace>('/places', query, opts)

export async function listEventSources(opts?: RequestOptions): Promise<EventSourceCount[]> {
  return (await getEnvelope<EventSourceCount[]>('/events/sources', opts)).data
}
