import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { EventDetailSchema, PlaceDetailSchema } from '@tript/shared'
import { get, ingest, T0, truncateCatalog } from './helpers/seed'

beforeEach(() => truncateCatalog())

const HOUR = 3_600_000
const DAY = 24 * HOUR
const UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111'
const idOf = async (table: 'events' | 'places', key: string) =>
  (await env.DB.prepare(`SELECT id FROM ${table} WHERE source_key = ?1`).bind(key).first<{ id: string }>())!.id

describe('GET /api/events/:id', () => {
  it('[AC-24] devuelve todas las claves, sources con la primaria primero, place y is_stale', async () => {
    await ingest({
      source: { name: 'Agenda Municipal', tier: 'official' },
      places: [{ source_key: 'p:sala', name: 'Teatro Mayor', address: 'Corrientes 100' }],
      events: [
        {
          source_key: 'ofi:1',
          title: 'Función',
          place_source_key: 'p:sala',
          source_url: 'https://municipalidad.test/funcion',
          via: [{ name: 'Blog de teatro', url: 'https://blog.test/funcion' }],
          lat: null,
          lon: null,
        },
      ],
    })
    const id = await idOf('events', 'ofi:1')
    const { res, json } = await get(`/api/events/${id}`)
    expect(res.status).toBe(200)
    expect(EventDetailSchema.safeParse(json.data).success, JSON.stringify(json.data)).toBe(true)
    expect(json.data.id).toBe(id)
    expect(json.data.sources[0]).toEqual({ name: 'Agenda Municipal', url: 'https://municipalidad.test/funcion' })
    expect(json.data.sources.map((s: any) => s.url)).toContain('https://blog.test/funcion')
    expect(json.data.place).toMatchObject({ name: 'Teatro Mayor', address: 'Corrientes 100' })
    expect(json.data).toMatchObject({ location_known: true, is_stale: false, lat: -32.94 })
  })

  it('[AC-24] la primaria va primero aunque la otra fuente llegó antes (vía)', async () => {
    await ingest({ source: { name: 'Agregador', tier: 'aggregator' }, events: [{ source_key: 'agg:1', title: 'Show', source_url: 'https://agg.test/s' }] })
    await ingest({ source: { name: 'Curado', tier: 'curated' }, events: [{ source_key: 'cur:1', title: 'Show', source_url: 'https://cur.test/s' }] })
    const id = await idOf('events', 'cur:1')
    const { json } = await get(`/api/events/${id}`)
    expect(json.data.sources.map((s: any) => s.name)).toEqual(['Curado', 'Agregador'])
  })

  it('[AC-24] sin lugar vinculado, place es null', async () => {
    await ingest({ events: [{ source_key: 'e:1' }] })
    const { json } = await get(`/api/events/${await idOf('events', 'e:1')}`)
    expect(json.data.place).toBeNull()
  })

  it('[AC-25] last_seen_at de hace 40 h: is_stale true; de hace 10 h: false', async () => {
    await ingest({ events: [{ source_key: 'e:viejo', title: 'Viejo' }] }, new Date(T0.getTime() - 40 * HOUR))
    await ingest({ events: [{ source_key: 'e:fresco', title: 'Fresco', venue_name: 'Otra' }] }, new Date(T0.getTime() - 10 * HOUR))
    expect((await get(`/api/events/${await idOf('events', 'e:viejo')}`)).json.data.is_stale).toBe(true)
    expect((await get(`/api/events/${await idOf('events', 'e:fresco')}`)).json.data.is_stale).toBe(false)
  })

  describe('[AC-26] inexistente, vencido o inválido', () => {
    it('UUID que no existe: 404 con envelope', async () => {
      const { res, json } = await get(`/api/events/${UNKNOWN_UUID}`)
      expect(res.status).toBe(404)
      expect(json).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('evento con más de 7 días sin verse: 404', async () => {
      await ingest({ events: [{ source_key: 'e:viejo' }] }, new Date(T0.getTime() - 8 * DAY))
      const { res } = await get(`/api/events/${await idOf('events', 'e:viejo')}`)
      expect(res.status).toBe(404)
    })

    it('un lugar con 60 días sin verse sigue respondiendo 200', async () => {
      await ingest({ places: [{ source_key: 'p:viejo' }] }, new Date(T0.getTime() - 60 * DAY))
      const { res } = await get(`/api/places/${await idOf('places', 'p:viejo')}`)
      expect(res.status).toBe(200)
    })
  })

  it('[AC-27] con lat/lon calcula distance_m y walk_minutes; sin ellos son null', async () => {
    await ingest({ events: [{ source_key: 'e:1', lat: -32.935, lon: -60.65 }] })
    const id = await idOf('events', 'e:1')
    const con = await get(`/api/events/${id}?lat=-32.94&lon=-60.65`)
    expect(con.json.data.distance_m).toBeGreaterThan(500)
    expect(con.json.data.walk_minutes).toBe(Math.ceil(con.json.data.distance_m / 80))
    const sin = await get(`/api/events/${id}`)
    expect(sin.json.data).toMatchObject({ distance_m: null, walk_minutes: null })
  })

  it('[AC-14] evento sin ubicación: location_known false y sin distancia aunque se pase origen', async () => {
    await ingest({ events: [{ source_key: 'e:1', lat: null, lon: null }] })
    const { json } = await get(`/api/events/${await idOf('events', 'e:1')}?lat=-32.94&lon=-60.65`)
    expect(json.data).toMatchObject({ location_known: false, lat: null, distance_m: null, walk_minutes: null })
  })

  describe('[AC-37] also_at: el mismo show en otras sedes (E-2)', () => {
    const url = 'https://fuente.test/show'
    it('dos sedes del mismo show se listan entre sí', async () => {
      await ingest({
        events: [
          { source_key: 's:1', title: 'Show', venue_name: 'Sede 1', source_url: url },
          { source_key: 's:2', title: 'Show', venue_name: 'Sede 2', source_url: url },
        ],
      })
      const a = await idOf('events', 's:1')
      const b = await idOf('events', 's:2')
      const ra = await get(`/api/events/${a}`)
      expect(ra.json.data.also_at).toEqual([expect.objectContaining({ id: b, venue_name: 'Sede 2' })])
      const rb = await get(`/api/events/${b}`)
      expect(rb.json.data.also_at.map((x: any) => x.id)).toEqual([a])
    })

    it('dos películas distintas de la misma sede con el mismo source_url no se listan entre sí', async () => {
      await ingest({
        events: [
          { source_key: 'c:1', title: 'Película A', source_url: 'https://cine.test/cartelera' },
          { source_key: 'c:2', title: 'Película B', source_url: 'https://cine.test/cartelera' },
        ],
      })
      const { json } = await get(`/api/events/${await idOf('events', 'c:1')}`)
      expect(json.data.also_at).toEqual([])
    })

    it('el mismo título en la misma sede no es hermano', async () => {
      await ingest({
        events: [
          { source_key: 's:1', title: 'Show', venue_name: 'Sede 1', start_date: '2026-10-06', source_url: url },
          { source_key: 's:2', title: 'Show', venue_name: 'Sede 1', start_date: '2026-10-07', end_date: '2026-10-07', source_url: url },
        ],
      })
      const { json } = await get(`/api/events/${await idOf('events', 's:1')}`)
      expect(json.data.also_at).toEqual([])
    })

    it('[AC-24] excluye hermanos vencidos (E-9)', async () => {
      await ingest(
        { events: [{ source_key: 's:2', title: 'Show', venue_name: 'Sede 2', source_url: url }] },
        new Date(T0.getTime() - 8 * DAY),
      )
      await ingest({ events: [{ source_key: 's:1', title: 'Show', venue_name: 'Sede 1', source_url: url }] })
      const { json } = await get(`/api/events/${await idOf('events', 's:1')}`)
      expect(json.data.also_at).toEqual([])
    })
  })

  describe('ids absorbidos por una fusión siguen resolviendo (E-12, F-15)', () => {
    it('[AC-36] el id de un evento absorbido responde 200 con el evento vigente', async () => {
      await ingest({ events: [{ source_key: 's:1', title: 'Show', venue_name: 'Sala A' }] })
      await ingest({ events: [{ source_key: 's:2', title: 'Show', venue_name: 'Sala B', address: 'Calle 1 200' }] })
      const keep = await idOf('events', 's:1')
      const absorbed = await idOf('events', 's:2')
      await ingest({ events: [{ source_key: 's:3', title: 'Show', venue_name: 'Sala A', address: 'Calle 1 200' }] })
      const { res, json } = await get(`/api/events/${absorbed}`)
      expect(res.status).toBe(200)
      expect(json.data.id).toBe(keep)
    })

    it('[AC-38] [AC-39] el id de un lugar osm absorbido y un evento que lo referenciaba resuelven al curado', async () => {
      await ingest({ places: [{ source_key: 'osm:n1', origin: 'osm', name: 'La Esquina' }] })
      await ingest({ places: [{ source_key: 'osm:w1', origin: 'osm', name: 'La Esquina' }] })
      await ingest({ events: [{ source_key: 'e:1', place_source_key: 'osm:w1', lat: null, lon: null }] })
      const w1 = await idOf('places', 'osm:w1')
      const n1 = await idOf('places', 'osm:n1')
      await ingest({ places: [{ source_key: 'cur:1', origin: 'curated', name: 'La Esquina', phone: '555' }] })
      const lugar = await get(`/api/places/${w1}`)
      expect(lugar.res.status).toBe(200)
      expect(lugar.json.data).toMatchObject({ id: n1, origin: 'curated', phone: '555' })
      const evento = await get(`/api/events/${await idOf('events', 'e:1')}`)
      expect(evento.json.data.place).toMatchObject({ id: n1, name: 'La Esquina' })
    })
  })

  it('[AC-39] un evento cuyo lugar llega en un lote posterior queda sin lugar y después se vincula solo', async () => {
    await ingest({ events: [{ source_key: 'e:1', place_source_key: 'osm:futuro', lat: null, lon: null }] })
    const id = await idOf('events', 'e:1')
    const antes = await get(`/api/events/${id}`)
    expect(antes.json.data).toMatchObject({ place: null, location_known: false })
    await ingest({ places: [{ source_key: 'osm:futuro', origin: 'osm', name: 'Llegó después', lat: -32.93, lon: -60.64 }] })
    const despues = await get(`/api/events/${id}`)
    expect(despues.json.data.place).toMatchObject({ name: 'Llegó después' })
    expect(despues.json.data).toMatchObject({ location_known: true, lat: -32.93, lon: -60.64 })
  })
})

describe('GET /api/places/:id', () => {
  it('[AC-28] devuelve todas las claves, open_now según el horario y sin is_stale', async () => {
    await ingest({
      places: [
        {
          source_key: 'p:1',
          name: 'Bar Abierto',
          phone: '341-555',
          opening_hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: '12:00', closes: '23:00' })),
          hours_text: 'Mo-Su 12:00-23:00',
        },
      ],
    })
    const { res, json } = await get(`/api/places/${await idOf('places', 'p:1')}`)
    expect(res.status).toBe(200)
    expect(PlaceDetailSchema.safeParse(json.data), JSON.stringify(json.data)).toMatchObject({ success: true })
    expect(json.data).toMatchObject({
      location_known: true,
      open_now: true,
      phone: '341-555',
      hours_text: 'Mo-Su 12:00-23:00',
      upcoming_events: [],
    })
    expect(json.data).not.toHaveProperty('is_stale')
  })

  it('[AC-17] sin horario: open_now null', async () => {
    await ingest({ places: [{ source_key: 'p:1' }] })
    const { json } = await get(`/api/places/${await idOf('places', 'p:1')}`)
    expect(json.data).toMatchObject({ opening_hours: null, open_now: null })
  })

  it('[AC-27] distancia desde lat/lon', async () => {
    await ingest({ places: [{ source_key: 'p:1', lat: -32.935, lon: -60.65 }] })
    const { json } = await get(`/api/places/${await idOf('places', 'p:1')}?lat=-32.94&lon=-60.65`)
    expect(json.data.distance_m).toBeGreaterThan(500)
    expect(json.data.walk_minutes).toBe(Math.ceil(json.data.distance_m / 80))
  })

  it('[AC-26] UUID inexistente: 404', async () => {
    const { res } = await get(`/api/places/${UNKNOWN_UUID}`)
    expect(res.status).toBe(404)
  })

  describe('[AC-28] upcoming_events', () => {
    it('lista los próximos primero, sin los que ya pasaron ni los vencidos, máximo 20', async () => {
      const events = [
        { source_key: 'e:pasado', title: 'Pasado', start_date: '2026-10-06', end_date: '2026-10-06', start_time: '18:00' },
        { source_key: 'e:manana', title: 'Mañana', start_date: '2026-10-07', end_date: '2026-10-07', start_time: '21:00' },
        { source_key: 'e:hoy', title: 'Hoy', start_date: '2026-10-06', end_date: '2026-10-06', start_time: '23:00' },
        { source_key: 'e:lejano', title: 'Lejano', start_date: '2026-10-20', end_date: '2026-10-20', start_time: '20:00' },
      ].map((e) => ({ ...e, venue_name: e.title, place_source_key: 'p:sala' }))
      await ingest({ places: [{ source_key: 'p:sala', name: 'Sala' }], events })
      // un evento vencido (visto por última vez hace 8 días) del mismo lugar
      await ingest(
        { events: [{ source_key: 'e:vencido', title: 'Vencido', venue_name: 'V', place_source_key: 'p:sala', start_date: '2026-10-08', end_date: '2026-10-08' }] },
        new Date(T0.getTime() - 8 * DAY),
      )
      const { json } = await get(`/api/places/${await idOf('places', 'p:sala')}`)
      expect(json.data.upcoming_events.map((e: any) => e.title)).toEqual(['Hoy', 'Mañana', 'Lejano'])
      expect(json.data.upcoming_events[0]).toEqual({
        id: expect.any(String),
        title: 'Hoy',
        start_date: '2026-10-06',
        start_time: '23:00',
        price_status: 'unknown',
        price_from_ars: null,
      })
    })

    it('máximo 20 eventos', async () => {
      const events = Array.from({ length: 25 }, (_, i) => ({
        source_key: `e:${i}`,
        title: `Evento ${i}`,
        venue_name: `Sede ${i}`,
        place_source_key: 'p:sala',
        start_date: '2026-10-07',
        end_date: '2026-10-07',
      }))
      await ingest({ places: [{ source_key: 'p:sala', name: 'Sala' }], events })
      const { json } = await get(`/api/places/${await idOf('places', 'p:sala')}`)
      expect(json.data.upcoming_events).toHaveLength(20)
    })

    it('[AC-38] incluye los eventos que referencian a un alias absorbido del lugar', async () => {
      await ingest({ places: [{ source_key: 'osm:a1', origin: 'osm', name: 'Sala' }] })
      await ingest({ events: [{ source_key: 'e:1', title: 'Show', venue_name: 'Sala', place_source_key: 'osm:a1', start_date: '2026-10-07', end_date: '2026-10-07' }] })
      await ingest({ places: [{ source_key: 'cur:a', origin: 'curated', name: 'Sala' }] })
      const { json } = await get(`/api/places/${await idOf('places', 'cur:a')}`)
      expect(json.data.upcoming_events.map((e: any) => e.title)).toEqual(['Show'])
    })
  })
})
