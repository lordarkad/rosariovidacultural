import { describe, it, expect, beforeEach } from 'vitest'
import { CurationEventSchema, CurationPlaceSchema } from '@tript/shared'
import { app, get, ingest, T0, truncateCatalog } from './helpers/seed'

beforeEach(() => truncateCatalog())

const HOUR = 3_600_000
const DAY = 24 * HOUR
const at = (ms: number) => new Date(T0.getTime() + ms)
const titles = (json: { data?: any[] }) => (json.data ?? []).map((e) => e.title)

/** Evento completo: no le falta ningún campo de `faltan`. */
const full = (key: string, extra: Record<string, unknown> = {}) => ({
  source_key: key,
  title: `Completo ${key}`,
  description: 'Una descripción',
  image_url: 'https://img.test/a.jpg',
  address: 'Corrientes 100',
  lat: -32.94,
  lon: -60.65,
  start_time: '21:00',
  price_status: 'free' as const,
  venue_name: `Sala ${key}`,
  ...extra,
})

describe('GET /api/events (listEvents)', () => {
  it('[AC-1] sobre, todas las claves y headers de paginación', async () => {
    await ingest({ events: [full('e:1'), full('e:2'), full('e:3')] })
    const { res, json, total } = await get('/api/events')
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(3)
    for (const row of json.data!) {
      expect(CurationEventSchema.safeParse(row).success, JSON.stringify(row)).toBe(true)
    }
    expect(total).toBe(3)
    expect(res.headers.get('X-Page')).toBe('1')
    expect(res.headers.get('X-Per-Page')).toBe('50')
  })

  it('[AC-2] incluye pasados y vencidos que el sitio oculta', async () => {
    await ingest({ events: [full('e:vigente', { title: 'Vigente' })] })
    await ingest({ events: [full('e:pasado', { title: 'Pasado', start_date: '2026-10-04', end_date: '2026-10-04' })] })
    await ingest(
      { events: [full('e:viejo', { title: 'Viejo', start_date: '2026-10-20', end_date: '2026-10-20' })] },
      at(-8 * DAY),
    )
    const { json } = await get('/api/events')
    expect(titles(json).sort()).toEqual(['Pasado', 'Viejo', 'Vigente'])
    const byTitle = Object.fromEntries(json.data!.map((e: any) => [e.title, e]))
    // getEvent: el pasado visto hoy abre; el de hace 8 días da 404
    expect((await get(`/api/events/${byTitle['Pasado'].id}`)).res.status).toBe(200)
    expect((await get(`/api/events/${byTitle['Viejo'].id}`)).res.status).toBe(404)
  })

  it('[AC-3] estado y precedencia en el borde del día de negocio y de los 7 días', async () => {
    const clock = new Date('2026-10-07T03:00:00-03:00') // todavía es martes 06 para el negocio
    await ingest({ events: [full('e:hoy', { title: 'Termina el 6', start_date: '2026-10-06', end_date: '2026-10-06' })] }, clock)
    await ingest({ events: [full('e:ayer', { title: 'Termino el 5', start_date: '2026-10-05', end_date: '2026-10-05' })] }, clock)
    await ingest({ events: [full('e:futuro', { title: 'Futuro', start_date: '2026-10-09', end_date: '2026-10-09' })] }, clock)
    await ingest(
      { events: [full('e:siete', { title: 'Siete dias', start_date: '2026-10-09', end_date: '2026-10-09' })] },
      new Date(clock.getTime() - 7 * DAY),
    )
    await ingest(
      { events: [full('e:siete1', { title: 'Siete dias y 1 ms', start_date: '2026-10-09', end_date: '2026-10-09' })] },
      new Date(clock.getTime() - 7 * DAY - 1),
    )
    await ingest(
      { events: [full('e:pasado-viejo', { title: 'Pasado y viejo', start_date: '2026-10-01', end_date: '2026-10-01' })] },
      new Date(clock.getTime() - 8 * DAY),
    )
    const { json } = await get('/api/events?per_page=100', clock)
    const estado = Object.fromEntries(json.data!.map((e: any) => [e.title, e.estado]))
    expect(estado).toEqual({
      'Termina el 6': 'vigente',
      'Termino el 5': 'pasado',
      Futuro: 'vigente',
      'Siete dias': 'vigente',
      'Siete dias y 1 ms': 'sin_ver',
      'Pasado y viejo': 'sin_ver',
    })
  })

  it('[AC-4] filtro estado (unión) y total filtrado', async () => {
    await ingest({ events: [full('e:v', { title: 'V' })] })
    await ingest({ events: [full('e:p', { title: 'P', start_date: '2026-10-04', end_date: '2026-10-04' })] })
    await ingest({ events: [full('e:s', { title: 'S' })] }, at(-9 * DAY))
    const a = await get('/api/events?estado=pasado,sin_ver')
    expect(titles(a.json).sort()).toEqual(['P', 'S'])
    expect(a.total).toBe(2)
    expect(titles((await get('/api/events?estado=vigente')).json)).toEqual(['V'])
    expect((await get('/api/events')).total).toBe(3)
  })

  it('[AC-5] filtro fuente: exacto, unión y fuente inexistente', async () => {
    await ingest({ source: { name: 'Fuente A', tier: 'official' }, events: [full('a:1', { title: 'De A' })] })
    await ingest({ source: { name: 'Fuente B', tier: 'aggregator' }, events: [full('b:1', { title: 'De B' })] })
    expect(titles((await get('/api/events?fuente=Fuente%20A')).json)).toEqual(['De A'])
    expect(titles((await get('/api/events?fuente=Fuente%20A,Fuente%20B')).json).sort()).toEqual(['De A', 'De B'])
    const none = await get('/api/events?fuente=Nadie')
    expect(none.res.status).toBe(200)
    expect(none.json.data).toEqual([])
    expect(none.total).toBe(0)
  })

  it('[AC-6] hereda sede, dirección y coordenadas del lugar vinculado; las del evento mandan', async () => {
    await ingest({
      places: [
        { source_key: 'p:sala', name: 'Teatro Mayor', address: 'Mitre 500', lat: -32.9, lon: -60.6 },
        { source_key: 'p:otro', name: 'Otro Lugar', address: 'Sarmiento 1', lat: -32.8, lon: -60.5 },
      ],
      events: [
        { source_key: 'e:heredado', title: 'Hereda', place_source_key: 'p:sala', venue_name: null, address: null, lat: null, lon: null },
        full('e:propio', { title: 'Propio', place_source_key: 'p:otro' }),
      ],
    })
    const { json } = await get('/api/events')
    const by = Object.fromEntries(json.data!.map((e: any) => [e.title, e]))
    expect(by['Hereda']).toMatchObject({
      venue_name: 'Teatro Mayor',
      address: 'Mitre 500',
      lat: -32.9,
      lon: -60.6,
      place: { name: 'Teatro Mayor', address: 'Mitre 500' },
    })
    expect(by['Propio']).toMatchObject({ address: 'Corrientes 100', lat: -32.94, place: { name: 'Otro Lugar' } })
    // el heredado no figura como sin dirección ni sin coordenadas
    expect(titles((await get('/api/events?faltan=direccion,coordenadas')).json)).toEqual([])
  })

  it('[AC-7] faltan: cada campo por separado, unión y missing completo', async () => {
    await ingest({
      events: [
        full('e:ok', { title: 'Completo' }),
        full('e:sin-imagen', { title: 'Sin imagen', image_url: null }),
        full('e:sin-hora', { title: 'Sin hora', start_time: null }),
        full('e:sin-precio', { title: 'Sin precio', price_status: 'unknown' }),
        full('e:sin-desc', { title: 'Sin descripcion', description: null }),
        full('e:desc-vacia', { title: 'Descripcion vacia', description: '' }),
        full('e:sin-dir', { title: 'Sin direccion', address: null }),
        full('e:sin-coords', { title: 'Sin coordenadas', lat: null, lon: null }),
        full('e:sin-lugar', { title: 'Sin lugar', venue_name: null, address: null, lat: null, lon: null }),
        full('e:solo-sede', { title: 'Solo sede', address: null, lat: null, lon: null }),
      ],
    })
    const q = async (faltan: string) => titles((await get(`/api/events?faltan=${faltan}`)).json).sort()
    expect(await q('imagen')).toEqual(['Sin imagen'])
    expect(await q('hora')).toEqual(['Sin hora'])
    expect(await q('precio')).toEqual(['Sin precio'])
    expect(await q('descripcion')).toEqual(['Descripcion vacia', 'Sin descripcion'])
    expect(await q('direccion')).toEqual(['Sin direccion', 'Sin lugar', 'Solo sede'])
    expect(await q('coordenadas')).toEqual(['Sin coordenadas', 'Sin lugar', 'Solo sede'])
    expect(await q('lugar')).toEqual(['Sin lugar']) // con venue_name pero sin lugar vinculado NO es «lugar»
    expect(await q('imagen,hora')).toEqual(['Sin hora', 'Sin imagen'])
    const all = (await get('/api/events')).json.data!
    const by = Object.fromEntries(all.map((e: any) => [e.title, e.missing]))
    expect(by['Completo']).toEqual([])
    expect(by['Sin lugar']).toEqual(['lugar', 'direccion', 'coordenadas'])
    expect(by['Sin imagen']).toEqual(['imagen'])
  })

  it('[AC-8] q: normalizada sobre título, sede y dirección efectivas y fuente; vacía al normalizar se ignora', async () => {
    await ingest({
      source: { name: 'Qué Hacemos', tier: 'aggregator' },
      places: [{ source_key: 'p:1', name: 'Club Atlético', address: 'Mitre 500' }],
      events: [
        full('e:1', { title: 'Ciclón de Tango' }),
        { source_key: 'e:2', title: 'Hereda sede', place_source_key: 'p:1', venue_name: null, address: null, lat: null, lon: null },
        full('e:3', { title: 'Otro', address: 'Pellegrini 900' }),
      ],
    })
    const q = async (t: string) => titles((await get(`/api/events?q=${encodeURIComponent(t)}`)).json).sort()
    expect(await q('ciclon')).toEqual(['Ciclón de Tango'])
    expect(await q('atletico')).toEqual(['Hereda sede'])
    expect(await q('pellegrini')).toEqual(['Otro'])
    expect((await q('que hacemos')).length).toBe(3)
    for (const vacio of ['%', '_', '!!!']) expect((await q(vacio)).length).toBe(3)
  })

  it('[AC-9] tres grupos, orden por fecha/hora y paginación estable', async () => {
    await ingest({
      events: [
        full('e:v2', { title: 'V2', start_date: '2026-10-08', end_date: '2026-10-08', start_time: '20:00' }),
        full('e:v1b', { title: 'V1 sin hora', start_date: '2026-10-07', end_date: '2026-10-07', start_time: null }),
        full('e:v1a', { title: 'V1 con hora', start_date: '2026-10-07', end_date: '2026-10-07', start_time: '22:00' }),
        full('e:p2', { title: 'P2', start_date: '2026-10-05', end_date: '2026-10-05' }),
        full('e:p1', { title: 'P1', start_date: '2026-10-03', end_date: '2026-10-03' }),
      ],
    })
    await ingest({ events: [full('e:s', { title: 'S', start_date: '2026-10-09', end_date: '2026-10-09' })] }, at(-9 * DAY))
    const all = titles((await get('/api/events?per_page=100')).json)
    expect(all).toEqual(['V1 con hora', 'V1 sin hora', 'V2', 'P1', 'P2', 'S'])
    const walked: string[] = []
    for (let page = 1; page <= 3; page++) walked.push(...titles((await get(`/api/events?per_page=2&page=${page}`)).json))
    expect(walked).toEqual(all)
  })

  it('[AC-10] paginación: página 2, fuera de rango y por defecto', async () => {
    await ingest({ events: ['1', '2', '3', '4', '5'].map((n) => full(`e:${n}`, { title: `T${n}`, start_date: `2026-10-0${n}`, end_date: `2026-10-0${n}` })) })
    const p2 = await get('/api/events?page=2&per_page=2')
    expect(p2.json.data).toHaveLength(2)
    expect(p2.res.headers.get('X-Page')).toBe('2')
    expect(p2.res.headers.get('X-Per-Page')).toBe('2')
    expect(p2.total).toBe(5)
    const far = await get('/api/events?page=99')
    expect(far.res.status).toBe(200)
    expect(far.json.data).toEqual([])
    expect(far.total).toBe(5)
  })

  it('[AC-12] sources: misma regla que getEvent, la primaria primero', async () => {
    await ingest({ source: { name: 'Agregador', tier: 'aggregator' }, events: [full('agg:1', { title: 'Show', source_url: 'https://agg.test/s', via: [{ name: 'Blog', url: 'https://blog.test/s' }] })] })
    await ingest({ source: { name: 'Curado', tier: 'curated' }, events: [full('cur:1', { title: 'Show', source_url: 'https://cur.test/s' })] })
    const { json } = await get('/api/events')
    expect(json.data).toHaveLength(1)
    const row = json.data![0]
    const detail = (await get(`/api/events/${row.id}`)).json.data
    expect(row.sources).toEqual(detail.sources)
    expect(row.sources[0].name).toBe('Curado')
    expect(row.source_name).toBe('Curado')
    expect(row.source_tier).toBe('curated')
  })

  it('[AC-13] catálogo vacío', async () => {
    const { res, json, total } = await get('/api/events')
    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    expect(total).toBe(0)
  })

  it('[AC-14] /events/sources no cae en /:id y no hay escrituras', async () => {
    const { res, json } = await get('/api/events/sources')
    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    const { app: a, env: e } = app()
    for (const [method, path] of [['POST', '/api/events'], ['PUT', '/api/events'], ['PATCH', '/api/places'], ['DELETE', '/api/places']] as const) {
      const r = await a.request(path, { method }, e)
      expect(r.status, `${method} ${path}`).toBe(404)
      expect(((await r.json()) as { success: boolean }).success).toBe(false)
    }
  })
})

