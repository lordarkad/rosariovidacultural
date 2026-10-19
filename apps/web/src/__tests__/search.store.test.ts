import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SearchItem } from '@tript/shared'

vi.mock('@/services/api', () => ({ searchItems: vi.fn() }))

import { searchItems } from '@/services/api'
import { useSearchStore } from '@/stores/search.store'

const it1 = (id: string) => ({ kind: 'event', id, band: 'hoy' }) as unknown as SearchItem
const page = (ids: string[], total: number, p = 1) => ({ items: ids.map(it1), total, page: p, perPage: 20 })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(searchItems).mockReset()
})

describe('search.store', () => {
  it('run: carga la primera página con loading y la deja en el store', async () => {
    vi.mocked(searchItems).mockResolvedValue(page(['a', 'b'], 2))
    const s = useSearchStore()
    const p = s.run({ cuando: 'hoy' })
    expect(s.loading).toBe(true)
    await p
    expect(s.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.hasMore).toBe(false)
    expect(vi.mocked(searchItems).mock.calls[0]![0]).toMatchObject({ cuando: 'hoy', page: 1, per_page: 20 })
  })

  it('error: queda en `error`, no se lanza y loading vuelve a false', async () => {
    vi.mocked(searchItems).mockRejectedValue(new Error('sin red'))
    const s = useSearchStore()
    await expect(s.run({})).resolves.toBeUndefined()
    expect(s.error).toBe('sin red')
    expect(s.loading).toBe(false)
  })

  it('loadMore: agrega la página siguiente sin duplicar ítems', async () => {
    vi.mocked(searchItems).mockResolvedValueOnce(page(['a', 'b'], 3)).mockResolvedValueOnce(page(['b', 'c'], 3, 2))
    const s = useSearchStore()
    await s.run({})
    expect(s.hasMore).toBe(true)
    await s.loadMore()
    expect(s.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(vi.mocked(searchItems).mock.calls[1]![0]).toMatchObject({ page: 2 })
    expect(s.loadingMore).toBe(false)
  })

  it('loadMore sin más páginas no pide nada', async () => {
    vi.mocked(searchItems).mockResolvedValue(page(['a'], 1))
    const s = useSearchStore()
    await s.run({})
    await s.loadMore()
    expect(searchItems).toHaveBeenCalledTimes(1)
  })

  it('loadMore con error conserva la lista y permite reintentar', async () => {
    vi.mocked(searchItems)
      .mockResolvedValueOnce(page(['a'], 2))
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(page(['b'], 2, 2))
    const s = useSearchStore()
    await s.run({})
    await s.loadMore()
    expect(s.error).toBe('sin red')
    expect(s.items).toHaveLength(1)
    await s.loadMore()
    expect(s.error).toBeNull()
    expect(s.items).toHaveLength(2)
  })

  it('una búsqueda nueva cancela la anterior y su respuesta tardía no pisa a la nueva', async () => {
    let resolveFirst!: (v: ReturnType<typeof page>) => void
    vi.mocked(searchItems)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(page(['nueva'], 1))
    const s = useSearchStore()
    const first = s.run({ cuando: 'hoy' })
    await s.run({ cuando: 'manana' })
    resolveFirst(page(['vieja'], 1))
    await first
    expect(s.items.map((i) => i.id)).toEqual(['nueva'])
    expect(s.loading).toBe(false)
    expect(vi.mocked(searchItems).mock.calls[0]![1]!.signal!.aborted).toBe(true)
  })
})
