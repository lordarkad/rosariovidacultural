import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SearchItemSchema } from '@tript/shared'
import { get, ingest, T0, truncateCatalog } from './helpers/seed'

beforeEach(() => truncateCatalog())

// centro de Funes (-32.9262,-60.8164, radio 3000) y de Pichincha (-32.9373,-60.6585, radio 800)
const FUNES = { lat: -32.9262, lon: -60.8164 }
const PICHINCHA = { lat: -32.9373, lon: -60.6585 }

describe('GET /api/search', () => {
  it('[AC-2] por zona: solo ítems de Funes, eventos y lugares, con X-Total-Count coherente', async () => {
    await ingest({
      places: [
        { source_key: 'osm:funes', origin: 'osm', name: 'Bar de Funes', ...FUNES },
        { source_key: 'osm:pich', origin: 'osm', name: 'Bar de Pichincha', ...PICHINCHA },
      ],
      events: [
        { source_key: 'f:funes', title: 'Show en Funes', ...FUNES },
        { source_key: 'f:pich', title: 'Show en Pichincha', ...PICHINCHA },
        { source_key: 'f:sin', title: 'Show sin ubicación', lat: null, lon: null },
      ],
    })
    const { res, json, total } = await get('/api/search?z=funes&cuando=hoy')
    expect(res.status).toBe(200)
    expect(json.data.map((i: any) => i.title).sort()).toEqual(['Bar de Funes', 'Show en Funes'])
    expect(new Set(json.data.map((i: any) => i.kind))).toEqual(new Set(['event', 'place']))
    expect(json.data.every((i: any) => i.location_known)).toBe(true)
    expect(total).toBe(2)
    expect(res.headers.get('X-Page')).toBe('1')
    expect(res.headers.get('X-Per-Page')).toBe('20')
    for (const i of json.data) expect(SearchItemSchema.safeParse(i).success).toBe(true)
  })

  it('[AC-29] lo ingerido se ve en la búsqueda', async () => {
    await ingest({ events: [{ source_key: 'f:1', title: 'Recién ingerido' }] })
    const { json } = await get('/api/search?cuando=hoy')
    expect(json.data.map((i: any) => i.title)).toEqual(['Recién ingerido'])
  })

  it('[AC-3] por coordenadas: distance_m dentro del radio y walk_minutes = ceil(distance_m/80); z gana sobre radio_m', async () => {
    await ingest({
      events: [
        { source_key: 'f:cerca', title: 'Cerca', lat: -32.935, lon: -60.65 },
        { source_key: 'f:lejos', title: 'Lejos', lat: -32.92, lon: -60.65 },
      ],
    })
    const { json } = await get('/api/search?lat=-32.94&lon=-60.65&radio_m=1000')
    expect(json.data.map((i: any) => i.title)).toEqual(['Cerca'])
    const [item] = json.data
    expect(item.distance_m).toBeGreaterThan(0)
    expect(item.distance_m).toBeLessThanOrEqual(1000)
    expect(item.walk_minutes).toBe(Math.ceil(item.distance_m / 80))
    // con z y radio_m juntos vale el radio de la zona, no radio_m
    await ingest({ events: [{ source_key: 'f:fz', title: 'En Funes', ...FUNES, lat: -32.9262 + 0.02 }] })
    const z = await get('/api/search?z=funes&radio_m=500')
    expect(z.json.data.map((i: any) => i.title)).toEqual(['En Funes'])
  })

  it('[AC-6] zona inexistente: 404 con envelope de error', async () => {
    const { res, json } = await get('/api/search?z=no-existe')
    expect(res.status).toBe(404)
    expect(json).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('[AC-21] sin resultados: 200 con data [] y X-Total-Count 0', async () => {
    const { res, json, total } = await get('/api/search?z=funes&cuando=hoy')
    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    expect(total).toBe(0)
  })

  it('[AC-18] paginación: página 2 de 45 resultados trae 20 y los headers', async () => {
    await ingest({
      events: Array.from({ length: 45 }, (_, i) => ({
        source_key: `f:${i}`,
        title: `Evento ${String(i).padStart(2, '0')}`,
        venue_name: `Sede ${i}`,
      })),
    })
    const p2 = await get('/api/search?cuando=hoy&per_page=20&page=2')
    expect(p2.json.data).toHaveLength(20)
    expect(p2.total).toBe(45)
    expect(p2.res.headers.get('X-Page')).toBe('2')
    expect(p2.res.headers.get('X-Per-Page')).toBe('20')
    const p1 = await get('/api/search?cuando=hoy&per_page=20&page=1')
    const p3 = await get('/api/search?cuando=hoy&per_page=20&page=3')
    const ids = [...p1.json.data, ...p2.json.data, ...p3.json.data].map((i: any) => i.id)
    expect(ids).toHaveLength(45)
    expect(new Set(ids).size).toBe(45)
    const p4 = await get('/api/search?cuando=hoy&per_page=20&page=4')
    expect(p4.res.status).toBe(200)
    expect(p4.json.data).toEqual([])
  })

  it('[AC-19] vencimiento (E-9): el evento sin verse hace más de 7 días no aparece; el lugar de hace 60 días sí', async () => {
    const day = 24 * 3_600_000
    await ingest({ events: [{ source_key: 'f:viejo', title: 'Evento viejo' }] }, new Date(T0.getTime() - 8 * day))
    await ingest(
      { places: [{ source_key: 'osm:viejo', origin: 'osm', name: 'Lugar viejo' }] },
      new Date(T0.getTime() - 60 * day),
    )
    await ingest({ events: [{ source_key: 'f:fresco', title: 'Evento fresco', venue_name: 'Otra' }] }, new Date(T0.getTime() - 6 * day))
    const { json } = await get('/api/search?cuando=hoy')
    expect(json.data.map((i: any) => i.title).sort()).toEqual(['Evento fresco', 'Lugar viejo'])
  })

  it('[AC-20] texto libre: sin distinguir mayúsculas ni tildes', async () => {
    await ingest({
      events: [
        { source_key: 'f:1', title: 'Obra en el Teatro Círculo' },
        { source_key: 'f:2', title: 'Recital', venue_name: 'Sala Otra' },
      ],
      places: [{ source_key: 'p:1', name: 'Café del TEATRO' }],
    })
    const { json } = await get('/api/search?cuando=hoy&q=teatro')
    expect(json.data.map((i: any) => i.title).sort()).toEqual(['Café del TEATRO', 'Obra en el Teatro Círculo'])
  })

  it('[AC-20] q de exactamente 100 caracteres responde 200 contra la base real', async () => {
    await ingest({ events: [{ source_key: 'f:1', title: 'Algo' }] })
    const { res, json } = await get(`/api/search?cuando=hoy&q=${'a'.repeat(100)}`)
    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
  })

  it('[AC-16] musica estricto contra datos reales', async () => {
    await ingest({
      events: [
        { source_key: 'f:cena', title: 'Cena show', venue_name: 'A', intents: ['comer'], music_genres: ['jazz'] },
        { source_key: 'f:rock', title: 'Rock', venue_name: 'B', intents: ['musica_en_vivo'], music_genres: ['rock'] },
        { source_key: 'f:jazz', title: 'Jazz en vivo', venue_name: 'C', intents: ['musica_en_vivo'], music_genres: ['jazz'] },
        { source_key: 'f:baile', title: 'Jazz y baile', venue_name: 'D', intents: ['bailar'], music_genres: ['jazz'] },
      ],
      places: [{ source_key: 'p:resto', name: 'Restaurante', intents: ['comer'] }],
    })
    const { json } = await get('/api/search?cuando=hoy&i=comer,musica_en_vivo&musica=jazz')
    expect(json.data.map((i: any) => i.title).sort()).toEqual(['Cena show', 'Jazz en vivo'])
    const solo = await get('/api/search?cuando=hoy&i=musica_en_vivo&musica=jazz')
    expect(solo.json.data.map((i: any) => i.title)).toEqual(['Jazz en vivo'])
  })

  it('[AC-14] [AC-39] un evento sin coordenadas hereda las del lugar vinculado y su sede/dirección', async () => {
    await ingest({
      places: [{ source_key: 'p:sala', name: 'Teatro Mayor', address: 'Corrientes 100', ...PICHINCHA }],
      events: [
        {
          source_key: 'f:1',
          title: 'Función',
          venue_name: null,
          address: null,
          lat: null,
          lon: null,
          place_source_key: 'p:sala',
        },
      ],
    })
    const { json } = await get('/api/search?cuando=hoy&z=pichincha&i=espectaculo')
    expect(json.data).toHaveLength(1)
    expect(json.data[0]).toMatchObject({
      kind: 'event',
      location_known: true,
      lat: PICHINCHA.lat,
      venue_name: 'Teatro Mayor',
      address: 'Corrientes 100',
    })
  })

  it('[AC-14] sin origen, un evento sin ubicación aparece al final con distance_m null', async () => {
    await ingest({
      events: [
        { source_key: 'f:con', title: 'Con ubicación', ...FUNES, start_time: '23:30', venue_name: 'A' },
        { source_key: 'f:sin', title: 'Sin ubicación', lat: null, lon: null, start_time: '23:00', venue_name: 'B' },
      ],
    })
    const { json } = await get('/api/search?cuando=hoy')
    expect(json.data.map((i: any) => i.title)).toEqual(['Con ubicación', 'Sin ubicación'])
    expect(json.data[1]).toMatchObject({ location_known: false, distance_m: null, lat: null })
  })

  it('[AC-8] [AC-17] franjas contra datos reales (reloj fijo martes 21:00)', async () => {
    await ingest({
      events: [
        { source_key: 'f:ahora', title: 'Empezó 19:30', start_time: '19:30', venue_name: 'A' },
        { source_key: 'f:noche', title: 'A las 23:00', start_time: '23:00', venue_name: 'B' },
        { source_key: 'f:viejo', title: 'Empezó 18:00', start_time: '18:00', venue_name: 'C' },
        { source_key: 'f:sin', title: 'Sin horario', start_time: null, venue_name: 'D' },
      ],
      places: [
        {
          source_key: 'p:abierto',
          name: 'Abierto',
          opening_hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: '12:00', closes: '23:00' })),
        },
        { source_key: 'p:sin', name: 'Sin horario' },
      ],
    })
    const { json } = await get('/api/search?cuando=hoy')
    expect(json.data.map((i: any) => [i.title, i.band])).toEqual([
      ['Abierto', 'ahora'],
      ['Empezó 19:30', 'ahora'],
      ['A las 23:00', 'esta_noche'],
      ['Sin horario', 'a_confirmar'],
      ['Sin horario', 'a_confirmar'],
    ])
    const open = json.data.find((i: any) => i.title === 'Abierto')
    expect(open).toMatchObject({ kind: 'place', open_now: true, place_kind: 'bar' })
  })

  it('[D-9] las coordenadas de la búsqueda no aparecen en los logs', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'error')]
    await get('/api/search?lat=-32.941234&lon=-60.651234&radio_m=1000')
    const logged = spies.flatMap((s) => s.mock.calls.flat()).join(' ')
    expect(logged).not.toContain('32.941234')
    expect(logged).not.toContain('60.651234')
    spies.forEach((s) => s.mockRestore())
  })
})
