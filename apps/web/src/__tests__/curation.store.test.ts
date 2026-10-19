import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api')
  return { ...actual, listEvents: vi.fn(), listPlaces: vi.fn(), listEventSources: vi.fn() }
})

import { ApiError, listEvents, listPlaces } from '@/services/api'
import { useCurationStore } from '@/stores/curation.store'

const ev = (id: string) => ({ id, title: `T${id}` }) as never
const page = (ids: string[], total: number, n = 1) => ({ items: ids.map(ev), total, page: n, perPage: 100 })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(listEvents).mockReset()
  vi.mocked(listPlaces).mockReset()
})

describe('curation.store — listado', () => {
  it('[AC-25] loadEvents: loading, filas y total; los filtros viajan al servicio', async () => {
    vi.mocked(listEvents).mockResolvedValue(page(['a', 'b'], 312))
    const s = useCurationStore()
    const p = s.loadEvents({ q: 'tango', page: 2 })
    expect(s.loading).toBe(true)
    await p
    expect(s.events.map((e) => e.id)).toEqual(['a', 'b'])
    expect(s.total).toBe(312)
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(vi.mocked(listEvents).mock.calls[0]![0]).toMatchObject({ q: 'tango', page: 2, per_page: 50 })
  })

  it('[AC-25] un fallo deja error legible, conserva la última página buena y no lanza', async () => {
    vi.mocked(listEvents).mockResolvedValueOnce(page(['a'], 1))
    const s = useCurationStore()
    await s.loadEvents({})
    vi.mocked(listEvents).mockRejectedValueOnce(new ApiError(503, 'Error 503'))
    await expect(s.loadEvents({ q: 'x' })).resolves.toBeUndefined()
    expect(s.error).toBe('Error 503')
    expect(s.events.map((e) => e.id)).toEqual(['a'])
    expect(s.loading).toBe(false)
    vi.mocked(listEvents).mockResolvedValueOnce(page(['b'], 1))
    await s.loadEvents({ q: 'x' })
    expect(s.error).toBeNull()
  })

  it('[AC-25] una respuesta tardía de una consulta anterior no pisa a la nueva', async () => {
    let resolveFirst!: (v: ReturnType<typeof page>) => void
    vi.mocked(listEvents)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(page(['nuevo'], 1))
    const s = useCurationStore()
    const first = s.loadEvents({ q: 'a' })
    await s.loadEvents({ q: 'ab' })
    resolveFirst(page(['viejo'], 1))
    await first
    expect(s.events.map((e) => e.id)).toEqual(['nuevo'])
    expect(s.loading).toBe(false)
  })

  it('loadPlaces usa el servicio de lugares', async () => {
    vi.mocked(listPlaces).mockResolvedValue({ items: [{ id: 'p1' } as never], total: 1, page: 1, perPage: 50 })
    const s = useCurationStore()
    await s.loadPlaces({ origen: ['osm'] })
    expect(s.places.map((p) => p.id)).toEqual(['p1'])
    expect(vi.mocked(listPlaces).mock.calls[0]![0]).toMatchObject({ origen: ['osm'] })
  })
})

describe('curation.store — exportación CSV', () => {
  it('[AC-29] recorre todas las páginas con los mismos filtros y per_page=100', async () => {
    vi.mocked(listEvents)
      .mockResolvedValueOnce(page(['1', '2'], 5, 1))
      .mockResolvedValueOnce(page(['3', '4'], 5, 2))
      .mockResolvedValueOnce(page(['5'], 5, 3))
    const s = useCurationStore()
    const rows = await s.exportAll('eventos', { q: 'tango', page: 7 })
    expect(rows?.map((r) => r.id)).toEqual(['1', '2', '3', '4', '5'])
    const calls = vi.mocked(listEvents).mock.calls.map((c) => c[0])
    expect(calls.map((c) => c.page)).toEqual([1, 2, 3])
    expect(calls.every((c) => c.per_page === 100 && c.q === 'tango')).toBe(true)
    expect(s.exporting).toBe(false)
    expect(s.exportError).toBeNull()
  })

  it('[AC-30] una página que falla no descarga nada: error, sin filas parciales', async () => {
    vi.mocked(listEvents)
      .mockResolvedValueOnce(page(['1', '2'], 4, 1))
      .mockRejectedValueOnce(new ApiError(500, 'Error 500'))
    const s = useCurationStore()
    s.events = [ev('visible')]
    expect(await s.exportAll('eventos', {})).toBeNull()
    expect(s.exportError).toBe('Error 500')
    expect(s.exporting).toBe(false)
    expect(s.events.map((e) => e.id)).toEqual(['visible'])
  })

  it('[AC-30] el total cambia entre páginas: se invalida el export', async () => {
    vi.mocked(listEvents)
      .mockResolvedValueOnce(page(['1', '2'], 4, 1))
      .mockResolvedValueOnce(page(['3', '4'], 5, 2))
    const s = useCurationStore()
    expect(await s.exportAll('eventos', {})).toBeNull()
    expect(s.exportError).toMatch(/cambiaron/)
  })

  it('[AC-30] tras deduplicar por id las filas no igualan el total: se invalida', async () => {
    vi.mocked(listEvents)
      .mockResolvedValueOnce(page(['1', '2'], 4, 1))
      .mockResolvedValueOnce(page(['2', '3'], 4, 2)) // un evento cambió de grupo: repite el 2 y omite el 4
    const s = useCurationStore()
    expect(await s.exportAll('eventos', {})).toBeNull()
    expect(s.exportError).toMatch(/cambiaron/)
  })

  it('[AC-29] se puede cancelar; reporta el progreso', async () => {
    let release!: (v: ReturnType<typeof page>) => void
    vi.mocked(listPlaces).mockImplementationOnce(() => new Promise((r) => (release = r)))
    const s = useCurationStore()
    const p = s.exportAll('lugares', {})
    expect(s.exporting).toBe(true)
    s.cancelExport()
    release({ items: [{ id: 'p1' } as never], total: 1, page: 1, perPage: 100 })
    expect(await p).toBeNull()
    expect(s.exporting).toBe(false)
    expect(s.exportError).toBeNull()
  })
})
