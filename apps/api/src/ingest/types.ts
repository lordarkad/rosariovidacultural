import type { Intent, MusicGenre, PlaceKind, SourceLink, SourceTier } from '@tript/shared'
import type { OpeningPeriod } from '../domain/opening-hours'

export interface BatchSource {
  name: string
  tier: SourceTier
}

export interface Counts {
  received: number
  created: number
  updated: number
  rejected: number
}

export interface Rejection {
  kind: 'event' | 'place'
  index: number
  source_key: string | null
  reason: string
}

/** Campos de un lugar tal como se guardan (los omitidos por la fuente quedan en null o vacío). */
export interface PlaceFields {
  name: string
  name_norm: string
  kind: PlaceKind
  origin: 'curated' | 'osm'
  intents: Intent[]
  offers: string[]
  cuisine: string[]
  address: string | null
  address_norm: string | null
  lat: number
  lon: number
  opening_hours: OpeningPeriod[] | null
  hours_text: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  outdoor: boolean | null
  note: string | null
  image_url: string | null
}

export interface PlaceRecord {
  /** Orden de inserción: decide qué fila sobrevive a una fusión (no el id ni el reloj). */
  seq: number
  id: string
  /** Clave canónica de la fila (la del curado tras una fusión). */
  source_key: string
  persisted: boolean
  created_at: string
  fields: PlaceFields
}

export interface PlaceState {
  /** Cualquier clave conocida (canónica o alias) → fila. */
  byKey: Map<string, PlaceRecord>
  /** Filas con el mismo nombre normalizado que algún lugar del lote (candidatas a fusión). */
  nearby: PlaceRecord[]
  maxSeq: number
}

export interface PlaceWrite extends PlaceRecord {
  last_seen_at: string
}

export interface PlacePlan {
  created: number
  updated: number
  upserts: PlaceWrite[]
  /** Filas que solo actualizan `last_seen_at` (alias reenviados o `osm` que pasan a alias). */
  touched: string[]
  keys: Array<{ source_key: string; place_id: string }>
  /** Ids persistidos absorbidos: sus claves y redirects previos pasan al sobreviviente. */
  repoint: Array<{ from: string; to: string }>
  redirects: Array<{ old_id: string; place_id: string }>
  deletes: string[]
  /** Lugar vigente de una clave (para vincular eventos del mismo lote). */
  resolve: (sourceKey: string) => { id: string; name_norm: string } | null
}

export interface EventFields {
  title: string
  title_norm: string
  description: string | null
  intents: Intent[]
  music_genres: MusicGenre[]
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
}

export interface SourceEntry {
  source_key: string
  /** Orden de llegada: desempata la fuente primaria a igual `tier`. */
  arrival: number
  name: string
  tier: SourceTier
  url: string
  via: SourceLink[]
  /** Hay que escribir esta entrada en `event_sources`. */
  dirty?: boolean
}

export interface EventRecord {
  seq: number
  id: string
  persisted: boolean
  created_at: string
  /** Clave de la fuente primaria; solo esa actualiza los campos. */
  canonical: string
  fields: EventFields
  sources: SourceEntry[]
}

export interface EventState {
  byKey: Map<string, EventRecord>
  /** Filas con el mismo título normalizado y fecha de inicio que algún evento del lote. */
  candidates: EventRecord[]
  maxSeq: number
  maxArrival: number
}

export interface ResolvedPlace {
  id: string
  name_norm: string
}

export interface EventWrite extends EventRecord {
  last_seen_at: string
}

export interface EventPlan {
  created: number
  updated: number
  upserts: EventWrite[]
  touched: string[]
  sources: Array<SourceEntry & { event_id: string }>
  repoint: Array<{ from: string; to: string }>
  redirects: Array<{ old_id: string; event_id: string }>
  deletes: string[]
}
