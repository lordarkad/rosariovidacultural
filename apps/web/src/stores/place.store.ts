import { defineStore } from 'pinia'
import type { PlaceDetail } from '@tript/shared'
import { ApiError, getPlace } from '@/services/api'
import type { Origin } from '@/lib/detail'

let controller: AbortController | null = null

export const usePlaceStore = defineStore('place', {
  state: () => ({
    place: null as PlaceDetail | null,
    /** 404 o 400: el lugar no existe o el id es inválido (L-11). Distinto de `error`. */
    notFound: false,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    /** Pedir otro id cancela la request anterior; una respuesta tardía o abortada se ignora (L-12). */
    async load(id: string, origin?: Origin | null): Promise<void> {
      controller?.abort()
      const mine = (controller = new AbortController())
      this.loading = true
      this.error = null
      this.notFound = false
      this.place = null
      try {
        const place = await getPlace(id, origin, { signal: mine.signal })
        if (mine.signal.aborted) return
        this.place = place
      } catch (e) {
        if (mine.signal.aborted) return
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) this.notFound = true
        else this.error = e instanceof Error ? e.message : 'No pudimos cargar el lugar'
      } finally {
        if (controller === mine) this.loading = false
      }
    },
  },
})
