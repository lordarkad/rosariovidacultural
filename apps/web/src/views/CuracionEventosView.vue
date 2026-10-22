<template>
  <CuracionShell>
    <!-- Filtros: la URL es la fuente de verdad (compartible, Atrás funciona) -->
    <form class="mt-5 space-y-3" role="search" aria-label="Filtrar eventos" @submit.prevent>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block min-w-64 flex-1 text-sm font-semibold">
          Buscar
          <input
            type="search"
            v-model="draft"
            maxlength="100"
            placeholder="Título, sede, dirección o fuente"
            class="mt-1 block w-full rounded-input border border-line-strong bg-surface-card px-3 py-2 font-normal"
            @input="onSearch(draft)"
          />
        </label>
        <Button label="Exportar CSV" :disabled="store.total === 0 || store.exporting" @click="exportCsv">
          <template #default>Exportar CSV ({{ store.total }})</template>
        </Button>
      </div>

      <fieldset class="flex flex-wrap gap-x-5 gap-y-1">
        <legend class="rq-meta mb-1">Estado</legend>
        <label v-for="o in ESTADOS" :key="o.value" class="rq-check">
          <input type="checkbox" class="rq-check-box" :checked="filters.estado?.includes(o.value)" @change="toggle('estado', o.value)" />
          {{ o.label }}
        </label>
      </fieldset>

      <details class="rounded-card border border-line bg-surface-card p-3" :open="!!filters.fuente?.length">
        <summary class="cursor-pointer text-sm font-semibold">Fuente</summary>
        <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <label v-for="s in store.sources" :key="s.name" class="rq-check">
            <input type="checkbox" class="rq-check-box" :checked="filters.fuente?.includes(s.name)" @change="toggle('fuente', s.name)" />
            {{ s.name }} <span class="text-ink-muted">({{ s.count }})</span>
          </label>
          <p v-if="!store.sources.length" class="text-sm text-ink-muted">Sin fuentes para mostrar.</p>
        </div>
      </details>

      <fieldset class="flex flex-wrap gap-x-5 gap-y-1">
        <legend class="rq-meta mb-1">Faltan</legend>
        <label v-for="o in EVENT_MISSING" :key="o.value" class="rq-check">
          <input type="checkbox" class="rq-check-box" :checked="filters.faltan?.includes(o.value)" @change="toggle('faltan', o.value)" />
          {{ o.label }}
        </label>
      </fieldset>
    </form>

    <!-- Exportación -->
    <p v-if="store.exporting" class="mt-3 text-sm" role="status">
      Exportando… {{ store.exportProgress ? `${store.exportProgress.done}/${store.exportProgress.total}` : '' }}
      <Button label="Cancelar" variant="text" size="small" @click="store.cancelExport()" />
    </p>
    <div v-if="store.exportError" role="alert" class="mt-3 rounded-card bg-[var(--rq-danger-bg)] p-3 text-sm text-[var(--rq-danger-text)]">
      {{ store.exportError }}
      <Button label="Reintentar" size="small" class="ml-2" @click="exportCsv" />
    </div>

    <!-- Estados -->
    <div v-if="store.loading && !store.events.length" class="mt-6 space-y-2" role="status">
      <span class="sr-only">Cargando eventos…</span>
      <Skeleton v-for="n in 8" :key="n" height="2.25rem" />
    </div>
    <div v-else-if="store.error && !store.events.length" role="alert" class="mt-6 rounded-card bg-[var(--rq-danger-bg)] p-4 text-[var(--rq-danger-text)]">
      <p>No pudimos cargar el listado. {{ store.error }}</p>
      <Button label="Reintentar" class="mt-3" @click="store.loadEvents(filters)" />
    </div>
    <div v-else-if="!store.events.length" class="mt-6 rounded-card border border-line bg-surface-card p-6" role="status">
      <template v-if="filtered">
        <p class="font-semibold">Sin resultados</p>
        <p class="mt-1 text-sm text-ink-muted">Ningún evento cumple estos filtros.</p>
        <Button label="Limpiar filtros" variant="outlined" class="mt-3" @click="clear" />
      </template>
      <p v-else>Todavía no hay eventos cargados.</p>
    </div>

    <template v-if="store.events.length">
      <p v-if="store.error" role="alert" class="mt-4 text-sm text-[var(--rq-danger-text)]">
        No pudimos actualizar el listado: {{ store.error }}
        <Button label="Reintentar" variant="text" size="small" @click="store.loadEvents(filters)" />
      </p>
      <div class="mt-4 overflow-x-auto" :aria-busy="store.loading">
        <table class="curacion-table w-full text-left text-sm">
          <caption class="sr-only">Eventos cargados</caption>
          <thead class="hidden md:table-header-group">
            <tr class="border-b border-line-strong">
              <th v-for="h in HEADS" :key="h" scope="col" class="px-2 py-2 font-semibold">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="e in store.events"
              :key="e.id"
              :data-estado="e.estado"
              class="block border-b border-line md:table-row"
              :class="e.estado === 'vigente' ? '' : 'text-ink-muted'"
            >
              <td data-label="Fecha" class="px-2 py-1.5">{{ fechaLabel(e.start_date, e.end_date) }}</td>
              <td data-label="Hora" class="px-2 py-1.5">{{ e.start_time ?? '—' }}</td>
              <td data-label="Título" class="px-2 py-1.5 font-semibold">
                <a :href="`/e/${e.id}`" target="_blank" rel="noopener noreferrer" class="underline decoration-ink underline-offset-4">{{ e.title }}</a>
              </td>
              <td data-label="Lugar" class="px-2 py-1.5">{{ lugar(e) }}</td>
              <td data-label="Fuente" class="px-2 py-1.5">
                {{ e.source_name }}
                <span v-if="e.sources.length > 1" class="text-ink-muted">+{{ e.sources.length - 1 }} {{ e.sources.length > 2 ? 'vías' : 'vía' }}</span>
              </td>
              <td data-label="Precio" class="px-2 py-1.5">{{ precioLabel(e.price_status, e.price_from_ars) }}</td>
              <td data-label="Estado" class="px-2 py-1.5">
                <span class="rounded-tag border border-line-strong px-1.5 py-0.5 text-xs font-semibold">{{ estadoLabel(e.estado) }}</span>
              </td>
              <td data-label="Visto" class="px-2 py-1.5">{{ vistoLabel(e.last_seen_at) }}</td>
              <td data-label="Faltan" class="px-2 py-1.5">
                <span v-for="m in e.missing" :key="m" class="mr-1 inline-block rounded-tag bg-primary-soft px-1.5 py-0.5 text-xs">{{ eventMissingLabel(m).toLowerCase() }}</span>
                <span v-if="!e.missing.length" class="text-ink-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <CuracionPager :page="filters.page ?? 1" :total="store.total" :per-page="PAGE_SIZE" @go="goTo" />
    </template>
  </CuracionShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import type { CurationEvent } from '@tript/shared'