describe('GET /api/events/sources (listEventSources)', () => {
  it('[AC-15] una fila por nombre, todos los estados, ordenada', async () => {
    await ingest({ source: { name: 'B fuente', tier: 'aggregator' }, events: [full('b:1', { title: 'B1' }), full('b:2', { title: 'B2' })] })
    await ingest({ source: { name: 'A fuente', tier: 'official' }, events: [full('a:1', { title: 'A1' }), full('a:2', { title: 'A2', start_date: '2026-10-01', end_date: '2026-10-01' })] })
    await ingest({ source: { name: 'A fuente', tier: 'aggregator' }, events: [full('a:3', { title: 'A3' })] }, at(-9 * DAY))
    const { res, json } = await get('/api/events/sources')
    expect(res.status).toBe(200)
    expect(json.data).toEqual([
      { name: 'A fuente', count: 3 },
      { name: 'B fuente', count: 2 },
    ])
  })
})

/** Lugar completo: no le falta ningún campo de `faltan`. */
const fullPlace = (key: string, extra: Record<string, unknown> = {}) => ({
  source_key: key,
  name: `Lugar ${key}`,
  image_url: 'https://img.test/p.jpg',
  opening_hours: [{ day: 0, opens: '10:00', closes: '20:00' }],
  address: 'Mitre 1',
  phone: '341 555 0000',
  website: 'https://lugar.test',
  cuisine: ['café'],
  note: 'Una nota',
  ...extra,
})

