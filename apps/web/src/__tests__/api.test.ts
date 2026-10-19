import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getEvent, getPlace, listZones, searchItems, searchPins, toQueryString } from '@/services/api'

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })

const mockFetch = (res: Response) => {
  const fn = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('toQueryString', () => {
  it('omite vacíos y separa las listas con coma', () => {
    expect(toQueryString({ i: ['comer', 'bailar'], gratis: true, q: '', z: undefined, radio_m: 500 })).toBe(
      '?i=comer%2Cbailar&gratis=true&radio_m=500',
    )
    expect(toQueryString({ i: [] })).toBe('')
  })
})

describe('cliente de la API', () => {
  it('lista de zonas: devuelve data del envelope', async () => {
    const fn = mockFetch(json({ success: true, data: [{ id: 'pichincha' }] }))
    expect(await listZones()).toEqual([{ id: 'pichincha' }])
    expect(fn.mock.calls[0]![0]).toBe('/api/zones')
  })

  it('búsqueda: lee la paginación de los headers', async () => {
    const fn = mockFetch(
      json(
        { success: true, data: [{ id: 'a' }] },
        { headers: { 'X-Total-Count': '41', 'X-Page': '2', 'X-Per-Page': '20' } },
      ),
    )
    const page = await searchItems({ i: ['comer'], cuando: 'hoy', page: 2 })
    expect(page).toEqual({ items: [{ id: 'a' }], total: 41, page: 2, perPage: 20 })
    expect(fn.mock.calls[0]![0]).toBe('/api/search?i=comer&cuando=hoy&page=2')
  })

  it('pins: X-Truncated indica que hay más de 100', async () => {
    mockFetch(json({ success: true, data: [] }, { headers: { 'X-Total-Count': '230', 'X-Truncated': 'true' } }))
    expect(await searchPins({ z: 'centro' })).toEqual({ pins: [], total: 230, truncated: true })
  })

  it('error del envelope: ApiError con status y mensaje', async () => {
    mockFetch(json({ success: false, error: 'No encontrado' }, { status: 404 }))
    await expect(getEvent('x')).rejects.toMatchObject({ name: 'ApiError', status: 404, message: 'No encontrado' })
  })

  it('respuesta que no es JSON: ApiError con el status', async () => {
    mockFetch(new Response('<html>', { status: 502 }))
    const err = await listZones().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 502, message: 'Error 502' })
  })

  it('[AC-4] getEvent envía lat/lon solo cuando están ambos', async () => {
    const fn = vi.fn().mockImplementation(async () => json({ success: true, data: { id: 'e1' } }))
    vi.stubGlobal('fetch', fn)
    await getEvent('e1', { lat: -32.9, lon: -60.6 })
    expect(fn.mock.calls[0]![0]).toBe('/api/events/e1?lat=-32.9&lon=-60.6')
    await getEvent('e1', { lat: -32.9 } as { lat: number; lon: number })
    expect(fn.mock.calls[1]![0]).toBe('/api/events/e1')
    await getEvent('e1')
    expect(fn.mock.calls[2]![0]).toBe('/api/events/e1')
  })

  it('[AC-4] getEvent propaga el AbortSignal en el tercer argumento', async () => {
    const fn = mockFetch(json({ success: true, data: { id: 'e1' } }))
    const ctrl = new AbortController()
    await getEvent('e1', undefined, { signal: ctrl.signal })
    expect(fn.mock.calls[0]![1].signal).toBe(ctrl.signal)
  })

  it('[AC-3] getPlace envía lat/lon solo cuando están ambos', async () => {
    const fn = vi.fn().mockImplementation(async () => json({ success: true, data: { id: 'p1' } }))
    vi.stubGlobal('fetch', fn)
    await getPlace('p1', { lat: -32.9, lon: -60.6 })
    expect(fn.mock.calls[0]![0]).toBe('/api/places/p1?lat=-32.9&lon=-60.6')
    await getPlace('p1', { lat: -32.9 } as { lat: number; lon: number })
    expect(fn.mock.calls[1]![0]).toBe('/api/places/p1')
    await getPlace('p1')
    expect(fn.mock.calls[2]![0]).toBe('/api/places/p1')
  })

  it('[AC-3] getPlace propaga el AbortSignal en el tercer argumento', async () => {
    const fn = mockFetch(json({ success: true, data: { id: 'p1' } }))
    const ctrl = new AbortController()
    await getPlace('p1', undefined, { signal: ctrl.signal })
    expect(fn.mock.calls[0]![1].signal).toBe(ctrl.signal)
  })

  it('propaga el AbortSignal para cancelar la request anterior', async () => {
    const fn = mockFetch(json({ success: true, data: [] }))
    const ctrl = new AbortController()
    await listZones({ signal: ctrl.signal })
    expect(fn.mock.calls[0]![1].signal).toBe(ctrl.signal)
  })
})
