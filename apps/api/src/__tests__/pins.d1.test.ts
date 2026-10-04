import { describe, it, expect, beforeEach } from 'vitest'
import { SearchPinSchema } from '@tript/shared'
import { get, ingest, truncateCatalog } from './helpers/seed'

beforeEach(() => truncateCatalog())

// 130 eventos con coordenadas sobre una línea norte-sur; los primeros 12 caen dentro del bbox del test
const events = Array.from({ length: 130 }, (_, i) => ({
  source_key: `f:${String(i).padStart(3, '0')}`,
  title: `Evento ${String(i).padStart(3, '0')}`,
  venue_name: `Sede ${i}`,
  lat: -32.95 + i * 0.001,
  lon: -60.65,
}))

describe('GET /api/search/pins', () => {
  it('[AC-22] 130 ítems con coordenadas: 100 pins en el mismo orden que la lista, X-Total-Count 130 y X-Truncated true', async () => {
    await ingest({ events })
    const pins = await get('/api/search/pins?cuando=hoy')
    expect(pins.res.status).toBe(200)
    expect(pins.json.data).toHaveLength(100)
    expect(pins.total).toBe(130)
    expect(pins.res.headers.get('X-Truncated')).toBe('true')
    for (const p of pins.json.data) expect(SearchPinSchema.safeParse(p).success).toBe(true)
    const list = await get('/api/search?cuando=hoy&per_page=100')
    expect(pins.json.data.map((p: any) => p.id)).toEqual(list.json.data.map((i: any) => i.id))
  })

  it('[AC-23] bbox: solo los pins dentro, con total y X-Truncated false', async () => {
    await ingest({ events })
    // lat -32.95 .. -32.939 (12 eventos), lon -60.65
    const { res, json, total } = await get('/api/search/pins?cuando=hoy&bbox=-60.66,-32.9505,-60.64,-32.9385')
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(12)
    expect(total).toBe(12)
    expect(res.headers.get('X-Truncated')).toBe('false')
  })

  it('[AC-14] los eventos sin ubicación no tienen pin ni cuentan en X-Total-Count', async () => {
    await ingest({
      events: [
        { source_key: 'f:con', title: 'Con', venue_name: 'A', lat: -32.94, lon: -60.65 },
        { source_key: 'f:sin', title: 'Sin', venue_name: 'B', lat: null, lon: null },
      ],
    })
    const { json, total } = await get('/api/search/pins?cuando=hoy')
    expect(json.data.map((p: any) => p.title)).toEqual(['Con'])
    expect(total).toBe(1)
  })

  it('aplica los mismos filtros que /search (zona inexistente es 404)', async () => {
    const { res } = await get('/api/search/pins?z=no-existe')
    expect(res.status).toBe(404)
  })

  it('los lugares también tienen pin', async () => {
    await ingest({ places: [{ source_key: 'p:1', name: 'Un lugar' }] })
    const { json } = await get('/api/search/pins?cuando=hoy')
    expect(json.data).toEqual([expect.objectContaining({ kind: 'place', title: 'Un lugar' })])
  })
})
