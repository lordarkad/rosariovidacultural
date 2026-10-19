<template>
  <main class="flex h-[calc(100dvh-4rem)] flex-col">
    <header class="shrink-0 border-b border-line bg-surface-0 px-4 py-3 md:px-8">
      <h1 class="sr-only">Resultados</h1>
      <nav aria-label="Tu búsqueda" class="flex flex-wrap items-center gap-x-1 gap-y-2">
        <RouterLink :to="edit('/')" class="rounded-chip border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold">{{ phrase.que }}</RouterLink>
        <span aria-hidden="true">·</span>
        <RouterLink :to="edit('/zona')" class="rounded-chip border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold">{{ phrase.donde }}</RouterLink>
        <span aria-hidden="true">·</span>
        <RouterLink :to="edit('/')" class="rounded-chip border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold">{{ phrase.cuando }}</RouterLink>
      </nav>
    </header>

    <div class="relative min-h-0 flex-1 md:flex">
      <div class="absolute inset-0 md:static md:flex-1">
        <MapView
          :pins="pins.pins"
          :center="origin?.point ?? null"
          :radius-m="origin?.radiusM"
          :selected-key="selectedKey"
          :fit-key="pins.version"
          :padding="fitPadding"
          @select="selectPin"
          @bounds="onBounds"
        />
        <div class="pointer-events-none absolute inset-x-3 top-3 z-[5] flex flex-col items-start gap-2 md:right-14">
          <p v-if="pins.truncated" class="pointer-events-auto rounded-chip bg-surface-card px-3 py-1.5 text-sm shadow" role="status">
            Mostrando {{ pins.pins.length }} de {{ pins.total }} en el mapa. Acercá para ver más.
          </p>
          <p v-if="pins.error" class="pointer-events-auto flex items-center gap-2 rounded-chip bg-[var(--rq-danger-bg)] px-3 py-1.5 text-sm text-[var(--rq-danger-text)]" role="alert">
            No pudimos cargar los puntos del mapa.
            <button type="button" class="font-semibold underline" @click="loadPins(bbox)">Reintentar</button>
          </p>
          <div
            v-if="selectedPin"
            class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border border-line-strong bg-surface-card p-3 shadow-lg"
          >
            <div class="min-w-0 flex-1">
              <p class="rq-meta" :class="selectedPin.kind === 'event' ? '!text-evento' : '!text-lugar'">
                {{ selectedPin.kind === 'event' ? 'Evento' : selectedPin.kind === 'place' ? 'Lugar' : '' }}
              </p>
              <p class="truncate font-semibold">{{ selectedPin.title }}</p>
              <RouterLink :to="detailPath(selectedPin)" class="text-sm font-semibold underline">Ver detalle</RouterLink>
            </div>
            <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center text-xl" aria-label="Cerrar" @click="selectedKey = null">
              ×
            </button>
          </div>
        </div>
      </div>

      <BottomSheet v-model="sheet" class="md:w-[420px] md:shrink-0">
        <div class="px-4 pb-4 md:px-5">
          <section v-if="!hasOrigin" class="mt-1 rounded-card border border-line bg-surface-50 p-3 text-sm">
            <p>Estás viendo toda la ciudad, sin distancias. Elegí una zona para ver qué te queda cerca.</p>
            <RouterLink :to="edit('/zona')" class="mt-2 inline-block font-semibold underline">Elegir zona</RouterLink>
          </section>

          <div v-if="search.loading" class="mt-4 space-y-3" role="status" aria-label="Cargando resultados">
            <div v-for="n in 3" :key="n" class="flex gap-3 rounded-card border border-line bg-surface-card p-3">
              <Skeleton width="4rem" height="4rem" />
              <div class="flex-1 space-y-2">
                <Skeleton width="30%" height="0.75rem" />
                <Skeleton width="80%" height="1rem" />
                <Skeleton width="60%" height="0.75rem" />
              </div>
            </div>
          </div>

          <div
            v-else-if="search.error && search.items.length === 0"
            class="mt-4 rounded-card bg-[var(--rq-danger-bg)] p-4 text-[var(--rq-danger-text)]"
            role="alert"
          >
            <h2 class="text-xl">No pudimos cargar los resultados</h2>
            <p class="mt-1 text-sm">{{ search.error }}</p>
            <Button label="Reintentar" class="mt-3" @click="load" />
          </div>

          <section v-else-if="search.items.length === 0" class="mt-4">
            <h2 class="text-xl">Sin resultados</h2>
            <p class="mt-1 text-ink-muted">No encontramos nada con esta búsqueda. Probá:</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button v-if="hasFilters" label="Quitar filtros" variant="outlined" @click="clearFilters" />
              <RouterLink :to="edit('/')" class="inline-flex min-h-11 items-center rounded-button border border-line-strong px-4 font-semibold">Cambiar día</RouterLink>
              <RouterLink v-if="hasOrigin" :to="edit('/zona')" class="inline-flex min-h-11 items-center rounded-button border border-line-strong px-4 font-semibold">Cambiar zona</RouterLink>
            </div>
          </section>

          <template v-else>
            <p class="rq-meta mt-2" aria-live="polite">{{ search.total }} {{ search.total === 1 ? 'resultado' : 'resultados' }}</p>
            <section v-for="g in groups" :key="g.band" class="mt-4">
              <h2 class="text-xl">{{ g.label }}</h2>
              <ul class="mt-2 space-y-2">
                <ResultItem v-for="i in g.items" :key="`${i.kind}:${i.id}`" :item="i" :selected="selectedKey === `${i.kind}:${i.id}`" />
              </ul>
            </section>

            <div v-if="search.error" class="mt-4 rounded-card bg-[var(--rq-danger-bg)] p-3 text-sm text-[var(--rq-danger-text)]" role="alert">
              No pudimos cargar más resultados.
            </div>
            <Button
              v-if="search.hasMore"
              :label="search.error ? 'Reintentar' : 'Ver más'"
              :loading="search.loadingMore"
              variant="outlined"
              class="mt-4"
              fluid
              @click="search.loadMore()"
            />
          </template>
        </div>
      </BottomSheet>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import type { SearchPin } from '@tript/shared'
