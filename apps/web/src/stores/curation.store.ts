import { defineStore } from 'pinia'
import type { CurationEvent, CurationPlace, EventSourceCount } from '@tript/shared'
import { listEventSources, listEvents, listPlaces, type ListPage } from '@/services/api'
import {
  EXPORT_PAGE_SIZE,
  eventsApiQuery,
  placesApiQuery,
  type EventsFilters,
  type PlacesFilters,
} from '@/lib/curation'

// Una consulta nueva cancela la anterior; una respuesta tardía o abortada se ignora.
let listController: AbortController | null = null
let exportController: AbortController | null = null

const CHANGED = 'Los datos cambiaron mientras se exportaba. Probá de nuevo.'

export const useCurationStore = defineStore('curation', {
  state: () => ({
    events: [] as CurationEvent[],
    places: [] as CurationPlace[],
    /** Total que cumple los filtros (todas las páginas): el `X-Total-Count` de la última carga. */
    total: 0,
    sources: [] as EventSourceCount[],
    loading: false,
    error: null as string | null,
    exporting: false,
    /** Páginas ya leídas / páginas totales del export en curso. */
    exportProgress: null as { done: number; total: number } | null,
    exportError: null as string | null,
  }),
  actions: {
    /** Al entrar a una pestaña no se arrastra el total ni las filas de la otra. */
    reset(): void {
      listController?.abort()
      this.events = []
      this.places = []
      this.total = 0
      this.error = null
      this.loading = false
    },

    async load<T>(request: (signal: AbortSignal) => Promise<ListPage<T>>, assign: (items: T[]) => void): Promise<void> {
      listController?.abort()
      const mine = (listController = new AbortController())
      this.loading = true
      this.error = null
      try {
        const page = await request(mine.signal)
        if (mine.signal.aborted) return
        assign(page.items)
        this.total = page.total
      } catch (e) {
        if (mine.signal.aborted) return
        // se conserva la última página buena
        this.error = e instanceof Error ? e.message : 'No pudimos cargar el listado'
      } finally {
        if (listController === mine) this.loading = false
      }
    },

    loadEvents(filters: EventsFilters): Promise<void> {
      return this.load(
        (signal) => listEvents(eventsApiQuery(filters), { signal }),
        (items) => (this.events = items),
      )
    },

    loadPlaces(filters: PlacesFilters): Promise<void> {
      return this.load(
        (signal) => listPlaces(placesApiQuery(filters), { signal }),
        (items) => (this.places = items),
      )
    },

    async loadSources(): Promise<void> {
      try {
        this.sources = await listEventSources()
      } catch {
        // el filtro de fuentes es una ayuda: sin la lista el listado sigue funcionando
        this.sources = []
      }
    },

    /**
     * Recorre todas las páginas del filtro (de a 100) y devuelve todas las filas, o `null` si falla, se cancela o los datos
     * cambiaron en el camino: no existe el archivo parcial. El orden depende del estado, que se recalcula en cada pedido,
     * así que se verifica que el total no cambie entre páginas y que, sin repetidos, las filas igualen ese total.
     */
    async exportAll(
      kind: 'eventos' | 'lugares',
      filters: EventsFilters | PlacesFilters,
    ): Promise<(CurationEvent | CurationPlace)[] | null> {
      exportController?.abort()
      const mine = (exportController = new AbortController())
      this.exporting = true
      this.exportError = null
      this.exportProgress = null
      try {
        const fetchPage = (page: number): Promise<ListPage<CurationEvent | CurationPlace>> => {
          const opts = { signal: mine.signal }
          return kind === 'eventos'
            ? listEvents({ ...eventsApiQuery(filters as EventsFilters, EXPORT_PAGE_SIZE), page }, opts)
            : listPlaces({ ...placesApiQuery(filters as PlacesFilters, EXPORT_PAGE_SIZE), page }, opts)
        }
        const byId = new Map<string, CurationEvent | CurationPlace>()
        let total = 0
        let read = 0
        let pageLen = 1
        for (let page = 1; ; page++) {
          const res = await fetchPage(page)
          if (mine.signal.aborted) return null
          if (page === 1) {
            total = res.total
            pageLen = Math.max(1, res.items.length)
          } else if (res.total !== total) return this.invalidExport()
          for (const row of res.items) byId.set(row.id, row)
          read += res.items.length
          this.exportProgress = { done: page, total: Math.max(page, Math.ceil(total / pageLen)) }
          if (read >= total || res.items.length === 0) break
        }
        if (byId.size !== total) return this.invalidExport()
        return [...byId.values()]
      } catch (e) {
        if (mine.signal.aborted) return null
        this.exportError = e instanceof Error ? e.message : 'No pudimos exportar'
        return null
      } finally {
        if (exportController === mine) {
          this.exporting = false
          this.exportProgress = null
        }
      }
    },

    invalidExport(): null {
      this.exportError = CHANGED
      return null
    },

    cancelExport(): void {
      exportController?.abort()
      this.exporting = false
      this.exportProgress = null
    },
  },
})
