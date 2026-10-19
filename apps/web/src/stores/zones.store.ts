import { defineStore } from 'pinia'
import type { Zone } from '@tript/shared'
import { listZones } from '@/services/api'

export const useZonesStore = defineStore('zones', {
  state: () => ({
    items: [] as Zone[],
    loaded: false,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    /** Las zonas casi no cambian: se piden una sola vez por sesión (`force` para reintentar). */
    async fetchZones(force = false): Promise<void> {
      if (this.loading || (this.loaded && !force)) return
      this.loading = true
      this.error = null
      try {
        this.items = await listZones()
        this.loaded = true
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'No pudimos cargar las zonas'
      } finally {
        this.loading = false
      }
    },
  },
})
