import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { IngestResultSchema } from '@tript/shared'
import { countingDb } from './helpers/counting-d1'
import { event, ingest, place, T0, truncateCatalog } from './helpers/seed'

const count = async (table: string) =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n

beforeEach(() => truncateCatalog())

describe('POST /api/ingest', () => {
  it('[AC-29] lote válido: created 2 eventos y 1 lugar, sin rechazos, last_seen_at = ahora', async () => {
    const { res, json } = await ingest({
      events: [{ source_key: 'f:e1' }, { source_key: 'f:e2', venue_name: 'Otra' }],
      places: [{ source_key: 'f:p1' }],
    })
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(IngestResultSchema.safeParse(json.data).success).toBe(true)
    expect(json.data).toEqual({
      events: { received: 2, created: 2, updated: 0, rejected: 0 },
      places: { received: 1, created: 1, updated: 0, rejected: 0 },
      rejected: [],
    })
    const seen = await env.DB.prepare('SELECT last_seen_at FROM events UNION ALL SELECT last_seen_at FROM places').all<{ last_seen_at: string }>()
    expect(seen.results).toHaveLength(3)
    for (const r of seen.results) expect(r.last_seen_at).toBe(T0.toISOString())
  })

  it('[AC-30] reenviar el mismo lote: created 0, updated igual al total, sin filas duplicadas', async () => {
    const batch = {
      events: [{ source_key: 'f:e1' }, { source_key: 'f:e2', venue_name: 'Otra' }],
      places: [{ source_key: 'f:p1' }],
    }
    await ingest(batch)
    const { json } = await ingest(batch)
    expect(json.data.events).toMatchObject({ created: 0, updated: 2 })
    expect(json.data.places).toMatchObject({ created: 0, updated: 1 })
    expect(await count('events')).toBe(2)
    expect(await count('places')).toBe(1)
    expect(await count('event_sources')).toBe(2)
    expect(await count('place_keys')).toBe(1)
  })

  it('[AC-33] 200 eventos y 200 lugares: se guardan los 400 con a lo sumo 10 llamadas a D1', async () => {
    const places = Array.from({ length: 200 }, (_, i) => ({
      source_key: `osm:${i}`,
      origin: 'osm' as const,
      name: `Lugar número ${i}`,
      lat: -32.9 - i * 0.001,
    }))
    const events = Array.from({ length: 200 }, (_, i) => ({
      source_key: `f:${i}`,
      title: `Evento número ${i}`,
      venue_name: `Sede ${i}`,
      place_source_key: `osm:${i}`,
    }))
    const { db, stats } = countingDb(env.DB)
    const { res, json } = await ingest({ events, places }, T0, db)
    expect(res.status).toBe(200)
    expect(json.data.events).toMatchObject({ received: 200, created: 200, rejected: 0 })
    expect(json.data.places).toMatchObject({ received: 200, created: 200, rejected: 0 })
    expect(await count('events')).toBe(200)
    expect(await count('places')).toBe(200)
    expect(stats.calls).toBeLessThanOrEqual(10)
    // el tope no depende del tamaño: con un solo ítem hace las mismas llamadas
    await truncateCatalog()
    const one = countingDb(env.DB)
    await ingest({ events: [{ source_key: 'f:solo' }], places: [{ source_key: 'p:solo' }] }, T0, one.db)
    expect(one.stats.calls).toBe(stats.calls)
    // y las sentencias de un batch son pocas y fijas, no una por ítem
    expect(Math.max(...stats.batchSizes)).toBeLessThanOrEqual(15)
  })

  describe('[AC-34] ítem inválido y clave repetida (F-1)', () => {
    it('start_date mal formada: se rechaza ese ítem y se guardan los otros', async () => {
      const { res, json } = await ingest({
        events: [{ source_key: 'f:1' }, { source_key: 'f:2', start_date: 'mañana' }, { source_key: 'f:3', venue_name: 'Otra' }],
      })
      expect(res.status).toBe(200)
      expect(json.data.events).toEqual({ received: 3, created: 2, updated: 0, rejected: 1 })
      expect(json.data.rejected[0]).toMatchObject({ kind: 'event', index: 1, source_key: 'f:2' })
      expect(typeof json.data.rejected[0].reason).toBe('string')
      expect(await count('events')).toBe(2)
    })

    it('source_key repetido en el lote: se guarda el primero y el repetido es duplicate_source_key', async () => {
      const { json } = await ingest({ events: [{ source_key: 'f:1' }, { source_key: 'f:1', title: 'Repetido' }] })
      expect(json.data.events).toMatchObject({ created: 1, rejected: 1 })
      expect(json.data.rejected[0]).toMatchObject({ index: 1, source_key: 'f:1', reason: 'duplicate_source_key' })
    })

    it('end_date anterior a start_date: invalid_date_range', async () => {
      const { json } = await ingest({ events: [{ source_key: 'f:1', start_date: '2026-10-10', end_date: '2026-10-09' }] })
      expect(json.data.rejected[0].reason).toBe('invalid_date_range')
    })

    it('lugar con opening_hours []: invalid_opening_hours', async () => {
      const { json } = await ingest({ places: [{ source_key: 'p:1', opening_hours: [] }] })
      expect(json.data.rejected[0]).toMatchObject({ kind: 'place', reason: 'invalid_opening_hours' })
      expect(await count('places')).toBe(0)
    })
  })

  it('[AC-35] solo upsert: un lote de la misma fuente sin el evento A no lo borra ni toca su last_seen_at', async () => {
    await ingest({ events: [{ source_key: 'x:a' }] })
    const later = new Date(T0.getTime() + 24 * 3_600_000)
    await ingest({ events: [{ source_key: 'x:b', title: 'Otro', venue_name: 'Otra' }] }, later)
    const rows = await env.DB.prepare('SELECT source_key, last_seen_at FROM events ORDER BY source_key').all<{ source_key: string; last_seen_at: string }>()
    expect(rows.results).toEqual([
      { source_key: 'x:a', last_seen_at: T0.toISOString() },
      { source_key: 'x:b', last_seen_at: later.toISOString() },
    ])
  })

  describe('persistencia de fusiones (SQL real)', () => {
    it('[AC-38] curado absorbe a un osm: una fila, claves y redirects en D1', async () => {
      await ingest({ places: [{ source_key: 'osm:n1', origin: 'osm', name: 'La Esquina' }] })
      await ingest({ places: [{ source_key: 'osm:w1', origin: 'osm', name: 'La Esquina' }] })
      const ids = (await env.DB.prepare('SELECT id FROM places ORDER BY seq').all<{ id: string }>()).results.map((r) => r.id)
      expect(ids).toHaveLength(2)
      const { json } = await ingest({ places: [{ source_key: 'cur:1', origin: 'curated', name: 'La Esquina', phone: '123' }] })
      expect(json.data.places).toMatchObject({ created: 0, updated: 1 })
      const rows = await env.DB.prepare('SELECT id, source_key, origin, phone FROM places').all<any>()
      expect(rows.results).toEqual([{ id: ids[0], source_key: 'cur:1', origin: 'curated', phone: '123' }])
      const keys = await env.DB.prepare('SELECT source_key, place_id FROM place_keys ORDER BY source_key').all<any>()
      expect(keys.results).toEqual([
        { source_key: 'cur:1', place_id: ids[0] },
        { source_key: 'osm:n1', place_id: ids[0] },
        { source_key: 'osm:w1', place_id: ids[0] },
      ])
      const red = await env.DB.prepare('SELECT old_id, place_id FROM place_id_redirects').all<any>()
      expect(red.results).toEqual([{ old_id: ids[1], place_id: ids[0] }])
    })

    it('[AC-36] agregador y curado con la misma sede: una fila con la fuente curada como primaria', async () => {
      await ingest({ source: { name: 'Agregador', tier: 'aggregator' }, events: [{ source_key: 'agg:1', title: 'Show', description: 'agg' }] })
      const { json } = await ingest({ source: { name: 'Curado', tier: 'curated' }, events: [{ source_key: 'cur:1', title: 'Show', description: 'cur' }] })
      expect(json.data.events).toMatchObject({ created: 0, updated: 1 })
      const rows = await env.DB.prepare('SELECT source_key, source_name, source_tier, description FROM events').all<any>()
      expect(rows.results).toEqual([{ source_key: 'cur:1', source_name: 'Curado', source_tier: 'curated', description: 'cur' }])
      expect(await count('event_sources')).toBe(2)
    })

    it('[AC-36] fusión de dos eventos existentes: el absorbido deja redirect y sus fuentes pasan al sobreviviente', async () => {
      await ingest({ events: [{ source_key: 's:1', title: 'Show', venue_name: 'Sala A' }] })
      await ingest({ events: [{ source_key: 's:2', title: 'Show', venue_name: 'Sala B', address: 'Calle 1 200' }] })
      const ids = (await env.DB.prepare('SELECT id FROM events ORDER BY seq').all<{ id: string }>()).results.map((r) => r.id)
      await ingest({ events: [{ source_key: 's:3', title: 'Show', venue_name: 'Sala A', address: 'Calle 1 200' }] })
      expect(await count('events')).toBe(1)
      const src = await env.DB.prepare('SELECT source_key, event_id FROM event_sources ORDER BY source_key').all<any>()
      expect(src.results.every((r: any) => r.event_id === ids[0])).toBe(true)
      expect(src.results).toHaveLength(3)
      const red = await env.DB.prepare('SELECT old_id, event_id FROM event_id_redirects').all<any>()
      expect(red.results).toEqual([{ old_id: ids[1], event_id: ids[0] }])
    })

    it('[AC-39] el evento guarda place_source_key aunque el lugar llegue en un lote posterior', async () => {
      await ingest({ events: [{ source_key: 'e:1', place_source_key: 'osm:futuro' }] })
      const e = await env.DB.prepare('SELECT place_source_key FROM events').first<{ place_source_key: string }>()
      expect(e!.place_source_key).toBe('osm:futuro')
      await ingest({ places: [{ source_key: 'osm:futuro', origin: 'osm' }] })
      const k = await env.DB.prepare(
        'SELECT p.id FROM events e JOIN place_keys k ON k.source_key = e.place_source_key JOIN places p ON p.id = k.place_id',
      ).all()
      expect(k.results).toHaveLength(1)
    })

    it('un evento sin coordenadas con lugar vinculado deja lat/lon nulos en la fila (se heredan al leer)', async () => {
      await ingest({
        places: [{ source_key: 'p:1', name: 'Sala' }],
        events: [{ source_key: 'e:1', place_source_key: 'p:1', lat: null, lon: null }],
      })
      const e = await env.DB.prepare('SELECT lat, lon FROM events').first<any>()
      expect(e).toEqual({ lat: null, lon: null })
    })
  })
})