describe('GET /api/places (listPlaces)', () => {
  it('[AC-16] sobre, todas las claves y sin vencimiento', async () => {
    await ingest({ places: [fullPlace('p:1'), { source_key: 'p:2', origin: 'osm' }, fullPlace('p:3')] }, at(-60 * DAY))
    const { res, json, total } = await get('/api/places')
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(3)
    for (const row of json.data!) {
      expect(CurationPlaceSchema.safeParse(row).success, JSON.stringify(row)).toBe(true)
    }
    expect(total).toBe(3)
    expect(res.headers.get('X-Per-Page')).toBe('50')
    expect(json.data!.find((p: any) => p.name === 'Lugar p:1').has_opening_hours).toBe(true)
  })

  it('[AC-17] origen y tipo: unión dentro, intersección entre filtros', async () => {
    await ingest({
      places: [
        { source_key: 'c:bar', name: 'Curado bar', origin: 'curated', kind: 'bar' },
        { source_key: 'o:bar', name: 'Osm bar', origin: 'osm', kind: 'bar' },
        { source_key: 'o:cafe', name: 'Osm cafe', origin: 'osm', kind: 'cafe' },
        { source_key: 'o:sala', name: 'Osm sala', origin: 'osm', kind: 'sala' },
      ],
    })
    const q = async (s: string) => titles({ data: (await get(`/api/places?${s}`)).json.data!.map((p: any) => ({ title: p.name })) }).sort()
    expect(await q('origen=osm')).toEqual(['Osm bar', 'Osm cafe', 'Osm sala'])
    expect((await q('origen=curated,osm')).length).toBe(4)
    expect(await q('tipo=bar,cafe')).toEqual(['Curado bar', 'Osm bar', 'Osm cafe'])
    expect(await q('origen=osm&tipo=bar,cafe')).toEqual(['Osm bar', 'Osm cafe'])
    expect((await get('/api/places?origen=osm')).total).toBe(3)
  })

  it('[AC-18] faltan: cada campo, horario con solo hours_text, unión y missing', async () => {
    await ingest({
      places: [
        fullPlace('p:ok', { name: 'Completo' }),
        fullPlace('p:img', { name: 'Sin imagen', image_url: null }),
        fullPlace('p:hor', { name: 'Sin horario', opening_hours: null }),
        fullPlace('p:txt', { name: 'Solo texto', opening_hours: null, hours_text: 'Lu-Vi 10-20' }),
        fullPlace('p:dir', { name: 'Sin direccion', address: null }),
        fullPlace('p:tel', { name: 'Sin telefono', phone: null }),
        fullPlace('p:web', { name: 'Sin web', website: null }),
        fullPlace('p:coc', { name: 'Sin cocina', cuisine: [] }),
        fullPlace('p:not', { name: 'Sin nota', note: null }),
      ],
    })
    const names = async (f: string) => (await get(`/api/places?faltan=${f}`)).json.data!.map((p: any) => p.name).sort()
    expect(await names('imagen')).toEqual(['Sin imagen'])
    expect(await names('horario')).toEqual(['Sin horario', 'Solo texto'])
    expect(await names('direccion')).toEqual(['Sin direccion'])
    expect(await names('telefono')).toEqual(['Sin telefono'])
    expect(await names('web')).toEqual(['Sin web'])
    expect(await names('cocina')).toEqual(['Sin cocina'])
    expect(await names('nota')).toEqual(['Sin nota'])
    expect(await names('imagen,web')).toEqual(['Sin imagen', 'Sin web'])
    const by = Object.fromEntries((await get('/api/places')).json.data!.map((p: any) => [p.name, p.missing]))
    expect(by['Completo']).toEqual([])
    expect(by['Solo texto']).toEqual(['horario'])
  })

  it('[AC-19] q, orden por nombre y paginación estable', async () => {
    await ingest({
      places: [
        { source_key: 'p:3', name: 'Zeta', address: 'Mitre 5' },
        { source_key: 'p:1', name: 'Álamo', address: 'Sarmiento 2' },
        { source_key: 'p:2', name: 'Beta' },
      ],
    })
    const names = (j: { data?: any[] }) => (j.data ?? []).map((p) => p.name)
    expect(names((await get('/api/places?per_page=100')).json)).toEqual(['Álamo', 'Beta', 'Zeta'])
    expect(names((await get('/api/places?q=alamo')).json)).toEqual(['Álamo'])
    expect(names((await get('/api/places?q=mitre')).json)).toEqual(['Zeta'])
    expect(names((await get('/api/places?q=%25')).json)).toHaveLength(3)
    const walked: string[] = []
    for (let page = 1; page <= 3; page++) walked.push(...names((await get(`/api/places?per_page=1&page=${page}`)).json))
    expect(walked).toEqual(['Álamo', 'Beta', 'Zeta'])
  })

  it('[AC-20] catálogo vacío', async () => {
    const { res, json, total } = await get('/api/places')
    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    expect(total).toBe(0)
  })
})

