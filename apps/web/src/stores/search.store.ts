import { defineStore } from 'pinia'
import type { SearchItem } from '@tript/shared'
import { searchItems, type SearchQuery } from '@/services/api'

const PER_PAGE = 20

let controller: AbortController | null = null

export const useSearchStore = defineStore('search', {
  state: () => ({
    items: [] as SearchItem[],
    total: 0,
    page: 0,
    query: null as SearchQuery | null,
    loading: false,
    loadingMore: false,
    error: null as string | null,
  }),
  getters: {
    hasMore: (s): boolean => s.items.length < s.total,
  },
  actions: {
    /** Búsqueda nueva: cancela la anterior y reemplaza la lista. */
    async run(query: SearchQuery): Promise<void> {
      controller?.abort()
      const mine = (controller = new AbortController())
      this.query = query
      this.loading = true
      this.loadingMore = false
      this.error = null
      this.items = []
      this.total = 0
      this.page = 0
      try {
        const res = await searchItems({ ...query, page: 1, per_page: PER_PAGE }, { signal: mine.signal })
        if (mine.signal.aborted) return
        this.items = res.items
        this.total = res.total
        this.page = res.page
      } catch (e) {
        if (mine.signal.aborted) return
        this.error = e instanceof Error ? e.message : 'No pudimos cargar los resultados'
      } finally {
        if (controller === mine) this.loading = false
      }
    },

    /** Página siguiente de la misma búsqueda (S2: «Ver más»). */
    async loadMore(): Promise<void> {
      if (!this.query || this.loading || this.loadingMore || !this.hasMore) return
      const mine = controller
      const signal = mine?.signal
      this.loadingMore = true
      this.error = null
      try {
        const res = await searchItems({ ...this.query, page: this.page + 1, per_page: PER_PAGE }, { signal })
        if (signal?.aborted) return
        const seen = new Set(this.items.map((i) => `${i.kind}:${i.id}`))
        this.items = [...this.items, ...res.items.filter((i) => !seen.has(`${i.kind}:${i.id}`))]
        this.total = res.total
        this.page = res.page
      } catch (e) {
        if (signal?.aborted) return
        this.error = e instanceof Error ? e.message : 'No pudimos cargar más resultados'
      } finally {
        if (controller === mine) this.loadingMore = false
      }
    },
  },
})
