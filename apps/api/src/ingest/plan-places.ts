import type { IngestPlace } from '@tript/shared'
import { haversineM } from '../domain/geo'
import { normalizeText } from '../domain/normalize'
import type { PlaceFields, PlacePlan, PlaceRecord, PlaceState, PlaceWrite } from './types'

/** Distancia máxima para considerar equivalentes a un lugar curado y uno `osm` con el mismo nombre. */
export const SAME_PLACE_RADIUS_M = 50

export function toPlaceFields(item: IngestPlace): PlaceFields {
  return {
    name: item.name,
    name_norm: normalizeText(item.name),
    kind: item.kind,
    origin: item.origin,
    intents: item.intents,
    offers: item.offers ?? [],
    cuisine: item.cuisine ?? [],
    address: item.address ?? null,
    address_norm: item.address ? normalizeText(item.address) : null,
    lat: item.lat,
    lon: item.lon,
    opening_hours: item.opening_hours ?? null,
    hours_text: item.hours_text ?? null,
    phone: item.phone ?? null,
    website: item.website ?? null,
    instagram: item.instagram ?? null,
    outdoor: item.outdoor ?? null,
    note: item.note ?? null,
    image_url: item.image_url ?? null,
  }
}

interface Work extends PlaceRecord {
  dirty: boolean
  touched: boolean
  absorbedInto: string | null
}

const near = (a: PlaceFields, b: PlaceFields): boolean =>
  a.name_norm === b.name_norm &&
  haversineM(a.lat, a.lon, b.lat, b.lon) <= SAME_PLACE_RADIUS_M

/**
 * Planifica el upsert de lugares de un lote (AC-29..39, F-11, F-12). Función pura: no toca D1.
 * Procesa en orden de índice y los ítems ya procesados cuentan como filas existentes.
 */
export function planPlaces(
  items: IngestPlace[],
  state: PlaceState,
  ctx: { now: string; newId: () => string },
): PlacePlan {
  const work = new Map<string, Work>()
  const keyToId = new Map<string, string>()
  const adopt = (r: PlaceRecord): Work => {
    let w = work.get(r.id)
    if (!w) {
      w = { ...r, fields: { ...r.fields }, dirty: false, touched: false, absorbedInto: null }
      work.set(r.id, w)
    }
    return w
  }
  for (const [key, rec] of state.byKey) keyToId.set(key, adopt(rec).id)
  for (const rec of state.nearby) adopt(rec)

  let nextSeq = state.maxSeq
  const newKeys = new Set<string>()
  let created = 0
  let updated = 0

  const live = (id: string): Work => {
    let w = work.get(id)!
    while (w.absorbedInto) w = work.get(w.absorbedInto)!
    return w
  }
  const candidates = (fields: PlaceFields, origin: 'curated' | 'osm'): Work[] =>
    [...work.values()]
      .filter((w) => !w.absorbedInto && w.fields.origin === origin && near(w.fields, fields))
      .sort((a, b) => a.seq - b.seq)

  for (const item of items) {
    const key = item.source_key
    const fields = toPlaceFields(item)
    const knownId = keyToId.get(key)

    if (knownId) {
      const w = live(knownId)
      if (w.source_key === key) {
        w.fields = fields
        w.dirty = true
      } else {
        w.touched = true // alias: solo last_seen_at, nunca pisa los campos del curado (E-10)
      }
      updated++
      continue
    }

    if (item.origin === 'curated') {
      const [survivor, ...rest] = candidates(fields, 'osm')
      if (survivor) {
        for (const other of rest) {
          other.absorbedInto = survivor.id
          for (const [k, id] of keyToId) if (id === other.id) keyToId.set(k, survivor.id)
        }
        survivor.fields = fields
        survivor.source_key = key
        survivor.dirty = true
        keyToId.set(key, survivor.id)
        newKeys.add(key)
        updated++
        continue
      }
    } else {
      const [survivor] = candidates(fields, 'curated')
      if (survivor) {
        survivor.touched = true
        keyToId.set(key, survivor.id)
        newKeys.add(key)
        updated++
        continue
      }
    }

    const w: Work = {
      seq: ++nextSeq,
      id: ctx.newId(),
      source_key: key,
      persisted: false,
      created_at: ctx.now,
      fields,
      dirty: true,
      touched: false,
      absorbedInto: null,
    }
    work.set(w.id, w)
    keyToId.set(key, w.id)
    newKeys.add(key)
    created++
  }

  const upserts: PlaceWrite[] = []
  const touched: string[] = []
  const repoint: PlacePlan['repoint'] = []
  const redirects: PlacePlan['redirects'] = []
  const deletes: string[] = []
  for (const w of work.values()) {
    if (w.absorbedInto) {
      if (w.persisted) {
        const to = live(w.id).id
        repoint.push({ from: w.id, to })
        redirects.push({ old_id: w.id, place_id: to })
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
  }
  upserts.sort((a, b) => a.seq - b.seq)

  const keys: PlacePlan['keys'] = []
  for (const [key, id] of keyToId) {
    const finalId = live(id).id
    if (newKeys.has(key) || state.byKey.get(key)?.id !== finalId) {
      keys.push({ source_key: key, place_id: finalId })
    }
  }

  return {
    created,
    updated,
    upserts,
    touched,
    keys,
    repoint,
    redirects,
    deletes,
    resolve: (sourceKey) => {
      const id = keyToId.get(sourceKey)
      if (!id) return null
      const w = live(id)
      return { id: w.id, name_norm: w.fields.name_norm }
    },
  }
}