describe('[AC-21] combinaciones de filtros contra D1 real', () => {
  it('[AC-21] listEvents: q + fuente + estado + faltan + paginación con lugar vinculado y varias fuentes', async () => {
    await ingest({
      source: { name: 'Qué Hacemos', tier: 'aggregator' },
      places: [{ source_key: 'p:club', name: 'Club Atlético', address: 'Mitre 500', lat: -32.9, lon: -60.6 }],
      events: ['a', 'b', 'c'].map((n, i) =>
        full(`qh:${n}`, {
          title: `Tango ${n}`,
          start_date: `2026-10-0${7 + i}`,
          end_date: `2026-10-0${7 + i}`,
          place_source_key: 'p:club',
          venue_name: null,
          address: null,
          lat: null,
          lon: null,
          image_url: null,
        }),
      ),
    })
    await ingest({ source: { name: 'Cartel', tier: 'official' }, events: [full('ca:1', { title: 'Tango otro', image_url: null })] })
    await ingest({ source: { name: 'Qué Hacemos', tier: 'aggregator' }, events: [full('qh:viejo', { title: 'Tango viejo', image_url: null })] }, at(-9 * DAY))

    const base = 'q=atletico&fuente=Qu%C3%A9%20Hacemos&estado=vigente&faltan=imagen,hora'
    const all = await get(`/api/events?${base}&per_page=100`)
    expect(titles(all.json)).toEqual(['Tango a', 'Tango b', 'Tango c'])
    expect(all.total).toBe(3)

    const walked: string[] = []
    for (let page = 1; page <= 3; page++) {
      const r = await get(`/api/events?${base}&per_page=1&page=${page}`)
      expect(r.total).toBe(3)
      walked.push(...titles(r.json))
    }
    expect(walked).toEqual(['Tango a', 'Tango b', 'Tango c'])
    // q solo con el nombre de la fuente (con tilde) suma el viejo, que es sin_ver
    expect(titles((await get('/api/events?q=que%20hacemos&estado=sin_ver')).json)).toEqual(['Tango viejo'])
  })

  it('[AC-21] listPlaces: q + origen + tipo + faltan a la vez', async () => {
    await ingest({
      places: [
        { source_key: 'o:1', name: 'Café Uno', origin: 'osm', kind: 'cafe', address: 'Mitre 1' },
        { source_key: 'o:2', name: 'Café Dos', origin: 'osm', kind: 'cafe', address: 'Mitre 2', phone: '341 1' },
        { source_key: 'o:3', name: 'Bar Mitre', origin: 'osm', kind: 'bar', address: 'Mitre 3' },
        { source_key: 'c:1', name: 'Café Curado', origin: 'curated', kind: 'cafe', address: 'Mitre 4' },
      ],
    })
    const q = 'q=mitre&origen=osm&tipo=cafe,bar&faltan=telefono,web'
    const r = await get(`/api/places?${q}&per_page=100`)
    expect(r.json.data!.map((p: any) => p.name)).toEqual(['Bar Mitre', 'Café Dos', 'Café Uno'])
    expect(r.total).toBe(3)
    const walked: string[] = []
    for (let page = 1; page <= 3; page++) {
      const p = await get(`/api/places?${q}&per_page=1&page=${page}`)
      expect(p.total).toBe(3)
      walked.push(...p.json.data!.map((x: any) => x.name))
    }
    expect(walked).toEqual(['Bar Mitre', 'Café Dos', 'Café Uno'])
  })
})
