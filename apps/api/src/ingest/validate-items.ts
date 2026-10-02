import { IngestEventSchema, IngestPlaceSchema } from '@tript/shared'
import type { IngestEvent, IngestPlace } from '@tript/shared'
import type { ZodIssue } from 'zod'
import type { Rejection } from './types'

export interface Validated<T> {
  index: number
  item: T
}

const keyOf = (raw: unknown): string | null => {
  const k = (raw as { source_key?: unknown } | null)?.source_key
  return typeof k === 'string' && k.length > 0 ? k : null
}

const issuePath = (i: ZodIssue): string => i.path.join('.') || '(item)'

/**
 * Valida cada ítem por separado contra su schema, sobre el objeto original (F-1): uno inválido va a
 * `rejected` y no tumba el lote. Rechaza también `source_key` repetido (desde la segunda aparición válida),
 * rangos de fechas invertidos y horarios mal formados.
 */
export function validateBatchItems(body: { events?: unknown[]; places?: unknown[] }): {
  events: Validated<IngestEvent>[]
  places: Validated<IngestPlace>[]
  rejected: Rejection[]
} {
  const rejected: Rejection[] = []
  const reject = (kind: Rejection['kind'], index: number, raw: unknown, reason: string) =>
    rejected.push({ kind, index, source_key: keyOf(raw), reason })

  const events: Validated<IngestEvent>[] = []
  const seenEvents = new Set<string>()
  ;(body.events ?? []).forEach((raw, index) => {
    const parsed = IngestEventSchema.safeParse(raw)
    if (!parsed.success) {
      return reject('event', index, raw, `invalid_item: ${issuePath(parsed.error.issues[0]!)}`)
    }
    const item = parsed.data
    if (item.end_date < item.start_date) return reject('event', index, raw, 'invalid_date_range')
    if (seenEvents.has(item.source_key)) return reject('event', index, raw, 'duplicate_source_key')
    seenEvents.add(item.source_key)
    events.push({ index, item })
  })

  const places: Validated<IngestPlace>[] = []
  const seenPlaces = new Set<string>()
  ;(body.places ?? []).forEach((raw, index) => {
    const parsed = IngestPlaceSchema.safeParse(raw)
    if (!parsed.success) {
      const issues = parsed.error.issues
      const reason = issues.some((i) => i.path[0] === 'opening_hours')
        ? 'invalid_opening_hours'
        : `invalid_item: ${issuePath(issues[0]!)}`
      return reject('place', index, raw, reason)
    }
    const item = parsed.data
    if (seenPlaces.has(item.source_key)) return reject('place', index, raw, 'duplicate_source_key')
    seenPlaces.add(item.source_key)
    places.push({ index, item })
  })

  return { events, places, rejected }
}
