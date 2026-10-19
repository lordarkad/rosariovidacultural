import { defineStore } from 'pinia'
import type { EventDetail } from '@tript/shared'
import { ApiError, getEvent } from '@/services/api'
import type { Origin } from '@/lib/detail'

let controller: AbortController | null = null

export const useDetailStore = defineStore('detail', {
  state: () => ({
    event: null as EventDetail | null,
    /** 404 o 400: el evento venció, no existe o el id es inválido (S4-14). Distinto de `error`. */
    notFound: false,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    /** Pedir otro id cancela la request anterior; una respuesta tardía o abortada se ignora (S4-15). */
    async load(id: string, origin?: Origin | null): Promise<void> {
      controller?.abort()
      const mine = (controller = new AbortController())
      this.loading = true
      this.error = null
      this.notFound = false
      this.event = null
      try {
        const event = await getEvent(id, origin, { signal: mine.signal })
        if (mine.signal.aborted) return
        this.event = event
      } catch (e) {
        if (mine.signal.aborted) return
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) this.notFound = true
        else this.error = e instanceof Error ? e.message : 'No pudimos cargar el evento'
      } finally {
        if (controller === mine) this.loading = false
      }
    },
  },
})
