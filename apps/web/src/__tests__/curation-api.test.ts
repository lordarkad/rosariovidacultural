import { afterEach, describe, expect, it, vi } from 'vitest'
import { listEventSources, listEvents, listPlaces } from '@/services/api'

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })

const mockFetch = (res: Response) => {
  const fn = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('cliente de curación', () => {
  it('[AC-24] listEvents: serializa los filtros y lee la paginación de los headers', async () => {
    const fn = mockFetch(
      json({ success: true, data: [{ id: 'a' }] }, { headers: { 'X-Total-Count': '312', 'X-Page': '3', 'X-Per-Page': '50' } }),
    )
    const page = await listEvents({ q: 'tango', estado: ['pasado', 'sin_ver'], faltan: ['imagen'], fuente: ['Cartel'], page: 3 })
    expect(page).toEqual({ items: [{ id: 'a' }], total: 312, page: 3, perPage: 50 })
    expect(fn.mock.calls[0]![0]).toBe('/api/events?q=tango&estado=pasado%2Csin_ver&faltan=imagen&fuente=Cartel&page=3')
  })

  it('listPlaces: filtros propios de lugares', async () => {
    const fn = mockFetch(json({ success: true, data: [] }, { headers: { 'X-Total-Count': '0' } }))
    const page = await listPlaces({ origen: ['osm'], tipo: ['bar', 'cafe'], faltan: ['cocina'], per_page: 100 })
    expect(page.total).toBe(0)
    expect(fn.mock.calls[0]![0]).toBe('/api/places?origen=osm&tipo=bar%2Ccafe&faltan=cocina&per_page=100')
  })

  it('listEventSources: devuelve la lista del envelope', async () => {
    const fn = mockFetch(json({ success: true, data: [{ name: 'Cartel', count: 12 }] }))
    expect(await listEventSources()).toEqual([{ name: 'Cartel', count: 12 }])
    expect(fn.mock.calls[0]![0]).toBe('/api/events/sources')
  })

  it('error del envelope: ApiError con status y mensaje', async () => {
    mockFetch(json({ success: false, error: 'per_page: demasiado grande' }, { status: 400 }))
    await expect(listEvents({ per_page: 500 })).rejects.toMatchObject({ status: 400, message: 'per_page: demasiado grande' })
  })
})
