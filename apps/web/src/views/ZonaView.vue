<template>
  <main class="mx-auto max-w-xl px-4 py-6 md:max-w-none md:px-8">
    <p class="rq-meta">¿Dónde?</p>
    <h1 class="mt-1 text-3xl">Elegí dónde buscar</h1>

    <div role="group" aria-label="Cómo elegir el lugar" class="mt-4 flex flex-wrap gap-2">
      <ChipToggle v-for="m in MODES" :key="m.value" :label="m.label" :pressed="mode === m.value" @click="mode = m.value" />
    </div>

    <!-- Cerca mío -->
    <div v-if="mode === 'cerca'" class="mt-6 md:grid md:grid-cols-[380px_1fr] md:gap-8">
      <div class="space-y-5">
        <section class="rounded-card border border-line bg-surface-card p-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-xl">Tu ubicación</h2>
            <span v-if="gps === 'ok'" class="rq-meta !text-ink">GPS OK</span>
          </div>
          <p v-if="gps === 'idle'" class="mt-1 text-sm text-ink-muted">
            Usamos tu ubicación solo para buscar cerca tuyo y calcular distancias. No la guardamos.
          </p>
          <p v-else-if="gps === 'asking'" class="mt-1 text-sm text-ink-muted" role="status">Buscando tu ubicación…</p>
          <p v-else-if="gps === 'ok'" class="mt-1 text-sm text-ink-muted" role="status">Ubicación encontrada. Podés ajustar el radio.</p>
          <div v-else-if="gps === 'denied'" role="alert" class="mt-1 text-sm">
            <p>Bloqueaste el permiso de ubicación para este sitio.</p>
            <p class="mt-1 text-ink-muted">
              Activalo desde los ajustes del sitio en tu navegador, o elegí un punto en el mapa o un barrio.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button label="Elegir en el mapa" variant="outlined" size="small" @click="mode = 'mapa'" />
              <Button label="Ver barrios" variant="outlined" size="small" @click="mode = 'barrios'" />
            </div>
          </div>
          <div v-else role="alert" class="mt-1 text-sm">
            <p>No pudimos obtener tu ubicación. Probá de nuevo o elegí un punto en el mapa.</p>
          </div>
          <Button
            v-if="gps !== 'denied'"
            :label="gps === 'ok' ? 'Actualizar ubicación' : 'Usar mi ubicación'"
            :loading="gps === 'asking'"
            :variant="gps === 'ok' ? 'outlined' : undefined"
            class="mt-3"
            fluid
            @click="locate"
          />
        </section>
        <RadiusSlider v-model="radius" />
        <Button label="Buscar cerca mío →" size="large" fluid :disabled="!gpsPoint" @click="go" />
      </div>
      <div class="mt-5 h-64 overflow-hidden rounded-card border border-line md:mt-0 md:h-[calc(100dvh-14rem)]">
        <MapView :center="gpsPoint" :radius-m="radius" :fit-key="fitKey" />
      </div>
    </div>

    <!-- Elegir en el mapa -->
    <div v-else-if="mode === 'mapa'" class="mt-6 md:grid md:grid-cols-[380px_1fr] md:gap-8">
      <div class="space-y-5">
        <ZoneAutocomplete :zones="zones.items" @pick="pickZone" />
        <p class="text-sm text-ink-muted">Tocá el mapa o arrastrá el pin. Las distancias se miden desde ese punto.</p>
        <RadiusSlider v-model="radius" />
        <Button label="Buscar aquí →" size="large" fluid @click="go" />
      </div>
      <div class="mt-5 h-80 overflow-hidden rounded-card border border-line md:mt-0 md:h-[calc(100dvh-14rem)]">
        <MapView :center="point" :radius-m="radius" draggable :fit-key="fitKey" @move="point = $event" />
      </div>
    </div>

    <!-- Barrios -->
    <template v-else>
      <p v-if="zones.loading" class="mt-6 text-ink-muted" role="status">Cargando zonas…</p>
      <div v-else-if="zones.error" class="mt-6 rounded-card bg-[var(--rq-danger-bg)] p-4 text-[var(--rq-danger-text)]" role="alert">
        <p>No pudimos cargar las zonas.</p>
        <Button label="Reintentar" class="mt-3" @click="zones.fetchZones(true)" />
      </div>
      <ul v-else class="mt-6 space-y-2 md:max-w-xl">
        <li>
          <RouterLink :to="pickBarrio(undefined)" class="block rounded-card border border-line bg-surface-card p-3 font-semibold hover:border-line-strong">
            Toda la ciudad
          </RouterLink>
        </li>
        <li v-for="z in zones.items" :key="z.id">
          <RouterLink :to="pickBarrio(z.id)" class="block rounded-card border border-line bg-surface-card p-3 font-semibold hover:border-line-strong">
            {{ z.name }}
            <span class="rq-meta ml-2">{{ z.kind === 'localidad' ? 'Localidad' : 'Barrio' }}</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import type { Zone } from '@tript/shared'
