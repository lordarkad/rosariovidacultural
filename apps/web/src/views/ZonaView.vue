<template>
  <main class="mx-auto max-w-xl px-4 py-6">
    <p class="rq-meta">¿Dónde?</p>
    <h1 class="mt-1 text-3xl">Elegí una zona</h1>
    <p class="mt-2 text-ink-muted">«Cerca mío» y «En el mapa» llegan en la próxima etapa.</p>

    <p v-if="zones.loading" class="mt-6 text-ink-muted" role="status">Cargando zonas…</p>
    <div v-else-if="zones.error" class="mt-6 rounded-card bg-[var(--rq-danger-bg)] p-4 text-[var(--rq-danger-text)]" role="alert">
      <p>No pudimos cargar las zonas.</p>
      <Button label="Reintentar" class="mt-3" @click="zones.fetchZones(true)" />
    </div>
    <ul v-else class="mt-6 space-y-2">
      <li>
        <RouterLink :to="pick(undefined)" class="block rounded-card border border-line bg-surface-card p-3 font-semibold hover:border-line-strong">
          Toda la ciudad
        </RouterLink>
      </li>
      <li v-for="z in zones.items" :key="z.id">
        <RouterLink :to="pick(z.id)" class="block rounded-card border border-line bg-surface-card p-3 font-semibold hover:border-line-strong">
          {{ z.name }}
          <span class="rq-meta ml-2">{{ z.kind === 'localidad' ? 'Localidad' : 'Barrio' }}</span>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from 'primevue/button'
import { parseSearch, toRouteQuery } from '@/lib/search-query'
import { useZonesStore } from '@/stores/zones.store'

const route = useRoute()
const zones = useZonesStore()

onMounted(() => zones.fetchZones())

/** Vuelve a Resultados con la misma búsqueda y la zona elegida. */
const pick = (z: string | undefined) => ({
  path: '/resultados',
  query: toRouteQuery({ ...parseSearch(route.query), z }),
})
</script>