import BottomSheet, { type SheetState } from '@/components/BottomSheet.vue'
import MapView from '@/components/MapView.vue'
import ResultItem from '@/components/ResultItem.vue'
import { RADIO_DEFAULT } from '@/lib/geo'
import { describeSearch, groupByBand, parseSearch, toRouteQuery } from '@/lib/search-query'
import { usePinsStore } from '@/stores/pins.store'
import { useSearchStore } from '@/stores/search.store'
import { useZonesStore } from '@/stores/zones.store'

const route = useRoute()
const router = useRouter()
const search = useSearchStore()
const pins = usePinsStore()
const zones = useZonesStore()

// La URL manda (S2-3): la búsqueda sale de ella y los stores solo la reflejan.
const query = computed(() => parseSearch(route.query))
const zone = computed(() => zones.items.find((z) => z.id === query.value.z))
const phrase = computed(() => describeSearch(query.value, zone.value?.name))
const groups = computed(() => groupByBand(search.items))
const hasFilters = computed(() => Boolean(query.value.i || query.value.q || query.value.gratis))

/** Punto y radio que se dibujan en el mapa: la zona elegida o el origen por coordenadas. */
const origin = computed(() => {
  const q = query.value
  if (q.z) return zone.value ? { point: { lat: zone.value.lat, lon: zone.value.lon }, radiusM: zone.value.radius_m } : null
  if (q.lat !== undefined && q.lon !== undefined) return { point: { lat: q.lat, lon: q.lon }, radiusM: q.radio_m ?? RADIO_DEFAULT }
  return null
})
const hasOrigin = computed(() => Boolean(query.value.z || query.value.lat !== undefined))

// Sin clave de MapTiler no hay mapa: la lista ocupa todo el alto.
const sheet = ref<SheetState>(import.meta.env.VITE_MAPTILER_KEY ? 'half' : 'full')

// En mobile la hoja tapa la parte baja del mapa: el encuadre deja ese lugar libre.
const fitPadding = computed(() => {
  const desktop = window.matchMedia('(min-width: 768px)').matches
  const bottom = desktop ? 48 : sheet.value === 'half' ? Math.round(window.innerHeight * 0.4) : sheet.value === 'collapsed' ? 72 : 48
  return { top: 48, bottom, left: 48, right: 48 }
})

const selectedKey = ref<string | null>(null)
const selectedPin = computed(() => pins.pins.find((p) => `${p.kind}:${p.id}` === selectedKey.value))
const detailPath = (p: SearchPin) => (p.kind === 'event' ? `/e/${p.id}` : `/l/${p.id}`)

/** Editar una parte de la frase lleva a la pantalla que la cambia, conservando la búsqueda. */
const edit = (path: string) => ({ path, query: route.query })

// Recuadro visible del mapa cuando hay más de 100 pins (D-7).
const bbox = ref<string | undefined>()

function loadPins(box?: string): void {
  void pins.run(query.value, box)
}

function load(): void {
  bbox.value = undefined
  selectedKey.value = null
  void search.run(query.value)
  loadPins()
}

function onBounds(box: string): void {
  if (!pins.truncated && !bbox.value) return
  bbox.value = box
  loadPins(box)
}

async function selectPin(key: string): Promise<void> {
  selectedKey.value = key
  if (sheet.value === 'collapsed') sheet.value = 'half'
  await nextTick()
  document.getElementById(`item-${key.replace(':', '-')}`)?.scrollIntoView({ block: 'nearest' })
}

function clearFilters(): void {
  const { z, lat, lon, radio_m, cuando, fecha } = query.value
  void router.replace({ path: '/resultados', query: toRouteQuery({ z, lat, lon, radio_m, cuando, fecha }) })
}

// La ruta es la misma al cambiar filtros: se vuelve a buscar cuando cambia el query.
watch(() => route.fullPath, () => {
  if (route.path === '/resultados') load()
})
// Se busca en el setup (no en onMounted) para no mostrar un frame con los ítems de la búsqueda anterior.
load()
onMounted(() => void zones.fetchZones())
</script>
