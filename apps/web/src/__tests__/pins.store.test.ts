import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SearchPin } from '@tript/shared'

vi.mock('@/services/api', () => ({ searchPins: vi.fn() }))

import { searchPins } from '@/services/api'
import { usePinsStore } from '@/stores/pins.store'

const pin = (id: string) => ({ kind: 'event', id, title: id, lat: -32.9, lon: -60.6 }) as SearchPin
const result = (ids: string[], total = ids.length, truncated = false) => ({ pins: ids.map(pin), total, truncated })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(searchPins).mockReset()
})

describe('pins.store', () => {
  it('[AC-5] run: carga los pins con loading y guarda total y truncado', async () => {
    vi.mocked(searchPins).mockResolvedValue(result(['a', 'b'], 140, true))
    const s = usePinsStore()
    const p = s.run({ cuando: 'hoy' })
    expect(s.loading).toBe(true)
    await p
    expect(s.pins.map((x) => x.id)).toEqual(['a', 'b'])
    expect(s.total).toBe(140)
    expect(s.truncated).toBe(true)
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
  })

  it('[AC-5] version sube con la búsqueda completa y no con las acotadas por bbox', async () => {
    vi.mocked(searchPins).mockResolvedValue(result(['a']))
    const s = usePinsStore()
    await s.run({})
    expect(s.version).toBe(1)
    await s.run({}, '-60.7,-33,-60.6,-32.9')
    expect(s.version).toBe(1)
    await s.run({ gratis: true })
    expect(s.version).toBe(2)
  })

  it('[AC-5] pasa el bbox al servicio', async () => {
    vi.mocked(searchPins).mockResolvedValue(result([]))
    await usePinsStore().run({ cuando: 'hoy' }, '-60.7,-33,-60.6,-32.9')
    expect(vi.mocked(searchPins).mock.calls[0]![0]).toMatchObject({ cuando: 'hoy', bbox: '-60.7,-33,-60.6,-32.9' })
  })

  it('[AC-5] error: queda en `error`, no se lanza', async () => {
    vi.mocked(searchPins).mockRejectedValue(new Error('sin red'))
    const s = usePinsStore()
    await expect(s.run({})).resolves.toBeUndefined()
    expect(s.error).toBe('sin red')
    expect(s.loading).toBe(false)
  })

  it('[AC-5] una respuesta tardía de una consulta anterior se ignora', async () => {
    let resolveFirst!: (v: ReturnType<typeof result>) => void
    vi.mocked(searchPins)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(result(['nuevo']))
    const s = usePinsStore()
    const first = s.run({ cuando: 'hoy' })
    await s.run({ cuando: 'manana' })
    resolveFirst(result(['viejo']))
    await first
    expect(s.pins.map((x) => x.id)).toEqual(['nuevo'])
  })

  it('[AC-5] un error de una consulta cancelada no pisa el estado', async () => {
    let rejectFirst!: (e: Error) => void
    vi.mocked(searchPins)
      .mockImplementationOnce(() => new Promise((_, rej) => (rejectFirst = rej)))
      .mockResolvedValueOnce(result(['ok']))
    const s = usePinsStore()
    const first = s.run({})
    await s.run({ gratis: true })
    rejectFirst(new Error('abortada'))
    await first
    expect(s.error).toBeNull()
    expect(s.pins).toHaveLength(1)
  })

  it('[AC-5] clear: vacía los pins y cancela lo pendiente', async () => {
    vi.mocked(searchPins).mockResolvedValue(result(['a']))
    const s = usePinsStore()
    await s.run({})
    s.clear()
    expect(s.pins).toEqual([])
    expect(s.total).toBe(0)
  })
})