import ChipToggle from '@/components/ChipToggle.vue'
import MapView from '@/components/MapView.vue'
import RadiusSlider from '@/components/RadiusSlider.vue'
import ZoneAutocomplete from '@/components/ZoneAutocomplete.vue'
import { RADIO_DEFAULT, ROSARIO, clampRadius } from '@/lib/geo'
import { GeolocationError, getPosition } from '@/lib/geolocation'
import { parseSearch, toRouteQuery } from '@/lib/search-query'
import { useZonesStore } from '@/stores/zones.store'

type Mode = 'cerca' | 'mapa' | 'barrios'
type Gps = 'idle' | 'asking' | 'ok' | 'denied' | 'failed'

const MODES: { value: Mode; label: string }[] = [
  { value: 'cerca', label: 'Cerca mío' },
  { value: 'mapa', label: 'En el mapa' },
  { value: 'barrios', label: 'Barrios' },
]

const route = useRoute()
const router = useRouter()
const zones = useZonesStore()
const current = parseSearch(route.query)

// Se abre en el modo de la búsqueda actual: barrio → Barrios, punto → En el mapa, nada → Cerca mío.
const mode = ref<Mode>(current.z ? 'barrios' : current.lat !== undefined ? 'mapa' : 'cerca')
const point = ref<{ lat: number; lon: number } | null>(
  current.lat !== undefined && current.lon !== undefined ? { lat: current.lat, lon: current.lon } : null,
)
// Cerca mío solo busca con una ubicación obtenida por GPS; el pin de «En el mapa» no la reemplaza.
const gpsPoint = ref<{ lat: number; lon: number } | null>(null)
const radius = ref(clampRadius(current.radio_m ?? RADIO_DEFAULT))
const gps = ref<Gps>('idle')
// Cambia cuando el punto salta (GPS, barrio elegido) para que el mapa se reencuadre; arrastrar el pin no lo cambia.
const fitKey = ref(0)

onMounted(() => zones.fetchZones())

// En el mapa siempre hay un pin: arranca en Rosario si todavía no se eligió nada.
watch(mode, (m) => {
  if (m === 'mapa' && !point.value) {
    point.value = { ...ROSARIO }
    fitKey.value++
  }
}, { immediate: true })

async function locate(): Promise<void> {
  gps.value = 'asking'
  try {
    gpsPoint.value = await getPosition()
    point.value = gpsPoint.value
    gps.value = 'ok'
    fitKey.value++
  } catch (e) {
    gps.value = e instanceof GeolocationError && e.reason === 'denied' ? 'denied' : 'failed'
  }
}

function pickZone(z: Zone): void {
  point.value = { lat: z.lat, lon: z.lon }
  fitKey.value++
}

/** Vuelve a Resultados con la misma búsqueda y el origen elegido (punto + radio; la zona se descarta, E-8). */
function go(): void {
  const origin = mode.value === 'cerca' ? gpsPoint.value : point.value
  if (!origin) return
  void router.push({
    path: '/resultados',
    query: toRouteQuery({ ...parseSearch(route.query), z: undefined, ...origin, radio_m: radius.value }),
  })
}

/** Barrio de la lista: se manda por `z`, que usa el radio propio de la zona. */
const pickBarrio = (z: string | undefined) => ({
  path: '/resultados',
  query: toRouteQuery({ ...parseSearch(route.query), z, lat: undefined, lon: undefined, radio_m: undefined }),
})
</script>
