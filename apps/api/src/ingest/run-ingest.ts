import type { D1Database } from '@cloudflare/workers-types'
import type { IngestBatch, IngestResult } from '@tript/shared'
import { planEvents } from './plan-events'
import { planPlaces } from './plan-places'
import { readEventState, readPlaceState } from './read'
import type { Counts } from './types'
import { validateBatchItems } from './validate-items'
import { writeBatch } from './write'

const counts = (received: number, rejected: number, created: number, updated: number): Counts => ({
  received,
  created,
  updated,
  rejected,
})

/**
 * Ingesta de un lote (F-1, F-12, F-15). Leer, planificar en memoria y escribir en un batch atómico:
 * 3 llamadas a D1 por request sea cual sea el tamaño del lote (presupuesto del spec: como máximo 10).
 * Los lugares se procesan antes que los eventos para que el vínculo `place_source_key` resuelva en el mismo lote.
 */
export async function runIngest(db: D1Database, batch: IngestBatch, now: Date): Promise<IngestResult> {
  const nowIso = now.toISOString()
  const ctx = { now: nowIso, newId: () => crypto.randomUUID() }
  const valid = validateBatchItems({ events: batch.events, places: batch.places })
  const events = valid.events.map((v) => v.item)
  const places = valid.places.map((v) => v.item)

  // fase 1: eventos y candidatos; fase 2: lugares de todas las claves que haya que resolver
  const eventState = await readEventState(db, events)
  const extraKeys = [
    ...events.map((e) => e.place_source_key),
    ...eventState.candidates.map((c) => c.fields.place_source_key),
  ].filter((k): k is string => !!k)
  const placeState = await readPlaceState(db, places, extraKeys)

  const placePlan = planPlaces(places, placeState, ctx)
  const eventPlan = planEvents(events, batch.source, eventState, placePlan.resolve, ctx)
  await writeBatch(db, placePlan, eventPlan, nowIso)

  const rejectedBy = (kind: 'event' | 'place') => valid.rejected.filter((r) => r.kind === kind)
  return {
    events: counts(batch.events?.length ?? 0, rejectedBy('event').length, eventPlan.created, eventPlan.updated),
    places: counts(batch.places?.length ?? 0, rejectedBy('place').length, placePlan.created, placePlan.updated),
    rejected: [...rejectedBy('event'), ...rejectedBy('place')],
  }
}
