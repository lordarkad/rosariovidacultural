<template>
  <main class="md:flex md:h-[calc(100dvh-4rem)] md:flex-col">
    <div class="hidden shrink-0 items-center justify-between border-b border-line px-8 py-3 md:flex">
      <span class="font-display text-lg">Rosario, qué hacer</span>
      <button type="button" class="min-h-11 rounded-button border border-line-strong px-4 font-semibold text-ink" @click="goBack">
        ← {{ backLabel }}
      </button>
    </div>

    <div class="md:flex md:min-h-0 md:flex-1">
      <!-- Imagen: el ratio se reserva siempre para que no haya salto de layout (S4-17, L-14). -->
      <div
        v-if="place || store.loading"
        class="relative h-[220px] w-full shrink-0 overflow-hidden bg-surface-100 md:h-auto md:w-[560px]"
      >
        <img
          v-if="place?.image_url && !imageFailed"
          :src="place.image_url"
          alt=""
          class="h-full w-full object-cover"
          @error="imageFailed = true"
        />
        <div
          v-else-if="place"
          class="flex h-full w-full items-center justify-center bg-surface-100 p-6 text-center font-display text-2xl text-ink-muted"
          aria-hidden="true"
        >
          {{ place.name }}
        </div>
        <button
          type="button"
          class="absolute left-3 top-3 z-[1] min-h-11 rounded-button border border-line-strong bg-surface-card px-3 text-sm font-semibold text-ink md:hidden"
          :aria-label="backLabel"
          @click="goBack"
        >
          ← Volver
        </button>
      </div>
      <div v-else class="px-4 pt-4 md:hidden">
        <button type="button" class="min-h-11 rounded-button border border-line-strong px-3 text-sm font-semibold text-ink" :aria-label="backLabel" @click="goBack">
          ← Volver
        </button>
      </div>

      <div ref="scroller" class="min-w-0 flex-1 px-4 py-5 md:overflow-y-auto md:px-12 md:py-10">
        <div v-if="store.loading" class="space-y-4" role="status" aria-label="Cargando lugar">
          <Skeleton width="40%" height="1rem" />
          <Skeleton width="90%" height="2rem" />
          <Skeleton width="100%" height="6rem" />
          <Skeleton width="100%" height="4rem" />
        </div>

        <section v-else-if="store.notFound" class="space-y-3">
          <h1 ref="heading" tabindex="-1" class="text-3xl focus:outline-none">No encontramos este lugar</h1>
          <div class="flex flex-wrap gap-2">
            <RouterLink to="/resultados" class="inline-flex min-h-11 items-center rounded-button border border-line-strong px-4 font-semibold">Ver resultados</RouterLink>
            <RouterLink to="/" class="inline-flex min-h-11 items-center rounded-button border border-line-strong px-4 font-semibold">Volver al inicio</RouterLink>
          </div>
        </section>

        <section
          v-else-if="store.error"
          class="space-y-3 rounded-card bg-[var(--rq-danger-bg)] p-4 text-[var(--rq-danger-text)]"
          role="alert"
        >
          <h1 ref="heading" tabindex="-1" class="text-2xl focus:outline-none">No pudimos cargar el lugar</h1>
          <p class="text-sm">{{ store.error }}</p>
          <Button label="Reintentar" @click="load" />
        </section>

        <article v-else-if="place" class="space-y-5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rq-meta !text-lugar">Lugar</span>
            <span v-for="l in labels" :key="l" class="rq-meta">{{ l }}</span>
          </div>

          <h1 ref="heading" tabindex="-1" class="text-3xl focus:outline-none md:text-4xl">{{ place.name }}</h1>

          <div v-if="place.cuisine.length" class="flex flex-wrap items-center gap-2">
            <span class="rq-meta">Cocina</span>
            <span v-for="c in place.cuisine" :key="c" class="rq-meta !text-ink">{{ c }}</span>
          </div>

          <blockquote v-if="place.note" class="whitespace-pre-line break-words border-l-4 border-ink bg-surface-50 px-4 py-3">{{ place.note }}</blockquote>

          <dl class="divide-y divide-line rounded-card border border-line bg-surface-card">
            <div class="px-4 py-3">
              <dt class="rq-meta">Horario</dt>
              <dd><OpeningHours :place="place" /></dd>
            </div>
            <div v-if="place.address" class="px-4 py-3">
              <dt class="rq-meta">Dónde</dt>
              <dd>{{ place.address }}</dd>
            </div>
            <div v-if="phoneText" class="px-4 py-3">
              <dt class="rq-meta">Teléfono</dt>
              <dd>{{ phoneText }}</dd>
            </div>
            <div v-if="distance" class="px-4 py-3">
              <dt class="rq-meta">Distancia</dt>
              <dd>{{ distance }}</dd>
            </div>
          </dl>

          <div class="flex flex-wrap gap-2">
            <a
              v-if="maps"
              :href="maps"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-12 w-full items-center justify-center rounded-button bg-primary px-4 font-semibold md:w-auto"
            >
              Cómo llegar →<span class="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
            <a
              v-for="a in actions"
              :key="a.label"
              :href="a.href"
              :target="a.external ? '_blank' : undefined"
              :rel="a.external ? 'noopener noreferrer' : undefined"
              class="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-button border border-line-strong px-4 font-semibold md:flex-none"
            >
              {{ a.label }}<span v-if="a.external" class="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          </div>

          <UpcomingEvents :events="place.upcoming_events" :origin="origin" />

          <p v-if="place.origin === 'osm'" class="text-center text-xs text-ink-muted">
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="underline">Datos de OpenStreetMap</a>
            · contribuidores (ODbL)
          </p>
        </article>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import OpeningHours from '@/components/OpeningHours.vue'
import UpcomingEvents from '@/components/UpcomingEvents.vue'
import { useDetailPage } from '@/composables/useDetailPage'
import { mapsUrl, safeSourceUrl } from '@/lib/detail'
import { formatDistance, formatWalk } from '@/lib/format'
import { instagramUrl, phoneAction, placeLabels } from '@/lib/place'
import { usePlaceStore } from '@/stores/place.store'

const store = usePlaceStore()

const place = computed(() => store.place)
const imageFailed = ref(false)

const { heading, scroller, origin, backLabel, load, goBack } = useDetailPage({
  desde: 'lugar',
  fetch: (id, o) => store.load(id, o),
  title: () => place.value?.name,
  reset: () => {
    imageFailed.value = false
  },
})

const labels = computed(() => placeLabels(place.value!))
const distance = computed(() =>
  [formatDistance(place.value!.distance_m), formatWalk(place.value!.walk_minutes)].filter(Boolean).join(' · '),
)
const maps = computed(() => mapsUrl(place.value!.lat, place.value!.lon))

const phone = computed(() => phoneAction(place.value!.phone))
// Un teléfono sin botón (p. ej. con «15» local) se muestra como texto para que no se pierda (L-6).
const phoneText = computed(() => (place.value!.phone && !phone.value ? place.value!.phone : null))

/** Solo los contactos que existen (L-6); todos los externos en pestaña nueva. */
const actions = computed(() => {
  const p = place.value!
  const site = p.website ? safeSourceUrl(p.website) : null
  const ig = instagramUrl(p.instagram)
  return [
    phone.value && { label: phone.value.kind === 'whatsapp' ? 'WhatsApp' : 'Llamar', href: phone.value.href, external: phone.value.kind === 'whatsapp' },
    site && { label: 'Sitio', href: site, external: true },
    ig && { label: 'Instagram', href: ig, external: true },
  ].filter((a): a is { label: string; href: string; external: boolean } => !!a)
})
</script>
