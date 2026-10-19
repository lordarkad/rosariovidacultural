<template>
  <main class="mx-auto max-w-xl px-4 py-4">
    <h1 class="sr-only">Resultados</h1>
    <nav aria-label="Tu búsqueda" class="flex flex-wrap items-center gap-x-1 gap-y-2">
      <RouterLink :to="edit('/')" class="rounded-chip border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold">{{ phrase.que }}</RouterLink>
      <span aria-hidden="true">·</span>
      <RouterLink :to="edit('/zona')" class="rounded-chip border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold">{{ phrase.donde }}</RouterLink>
      <span aria-hidden="true">·</span>
      <RouterLink :to="edit('/')" class="rounded-chip border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold">{{ phrase.cuando }}</RouterLink>
    </nav>

    <section
      v-if="!query.z"
      class="mt-4 rounded-card border border-line bg-surface-50 p-3 text-sm"
    >
      <p>Estás viendo toda la ciudad, sin distancias. Elegí una zona para ver qué te queda cerca.</p>
      <RouterLink :to="edit('/zona')" class="mt-2 inline-block font-semibold underline">Elegir zona</RouterLink>
    </section>

    <div v-if="search.loading" class="mt-6 space-y-3" role="status" aria-label="Cargando resultados">
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
      class="mt-6 rounded-card bg-[var(--rq-danger-bg)] p-4 text-[var(--rq-danger-text)]"
      role="alert"
    >
      <h2 class="text-xl">No pudimos cargar los resultados</h2>
      <p class="mt-1 text-sm">{{ search.error }}</p>
      <Button label="Reintentar" class="mt-3" @click="load" />
    </div>

    <section v-else-if="search.items.length === 0" class="mt-6">
      <h2 class="text-xl">Sin resultados</h2>
      <p class="mt-1 text-ink-muted">No encontramos nada con esta búsqueda. Probá:</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button v-if="hasFilters" label="Quitar filtros" variant="outlined" @click="clearFilters" />
        <RouterLink :to="edit('/')" class="inline-flex min-h-11 items-center rounded-button border border-line-strong px-4 font-semibold">Cambiar día</RouterLink>
        <RouterLink v-if="query.z" :to="edit('/zona')" class="inline-flex min-h-11 items-center rounded-button border border-line-strong px-4 font-semibold">Cambiar zona</RouterLink>
      </div>
    </section>

    <template v-else>
      <p class="rq-meta mt-4" aria-live="polite">{{ search.total }} {{ search.total === 1 ? 'resultado' : 'resultados' }}</p>
      <section v-for="g in groups" :key="g.band" class="mt-4">
        <h2 class="text-xl">{{ g.label }}</h2>
        <ul class="mt-2 space-y-2">
          <ResultItem v-for="i in g.items" :key="`${i.kind}:${i.id}`" :item="i" />
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
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import ResultItem from '@/components/ResultItem.vue'
import { describeSearch, groupByBand, parseSearch, toRouteQuery } from '@/lib/search-query'
import { useSearchStore } from '@/stores/search.store'
import { useZonesStore } from '@/stores/zones.store'

const route = useRoute()
const router = useRouter()
const search = useSearchStore()
const zones = useZonesStore()

// La URL manda (S2-3): la búsqueda sale de ella y el store solo la refleja.
const query = computed(() => parseSearch(route.query))
const zoneName = computed(() => zones.items.find((z) => z.id === query.value.z)?.name)
const phrase = computed(() => describeSearch(query.value, zoneName.value))
const groups = computed(() => groupByBand(search.items))
const hasFilters = computed(() => Boolean(query.value.i || query.value.q || query.value.gratis))

/** Editar una parte de la frase lleva a la pantalla que la cambia, conservando la búsqueda. */
const edit = (path: string) => ({ path, query: route.query })

function load(): void {
  void search.run(query.value)
}

function clearFilters(): void {
  const { z, cuando, fecha } = query.value
  void router.replace({ path: '/resultados', query: toRouteQuery({ z, cuando, fecha }) })
}

// La ruta es la misma al cambiar filtros: se vuelve a buscar cuando cambia el query.
watch(() => route.fullPath, () => {
  if (route.path === '/resultados') load()
})
// Se busca en el setup (no en onMounted) para no mostrar un frame con los ítems de la búsqueda anterior.
load()
onMounted(() => void zones.fetchZones())
</script>
