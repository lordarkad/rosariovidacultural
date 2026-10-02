import type { IngestEvent, IngestPlace } from '@tript/shared'
import { normalizeText } from '../../domain/normalize'
import type {
  EventPlan,
  EventRecord,
  EventState,
  PlacePlan,
  PlaceRecord,
  PlaceState,
  SourceEntry,
} from '../../ingest/types'

/**
 * Catálogo en memoria que imita lo que hace D1 al aplicar un plan, en el mismo orden de
 * sentencias que `run-ingest`. Permite probar los planificadores por rondas de lotes.
 */
export class FakeCatalog {
  places = new Map<string, PlaceRecord & { last_seen_at: string }>()
  placeKeys = new Map<string, string>()
  placeRedirects = new Map<string, string>()
  events = new Map<string, Omit<EventRecord, 'sources'> & { last_seen_at: string }>()
  eventSources = new Map<string, SourceEntry & { event_id: string }>()
  eventRedirects = new Map<string, string>()
  private placeSeq = 0
  private eventSeq = 0
  private arrival = 0

  placeState(items: IngestPlace[], extraKeys: string[] = []): PlaceState {
    const names = new Set(items.map((i) => normalizeText(i.name)))
    const byKey = new Map<string, PlaceRecord>()
    for (const key of [...items.map((i) => i.source_key), ...extraKeys]) {
      const id = this.placeKeys.get(key)
      if (id) byKey.set(key, this.strip(this.places.get(id)!))
    }
    const nearby = [...this.places.values()]
      .filter((p) => names.has(p.fields.name_norm))
      .map((p) => this.strip(p))
    return { byKey, nearby, maxSeq: this.placeSeq }
  }

  applyPlaces(plan: PlacePlan, now: string): void {
    for (const r of plan.repoint) {
      for (const [k, id] of this.placeKeys) if (id === r.from) this.placeKeys.set(k, r.to)
      for (const [o, id] of this.placeRedirects) if (id === r.from) this.placeRedirects.set(o, r.to)
    }
    for (const id of plan.deletes) this.places.delete(id)
    for (const u of [...plan.upserts].sort((a, b) => a.seq - b.seq)) {
      const prev = this.places.get(u.id)
      this.places.set(u.id, {
        ...u,
        seq: prev ? prev.seq : ++this.placeSeq,
        created_at: prev ? prev.created_at : u.created_at,
        persisted: true,
      })
    }
    for (const id of plan.touched) this.places.get(id)!.last_seen_at = now
    for (const k of plan.keys) this.placeKeys.set(k.source_key, k.place_id)
    for (const r of plan.redirects) this.placeRedirects.set(r.old_id, r.place_id)
  }

  /** Id vigente de un lugar (sigue redirects). */
  placeIdOf(sourceKey: string): string | undefined {
    const id = this.placeKeys.get(sourceKey)
    return id && (this.placeRedirects.get(id) ?? id)
  }

  eventState(items: IngestEvent[]): EventState {
    const wanted = new Set(items.map((i) => `${normalizeText(i.title)}|${i.start_date}`))
    const byKey = new Map<string, EventRecord>()
    for (const i of items) {
      const s = this.eventSources.get(i.source_key)
      if (s) byKey.set(i.source_key, this.record(s.event_id))
    }
    const candidates = [...this.events.values()]
      .filter((e) => wanted.has(`${e.fields.title_norm}|${e.fields.start_date}`))
      .map((e) => this.record(e.id))
    return { byKey, candidates, maxSeq: this.eventSeq, maxArrival: this.arrival }
  }

  applyEvents(plan: EventPlan, now: string): void {
    for (const r of plan.repoint) {
      for (const s of this.eventSources.values()) if (s.event_id === r.from) s.event_id = r.to
      for (const [o, id] of this.eventRedirects) if (id === r.from) this.eventRedirects.set(o, r.to)
    }
    for (const id of plan.deletes) this.events.delete(id)
    for (const u of [...plan.upserts].sort((a, b) => a.seq - b.seq)) {
      const prev = this.events.get(u.id)
      const { sources: _s, ...rest } = u
      this.events.set(u.id, {
        ...rest,
        seq: prev ? prev.seq : ++this.eventSeq,
        created_at: prev ? prev.created_at : u.created_at,
        persisted: true,
      })
    }
    for (const id of plan.touched) this.events.get(id)!.last_seen_at = now
    for (const s of [...plan.sources].sort((a, b) => a.arrival - b.arrival)) {
      const prev = this.eventSources.get(s.source_key)
      this.eventSources.set(s.source_key, {
        ...s,
        dirty: undefined,
        arrival: prev ? prev.arrival : ++this.arrival,
      })
    }
    for (const r of plan.redirects) this.eventRedirects.set(r.old_id, r.event_id)
  }

  eventIdOf(sourceKey: string): string | undefined {
    const id = this.eventSources.get(sourceKey)?.event_id
    return id && (this.eventRedirects.get(id) ?? id)
  }

  private strip(p: PlaceRecord & { last_seen_at?: string }): PlaceRecord {
    const { last_seen_at: _l, ...rest } = p
    return { ...rest, persisted: true }
  }

  private record(id: string): EventRecord {
    const e = this.events.get(id)!
    const { last_seen_at: _l, ...rest } = e
    const sources = [...this.eventSources.values()]
      .filter((s) => s.event_id === id)
      .map(({ event_id: _e, ...s }) => s)
    return { ...rest, persisted: true, sources }
  }
}
