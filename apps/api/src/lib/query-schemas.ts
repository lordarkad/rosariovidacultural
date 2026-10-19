import {
  EventMissingFieldSchema,
  EventStateSchema,
  IntentSchema,
  MusicGenreSchema,
  PlaceKindSchema,
  PlaceMissingFieldSchema,
  PlaceOriginSchema,
} from '@tript/shared'
import type { Intent, MusicGenre } from '@tript/shared'
import { z } from 'zod'
import { parseBbox, type Bbox } from '../domain/geo'
import type { Cuando } from '../domain/windows'

/** Radio por defecto y límites de `radio_m` (spec `RadioM`). */
const RADIO_DEFAULT = 2000
const RADIO_MIN = 500
const RADIO_MAX = 10000

const csv = <T extends z.ZodTypeAny>(item: T, max?: number) =>
  z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.length > 0),
    )
    .pipe(max === undefined ? z.array(item) : z.array(item).max(max))
    .optional()

const decimal = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'debe ser un número')
  .transform(Number)
const int = z
  .string()
  .regex(/^\d+$/, 'debe ser un entero')
  .transform(Number)

export interface SearchQuery {
  intents: Intent[]
  musica: MusicGenre[]
  gratis: boolean
  cuando: Cuando
  fecha: string | undefined
  zone: string | undefined
  lat: number | undefined
  lon: number | undefined
  radio_m: number
  q: string | null
  page: number
  per_page: number
  bbox: Bbox | null
}

/**
 * Query params de `searchItems` y `searchPins` (spec: parámetros `Intents`, `MusicGenres`, `Gratis`, `Cuando`,
 * `Fecha`, `Zona`, `Lat`, `Lon`, `RadioM`, `TextoLibre`, `page`, `per_page`, `bbox`).
 * Reglas cruzadas: `z` excluye a `lat`/`lon`; `lat` y `lon` van juntos; `fecha` solo se valida con
 * `cuando=fecha`; `radio_m` solo se valida sin `z` (E-8).
 */
export const SearchQuerySchema = z
  .object({
    i: csv(IntentSchema),
    musica: csv(MusicGenreSchema),
    gratis: z.enum(['true', 'false']).optional(),
    cuando: z.enum(['ahora', 'hoy', 'manana', 'finde', 'fecha']).optional(),
    fecha: z.string().optional(),
    z: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'formato de zona inválido')
      .optional(),
    lat: decimal.pipe(z.number().min(-90).max(90)).optional(),
    lon: decimal.pipe(z.number().min(-180).max(180)).optional(),
    radio_m: z.string().optional(),
    q: z.string().max(100, 'q admite hasta 100 caracteres').optional(),
    page: int.pipe(z.number().int().min(1)).optional(),
    per_page: int.pipe(z.number().int().min(1).max(100)).optional(),
    bbox: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (message: string, path: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] })
    if (v.z !== undefined && (v.lat !== undefined || v.lon !== undefined)) {
      issue('z y lat/lon son excluyentes', 'z')
    }
    if ((v.lat === undefined) !== (v.lon === undefined)) issue('lat y lon van juntos', 'lat')
    if (v.cuando === 'fecha' && !z.string().date().safeParse(v.fecha).success) {
      issue('cuando=fecha exige fecha con formato YYYY-MM-DD', 'fecha')
    }
    if (v.z === undefined && v.radio_m !== undefined) {
      const n = /^\d+$/.test(v.radio_m) ? Number(v.radio_m) : NaN
      if (!(n >= RADIO_MIN && n <= RADIO_MAX)) {
        issue(`radio_m debe ser un entero entre ${RADIO_MIN} y ${RADIO_MAX}`, 'radio_m')
      }
    }
    if (v.bbox !== undefined) {
      try {
        parseBbox(v.bbox)
      } catch (e) {
        issue(e instanceof Error ? e.message : 'bbox inválido', 'bbox')
      }
    }
  })
  .transform(
    (v): SearchQuery => ({
      intents: v.i ?? [],
      musica: v.musica ?? [],
      gratis: v.gratis === 'true',
      cuando: v.cuando ?? 'hoy',
      fecha: v.cuando === 'fecha' ? v.fecha : undefined,
      zone: v.z,
      lat: v.lat,
      lon: v.lon,
      radio_m: v.z === undefined && v.radio_m !== undefined ? Number(v.radio_m) : RADIO_DEFAULT,
      q: v.q ? v.q : null,
      page: v.page ?? 1,
      per_page: v.per_page ?? 20,
      bbox: v.bbox !== undefined ? parseBbox(v.bbox) : null,
    }),
  )

/** `lat`/`lon` opcionales de los detalles (E-11: pueden ser las del pin o la zona). Van juntos. */
export const DetailQuerySchema = z
  .object({
    lat: decimal.pipe(z.number().min(-90).max(90)).optional(),
    lon: decimal.pipe(z.number().min(-180).max(180)).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lon === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'lat y lon van juntos', path: ['lat'] })
    }
  })

export const IdParamSchema = z.object({ id: z.string().uuid('id debe ser un UUID') })

/** Paginación del listado de curación (spec `CurationPage`/`CurationPerPage`). */
const CURATION_PAGE_MAX = 10000
const curationPage = {
  page: int.pipe(z.number().int().min(1).max(CURATION_PAGE_MAX)).optional(),
  per_page: int.pipe(z.number().int().min(1).max(100)).optional(),
}

export interface CurationEventsQuery {
  q: string | null
  fuente: string[]
  estado: z.infer<typeof EventStateSchema>[]
  faltan: z.infer<typeof EventMissingFieldSchema>[]
  page: number
  per_page: number
}

/** Query params de `listEvents`. Los filtros vacíos (`estado=`) equivalen a no filtrar. */
export const CurationEventsQuerySchema = z
  .object({
    q: z.string().max(100, 'q admite hasta 100 caracteres').optional(),
    fuente: csv(z.string().max(100), 20),
    estado: csv(EventStateSchema),
    faltan: csv(EventMissingFieldSchema),
    ...curationPage,
  })
  .transform(
    (v): CurationEventsQuery => ({
      q: v.q ? v.q : null,
      fuente: v.fuente ?? [],
      estado: v.estado ?? [],
      faltan: v.faltan ?? [],
      page: v.page ?? 1,
      per_page: v.per_page ?? 50,
    }),
  )

export interface CurationPlacesQuery {
  q: string | null
  origen: z.infer<typeof PlaceOriginSchema>[]
  tipo: z.infer<typeof PlaceKindSchema>[]
  faltan: z.infer<typeof PlaceMissingFieldSchema>[]
  page: number
  per_page: number
}

/** Query params de `listPlaces`. */
export const CurationPlacesQuerySchema = z
  .object({
    q: z.string().max(100, 'q admite hasta 100 caracteres').optional(),
    origen: csv(PlaceOriginSchema),
    tipo: csv(PlaceKindSchema),
    faltan: csv(PlaceMissingFieldSchema),
    ...curationPage,
  })
  .transform(
    (v): CurationPlacesQuery => ({
      q: v.q ? v.q : null,
      origen: v.origen ?? [],
      tipo: v.tipo ?? [],
      faltan: v.faltan ?? [],
      page: v.page ?? 1,
      per_page: v.per_page ?? 50,
    }),
  )
