import { defineStore } from 'pinia'
import type { SearchPin } from '@tript/shared'
import { searchPins, type SearchQuery } from '@/services/api'

let controller: AbortController | null = null

export const usePinsStore = defineStore('pins', {
  state: () => ({
    pins: [] as SearchPin[],
    total: 0,
    /** Hay más pins de los devueltos: se acota con `bbox` al mover el mapa (D-7). */
    truncated: false,
    /** Sube con cada búsqueda completa (sin `bbox`): es la señal para reencuadrar el mapa. */
    version: 0,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    /** Pins de la misma búsqueda que la lista; la consulta nueva cancela la anterior. */
    async run(query: SearchQuery, bbox?: string): Promise<void> {
      controller?.abort()
      const mine = (controller = new AbortController())
      this.loading = true
      this.error = null
      try {
        const res = await searchPins({ ...query, bbox }, { signal: mine.signal })
        if (mine.signal.aborted) return
        this.pins = res.pins
        this.total = res.total
        this.truncated = res.truncated
        if (bbox === undefined) this.version++
      } catch (e) {
        if (mine.signal.aborted) return
        this.error = e instanceof Error ? e.message : 'No pudimos cargar el mapa'
      } finally {
        if (controller === mine) this.loading = false
      }
    },

    clear(): void {
      controller?.abort()
      controller = null
      this.pins = []
      this.total = 0
      this.truncated = false
      this.loading = false
      this.error = null
    },
  },
})
