import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { EventDetail } from '@tript/shared'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api')
  return { ...actual, getEvent: vi.fn() }
})

import { ApiError, getEvent } from '@/services/api'
import { useDetailStore } from '@/stores/detail.store'

const ev = (id: string) => ({ id, title: `Evento ${id}` }) as unknown as EventDetail

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(getEvent).mockReset()
})

describe('detail.store', () => {
  it('[AC-5] load: loading, deja el evento y reenvía el origen', async () => {
    vi.mocked(getEvent).mockResolvedValue(ev('a'))
    const s = useDetailStore()
    const p = s.load('a', { lat: -32.9, lon: -60.6 })
    expect(s.loading).toBe(true)
    await p
    expect(s.event?.id).toBe('a')
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.notFound).toBe(false)
    expect(vi.mocked(getEvent).mock.calls[0]![1]).toEqual({ lat: -32.9, lon: -60.6 })
  })

  it('[AC-5] 404 y 400 son notFound, no error', async () => {
    const s = useDetailStore()
    vi.mocked(getEvent).mockRejectedValueOnce(new ApiError(404, 'No encontrado'))
    await s.load('x')
    expect(s.notFound).toBe(true)
    expect(s.error).toBeNull()
    expect(s.event).toBeNull()

    vi.mocked(getEvent).mockRejectedValueOnce(new ApiError(400, 'Id inválido'))
    await s.load('y')
    expect(s.notFound).toBe(true)
    expect(s.error).toBeNull()
  })

  it('[AC-5] red o 5xx son error, no notFound; loading vuelve a false y no se lanza', async () => {
    const s = useDetailStore()
    vi.mocked(getEvent).mockRejectedValueOnce(new ApiError(503, 'Error 503'))
    await expect(s.load('x')).resolves.toBeUndefined()
    expect(s.error).toBe('Error 503')
    expect(s.notFound).toBe(false)
    expect(s.loading).toBe(false)

    vi.mocked(getEvent).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await s.load('x')
    expect(s.error).toBe('Failed to fetch')
    expect(s.notFound).toBe(false)
  })

  it('[AC-5] pedir otro id cancela la request anterior y su respuesta tardía se ignora', async () => {
    let resolveFirst!: (v: EventDetail) => void
    vi.mocked(getEvent)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(ev('b'))
    const s = useDetailStore()
    const first = s.load('a')
    await s.load('b')
    resolveFirst(ev('a'))
    await first
    expect(s.event?.id).toBe('b')
    expect(s.loading).toBe(false)
    expect(vi.mocked(getEvent).mock.calls[0]![2]!.signal!.aborted).toBe(true)
  })

  it('[AC-5] un error de la request cancelada no pisa a la nueva', async () => {
    let rejectFirst!: (e: unknown) => void
    vi.mocked(getEvent)
      .mockImplementationOnce(() => new Promise((_, r) => (rejectFirst = r)))
      .mockResolvedValueOnce(ev('b'))
    const s = useDetailStore()
    const first = s.load('a')
    await s.load('b')
    rejectFirst(new ApiError(404, 'x'))
    await first
    expect(s.event?.id).toBe('b')
    expect(s.notFound).toBe(false)
  })

  it('[AC-5] al cambiar de id se limpia el evento anterior y los estados', async () => {
    const s = useDetailStore()
    vi.mocked(getEvent).mockResolvedValueOnce(ev('a'))
    await s.load('a')
    vi.mocked(getEvent).mockRejectedValueOnce(new ApiError(404, 'x'))
    await s.load('b')
    expect(s.event).toBeNull()
    vi.mocked(getEvent).mockResolvedValueOnce(ev('c'))
    await s.load('c')
    expect(s.notFound).toBe(false)
    expect(s.event?.id).toBe('c')
  })
})
