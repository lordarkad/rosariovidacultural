import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/api', () => ({ listZones: vi.fn() }))

import { listZones } from '@/services/api'
import { useZonesStore } from '@/stores/zones.store'

const zona = { id: 'centro', name: 'Centro', kind: 'barrio', lat: -32.95, lon: -60.64, radio_m: 800 } as const

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(listZones).mockReset()
})

describe('zones.store', () => {
  it('carga las zonas y apaga loading', async () => {
    vi.mocked(listZones).mockResolvedValue([zona as never])
    const store = useZonesStore()
    const p = store.fetchZones()
    expect(store.loading).toBe(true)
    await p
    expect(store.items).toEqual([zona])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('no vuelve a pedirlas una vez cargadas, salvo con force', async () => {
    vi.mocked(listZones).mockResolvedValue([zona as never])
    const store = useZonesStore()
    await store.fetchZones()
    await store.fetchZones()
    expect(listZones).toHaveBeenCalledTimes(1)
    await store.fetchZones(true)
    expect(listZones).toHaveBeenCalledTimes(2)
  })

  it('un error queda en `error`, no se lanza, y loading vuelve a false', async () => {
    vi.mocked(listZones).mockRejectedValue(new Error('sin red'))
    const store = useZonesStore()
    await expect(store.fetchZones()).resolves.toBeUndefined()
    expect(store.error).toBe('sin red')
    expect(store.loading).toBe(false)
    expect(store.loaded).toBe(false)
  })

  it('tras un error se puede reintentar', async () => {
    vi.mocked(listZones).mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce([zona as never])
    const store = useZonesStore()
    await store.fetchZones()
    await store.fetchZones()
    expect(store.items).toEqual([zona])
    expect(store.error).toBeNull()
  })
})