import CuracionPager from '@/components/CuracionPager.vue'
import CuracionShell from '@/components/CuracionShell.vue'
import {
  ESTADOS,
  EVENT_CSV_COLUMNS,
  EVENT_MISSING,
  PAGE_SIZE,
  buildCsv,
  csvFileName,
  downloadCsv,
  estadoLabel,
  eventMissingLabel,
  fechaLabel,
  filtersToQuery,
  hasFilters,
  parseEventsFilters,
  precioLabel,
  vistoLabel,
  type EventsFilters,
} from '@/lib/curation'
import { useCurationStore } from '@/stores/curation.store'

const HEADS = ['Fecha', 'Hora', 'Título', 'Lugar', 'Fuente', 'Precio', 'Estado', 'Visto', 'Faltan']

const route = useRoute()
const router = useRouter()
const store = useCurationStore()

const filters = computed(() => parseEventsFilters(route.query))
const filtered = computed(() => hasFilters(filters.value))

const lugar = (e: CurationEvent): string =>
  e.missing.includes('lugar') ? '— sin lugar' : (e.venue_name ?? e.place?.name ?? e.address ?? '—')

/** Cambiar cualquier filtro vuelve a la página 1. */
function apply(patch: Partial<EventsFilters>): void {
  const next = { ...filters.value, ...patch, page: 1 }
  void router.push({ query: filtersToQuery(next) })
}

type ListKey = 'estado' | 'fuente' | 'faltan'
function toggle(key: ListKey, value: string): void {
  const current = (filters.value[key] ?? []) as string[]
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  apply({ [key]: next } as Partial<EventsFilters>)
}

// El texto que se está escribiendo vive acá: la URL lo recibe con retraso y recortado, y no debe pisar el input.
const draft = ref(filters.value.q ?? '')
// `sent` es lo último que este campo mandó a la URL: la URL que vuelve con retraso no pisa lo que se sigue
// escribiendo; solo un cambio externo (Atrás, «Limpiar filtros») sobrescribe el campo.
let sent = filters.value.q ?? ''
watch(
  () => filters.value.q,
  (q) => {
    if ((q ?? '') !== sent) {
      sent = q ?? ''
      draft.value = sent
    }
  },
)

let timer: ReturnType<typeof setTimeout> | undefined
function onSearch(value: string): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    sent = value.trim()
    apply({ q: sent || undefined })
  }, 300)
}

function clear(): void {
  clearTimeout(timer)
  void router.push({ query: {} })
}
function goTo(page: number): void {
  clearTimeout(timer)
  void router.push({ query: filtersToQuery({ ...filters.value, page }) })
}

async function exportCsv(): Promise<void> {
  const rows = (await store.exportAll('eventos', filters.value)) as CurationEvent[] | null
  if (rows) downloadCsv(csvFileName('eventos'), buildCsv(EVENT_CSV_COLUMNS, rows))
}

store.reset()
watch(() => route.query, () => void store.loadEvents(filters.value), { immediate: true })
onMounted(() => {
  document.title = 'Curación · Eventos'
  void store.loadSources()
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  store.cancelExport()
})
</script>

<style scoped>
@media (max-width: 767px) {
  .curacion-table td {
    display: flex;
    gap: 0.5rem;
  }
  .curacion-table td::before {
    content: attr(data-label);
    min-width: 5rem;
    font-size: var(--rq-meta-size);
    color: var(--rq-text-muted);
  }
}
</style>
