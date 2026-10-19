import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PlaceDetail } from '@tript/shared'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api')
  return { ...actual, getPlace: vi.fn() }
})

import { ApiError, getPlace } from '@/services/api'
import { usePlaceStore } from '@/stores/place.store'

const pl = (id: string) => ({ id, name: `Lugar ${id}` }) as unknown as PlaceDetail

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(getPlace).mockReset()
})

describe('place.store', () => {
  it('[AC-4] load: loading, deja el lugar y reenvía el origen', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    const s = usePlaceStore()
    const p = s.load('a', { lat: -32.9, lon: -60.6 })
    expect(s.loading).toBe(true)
    await p
    expect(s.place?.id).toBe('a')
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.notFound).toBe(false)
    expect(vi.mocked(getPlace).mock.calls[0]![1]).toEqual({ lat: -32.9, lon: -60.6 })
  })

  it('[AC-4] 404 y 400 son notFound, no error', async () => {
    const s = usePlaceStore()
    vi.mocked(getPlace).mockRejectedValueOnce(new ApiError(404, 'No encontrado'))
    await s.load('x')
    expect(s.notFound).toBe(true)
    expect(s.error).toBeNull()
    expect(s.place).toBeNull()

    vi.mocked(getPlace).mockRejectedValueOnce(new ApiError(400, 'Id inválido'))
    await s.load('y')
    expect(s.notFound).toBe(true)
    expect(s.error).toBeNull()
  })

  it('[AC-4] red o 5xx son error, no notFound; loading vuelve a false y no se lanza', async () => {
    const s = usePlaceStore()
    vi.mocked(getPlace).mockRejectedValueOnce(new ApiError(503, 'Error 503'))
    await expect(s.load('x')).resolves.toBeUndefined()
    expect(s.error).toBe('Error 503')
    expect(s.notFound).toBe(false)
    expect(s.loading).toBe(false)

    vi.mocked(getPlace).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await s.load('x')
    expect(s.error).toBe('Failed to fetch')
    expect(s.notFound).toBe(false)
  })

  it('[AC-4] pedir otro id cancela la request anterior y su respuesta tardía se ignora', async () => {
    let resolveFirst!: (v: PlaceDetail) => void
    vi.mocked(getPlace)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(pl('b'))
    const s = usePlaceStore()
    const first = s.load('a')
    await s.load('b')
    resolveFirst(pl('a'))
    await first
    expect(s.place?.id).toBe('b')
    expect(s.loading).toBe(false)
    expect(vi.mocked(getPlace).mock.calls[0]![2]!.signal!.aborted).toBe(true)
  })

  it('[AC-4] un error de la request cancelada no pisa a la nueva', async () => {
    let rejectFirst!: (e: unknown) => void
    vi.mocked(getPlace)
      .mockImplementationOnce(() => new Promise((_, r) => (rejectFirst = r)))
      .mockResolvedValueOnce(pl('b'))
    const s = usePlaceStore()
    const first = s.load('a')
    await s.load('b')
    rejectFirst(new ApiError(404, 'x'))
    await first
    expect(s.place?.id).toBe('b')
    expect(s.notFound).toBe(false)
  })

  it('[AC-4] al cambiar de id se limpia el lugar anterior y los estados', async () => {
    const s = usePlaceStore()
    vi.mocked(getPlace).mockResolvedValueOnce(pl('a'))
    await s.load('a')
    vi.mocked(getPlace).mockRejectedValueOnce(new ApiError(404, 'x'))
    await s.load('b')
    expect(s.place).toBeNull()
    vi.mocked(getPlace).mockResolvedValueOnce(pl('c'))
    await s.load('c')
    expect(s.notFound).toBe(false)
    expect(s.place?.id).toBe('c')
  })
})
