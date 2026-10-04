import type { IngestEvent } from '@tript/shared'
import { normalizeText } from '../domain/normalize'
import { localToInstant } from '../domain/time'
import { isSameSede, pickPrimarySource, sedeOf } from './dedupe'
import type {
  BatchSource,
  EventFields,
  EventPlan,
  EventRecord,
  EventState,
  EventWrite,
  ResolvedPlace,
  SourceEntry,
} from './types'

export function toEventFields(item: IngestEvent): EventFields {
  const hasCoords = typeof item.lat === 'number' && typeof item.lon === 'number'
  return {
    title: item.title,
    title_norm: normalizeText(item.title),
    description: item.description ?? null,
    intents: item.intents,
    music_genres: item.music_genres ?? [],
    start_date: item.start_date,
    end_date: item.end_date,
    start_time: item.start_time ?? null,
    starts_at_utc: item.start_time
      ? localToInstant(item.start_date, item.start_time).toISOString()
      : null,
    date_text: item.date_text ?? null,
    venue_name: item.venue_name ?? null,
    venue_norm: item.venue_name ? normalizeText(item.venue_name) || null : null,
    address: item.address ?? null,
    address_norm: item.address ? normalizeText(item.address) || null : null,
    // coordenadas parciales (solo lat o solo lon) se descartan: un pin necesita las dos
    lat: hasCoords ? item.lat! : null,
    lon: hasCoords ? item.lon! : null,
    place_source_key: item.place_source_key ?? null,
    price_status: item.price_status,
    price_from_ars: item.price_from_ars ?? null,
    image_url: item.image_url ?? null,
  }
}

interface Work extends EventRecord {
  dirty: boolean
  touched: boolean
  absorbedInto: string | null
}

/**
 * Planifica el upsert de eventos de un lote (AC-29..39, E-10, F-11, F-15). Función pura: no toca D1.
 * `resolvePlace` resuelve el `place_source_key` al lugar vigente al momento del dedupe.
 */
export function planEvents(
  items: IngestEvent[],
  source: BatchSource,
  state: EventState,
  resolvePlace: (sourceKey: string) => ResolvedPlace | null,
  ctx: { now: string; newId: () => string },
): EventPlan {
  const work = new Map<string, Work>()
  const keyToId = new Map<string, string>()
  const adopt = (r: EventRecord): Work => {
    let w = work.get(r.id)
    if (!w) {
      w = {
        ...r,
        fields: { ...r.fields },
        sources: r.sources.map((s) => ({ ...s })),
        dirty: false,
        touched: false,
        absorbedInto: null,
      }
      work.set(r.id, w)
      for (const s of w.sources) keyToId.set(s.source_key, w.id)
    }
    return w
  }
  for (const rec of state.byKey.values()) adopt(rec)
  for (const rec of state.candidates) adopt(rec)

  let nextSeq = state.maxSeq
  let arrival = state.maxArrival
  let created = 0
  let updated = 0

  const live = (id: string): Work => {
    let w = work.get(id)!
    while (w.absorbedInto) w = work.get(w.absorbedInto)!
    return w
  }

  for (const item of items) {
    const key = item.source_key
    const fields = toEventFields(item)
    const entryData = { name: source.name, tier: source.tier, url: item.source_url, via: item.via ?? [] }

    const knownId = keyToId.get(key)
    if (knownId) {
      const w = live(knownId)
      const entry = w.sources.find((s) => s.source_key === key)
      if (entry) Object.assign(entry, entryData, { dirty: true })
      if (w.canonical === key) {
        w.fields = fields
        w.dirty = true
      } else {
        w.touched = true // alias: solo last_seen_at y `sources`, nunca los campos de la primaria
      }
      updated++
      continue
    }

    const sede = sedeOf(fields, resolvePlace)
    const matches = [...work.values()]
      .filter(
        (w) =>
          !w.absorbedInto &&
          w.fields.title_norm === fields.title_norm &&
          w.fields.start_date === fields.start_date &&
          isSameSede(sede, sedeOf(w.fields, resolvePlace)),
      )
      .sort((a, b) => a.seq - b.seq)

    const entry: SourceEntry = { source_key: key, arrival: ++arrival, ...entryData, dirty: true }

    if (matches.length === 0) {
      const w: Work = {
        seq: ++nextSeq,
        id: ctx.newId(),
        persisted: false,
        created_at: ctx.now,
        canonical: key,
        fields,
        sources: [entry],
        dirty: true,
        touched: false,
        absorbedInto: null,
      }
      work.set(w.id, w)
      keyToId.set(key, w.id)
      created++
      continue
    }

    // Fusión: todos los candidatos van a la fila insertada primero; la fuente primaria decide los campos
    const [survivor, ...rest] = matches as [Work, ...Work[]]
    const ownerFields = new Map<string, EventFields>(matches.map((m) => [m.canonical, m.fields]))
    ownerFields.set(key, fields)
    for (const other of rest) {
      other.absorbedInto = survivor.id
      survivor.sources.push(...other.sources)
      for (const s of other.sources) keyToId.set(s.source_key, survivor.id)
    }
    survivor.sources.push(entry)
    keyToId.set(key, survivor.id)
    const primary = pickPrimarySource(survivor.sources)
    const owned = ownerFields.get(primary)
    if (owned) {
      survivor.canonical = primary
      survivor.fields = owned
    }
    survivor.dirty = true
    updated++
  }

  const upserts: EventWrite[] = []
  const touched: string[] = []
  const sources: EventPlan['sources'] = []
  const repoint: EventPlan['repoint'] = []
  const redirects: EventPlan['redirects'] = []
  const deletes: string[] = []
  for (const w of work.values()) {
    if (w.absorbedInto) {
      if (w.persisted) {
        const to = live(w.id).id
        repoint.push({ from: w.id, to })
        redirects.push({ old_id: w.id, event_id: to })
        deletes.push(w.id)
      }
      continue
    }
    if (w.dirty) {
      const { dirty: _d, touched: _t, absorbedInto: _a, ...rec } = w
      upserts.push({ ...rec, last_seen_at: ctx.now })
    } else if (w.touched) {
      touched.push(w.id)
    }
    for (const s of w.sources) if (s.dirty) sources.push({ ...s, event_id: w.id })
  }
  upserts.sort((a, b) => a.seq - b.seq)
  sources.sort((a, b) => a.arrival - b.arrival)

  return { created, updated, upserts, touched, sources, repoint, redirects, deletes }
}
