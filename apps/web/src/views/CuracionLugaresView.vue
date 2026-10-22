<template>
  <CuracionShell>
    <form class="mt-5 space-y-3" role="search" aria-label="Filtrar lugares" @submit.prevent>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block min-w-64 flex-1 text-sm font-semibold">
          Buscar
          <input
            type="search"
            v-model="draft"
            maxlength="100"
            placeholder="Nombre o dirección"
            class="mt-1 block w-full rounded-input border border-line-strong bg-surface-card px-3 py-2 font-normal"
            @input="onSearch(draft)"
          />
        </label>
        <Button label="Exportar CSV" :disabled="store.total === 0 || store.exporting" @click="exportCsv">
          <template #default>Exportar CSV ({{ store.total }})</template>
        </Button>
      </div>

      <fieldset class="flex flex-wrap gap-x-5 gap-y-1">
        <legend class="rq-meta mb-1">Origen</legend>
        <label v-for="o in ORIGENES" :key="o.value" class="rq-check">
          <input type="checkbox" class="rq-check-box" :checked="filters.origen?.includes(o.value)" @change="toggle('origen', o.value)" />
          {{ o.label }}
        </label>
      </fieldset>

      <fieldset class="flex flex-wrap gap-x-5 gap-y-1">
        <legend class="rq-meta mb-1">Tipo</legend>
        <label v-for="o in TIPOS" :key="o.value" class="rq-check">
          <input type="checkbox" class="rq-check-box" :checked="filters.tipo?.includes(o.value)" @change="toggle('tipo', o.value)" />
          {{ o.label }}
        </label>
      </fieldset>

      <fieldset class="flex flex-wrap gap-x-5 gap-y-1">
        <legend class="rq-meta mb-1">Faltan</legend>
        <label v-for="o in PLACE_MISSING" :key="o.value" class="rq-check">
          <input type="checkbox" class="rq-check-box" :checked="filters.faltan?.includes(o.value)" @change="toggle('faltan', o.value)" />
          {{ o.label }}
        </label>
      </fieldset>
    </form>

    <p v-if="store.exporting" class="mt-3 text-sm" role="status">
      Exportando… {{ store.exportProgress ? `${store.exportProgress.done}/${store.exportProgress.total}` : '' }}
      <Button label="Cancelar" variant="text" size="small" @click="store.cancelExport()" />
    </p>
    <div v-if="store.exportError" role="alert" class="mt-3 rounded-card bg-[var(--rq-danger-bg)] p-3 text-sm text-[var(--rq-danger-text)]">
      {{ store.exportError }}
      <Button label="Reintentar" size="small" class="ml-2" @click="exportCsv" />
    </div>

    <div v-if="store.loading && !store.places.length" class="mt-6 space-y-2" role="status">
      <span class="sr-only">Cargando lugares…</span>
      <Skeleton v-for="n in 8" :key="n" height="2.25rem" />
    </div>
    <div v-else-if="store.error && !store.places.length" role="alert" class="mt-6 rounded-card bg-[var(--rq-danger-bg)] p-4 text-[var(--rq-danger-text)]">
      <p>No pudimos cargar el listado. {{ store.error }}</p>
      <Button label="Reintentar" class="mt-3" @click="store.loadPlaces(filters)" />
    </div>
    <div v-else-if="!store.places.length" class="mt-6 rounded-card border border-line bg-surface-card p-6" role="status">
      <template v-if="filtered">
        <p class="font-semibold">Sin resultados</p>
        <p class="mt-1 text-sm text-ink-muted">Ningún lugar cumple estos filtros.</p>
        <Button label="Limpiar filtros" variant="outlined" class="mt-3" @click="clear" />
      </template>
      <p v-else>Todavía no hay lugares cargados.</p>
    </div>

    <template v-if="store.places.length">
      <p v-if="store.error" role="alert" class="mt-4 text-sm text-[var(--rq-danger-text)]">
        No pudimos actualizar el listado: {{ store.error }}
        <Button label="Reintentar" variant="text" size="small" @click="store.loadPlaces(filters)" />
      </p>
      <div class="mt-4 overflow-x-auto" :aria-busy="store.loading">
        <table class="curacion-table w-full text-left text-sm">
          <caption class="sr-only">Lugares cargados</caption>
          <thead class="hidden md:table-header-group">
            <tr class="border-b border-line-strong">
              <th v-for="h in HEADS" :key="h" scope="col" class="px-2 py-2 font-semibold">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in store.places" :key="p.id" class="block border-b border-line md:table-row">
              <td data-label="Nombre" class="px-2 py-1.5 font-semibold">
                <a :href="`/l/${p.id}`" target="_blank" rel="noopener noreferrer" class="underline decoration-ink underline-offset-4">{{ p.name }}</a>
              </td>
              <td data-label="Tipo" class="px-2 py-1.5">{{ tipoLabel(p.kind) }}</td>
              <td data-label="Origen" class="px-2 py-1.5">{{ origenLabel(p.origin) }}</td>
              <td data-label="Dirección" class="px-2 py-1.5">{{ p.address ?? '—' }}</td>
              <td data-label="Coords" class="px-2 py-1.5">{{ p.lat.toFixed(5) }}, {{ p.lon.toFixed(5) }}</td>
              <td data-label="Cocina / ofrece" class="px-2 py-1.5">
                {{ [...p.cuisine, ...p.offers.map((o) => o.replaceAll('_', ' '))].join(', ') || '—' }}
              </td>
              <td data-label="Visto" class="px-2 py-1.5">{{ vistoLabel(p.last_seen_at) }}</td>
              <td data-label="Faltan" class="px-2 py-1.5">
                <span v-for="m in p.missing" :key="m" class="mr-1 inline-block rounded-tag bg-primary-soft px-1.5 py-0.5 text-xs">{{ placeMissingLabel(m).toLowerCase() }}</span>
                <span v-if="!p.missing.length" class="text-ink-muted">—</span>
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
import type { CurationPlace } from '@tript/shared'
import CuracionPager from '@/components/CuracionPager.vue'
import CuracionShell from '@/components/CuracionShell.vue'
import {
  ORIGENES,
  PAGE_SIZE,
  PLACE_CSV_COLUMNS,
  PLACE_MISSING,
  TIPOS,
  buildCsv,
  csvFileName,
  downloadCsv,
  filtersToQuery,
  hasFilters,
  origenLabel,
  parsePlacesFilters,
  placeMissingLabel,
  tipoLabel,
  vistoLabel,
  type PlacesFilters,
} from '@/lib/curation'
import { useCurationStore } from '@/stores/curation.store'

const HEADS = ['Nombre', 'Tipo', 'Origen', 'Dirección', 'Coords', 'Cocina / ofrece', 'Visto', 'Faltan']

const route = useRoute()
const router = useRouter()
const store = useCurationStore()

const filters = computed(() => parsePlacesFilters(route.query))
const filtered = computed(() => hasFilters(filters.value))

function apply(patch: Partial<PlacesFilters>): void {
  const next = { ...filters.value, ...patch, page: 1 }
  void router.push({ query: filtersToQuery(next) })
}

type ListKey = 'origen' | 'tipo' | 'faltan'
function toggle(key: ListKey, value: string): void {
  const current = (filters.value[key] ?? []) as string[]
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  apply({ [key]: next } as Partial<PlacesFilters>)
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
  const rows = (await store.exportAll('lugares', filters.value)) as CurationPlace[] | null
  if (rows) downloadCsv(csvFileName('lugares'), buildCsv(PLACE_CSV_COLUMNS, rows))
}

store.reset()
watch(() => route.query, () => void store.loadPlaces(filters.value), { immediate: true })
onMounted(() => {
  document.title = 'Curación · Lugares'
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
