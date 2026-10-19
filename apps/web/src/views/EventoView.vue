<template>
  <main class="md:flex md:h-[calc(100dvh-4rem)] md:flex-col">
    <div class="hidden shrink-0 items-center justify-between border-b border-line px-8 py-3 md:flex">
      <span class="font-display text-lg">Rosario, qué hacer</span>
      <button type="button" class="min-h-11 rounded-button border border-line-strong px-4 font-semibold text-ink" @click="goBack">
        ← Volver a resultados
      </button>
    </div>

    <div class="md:flex md:min-h-0 md:flex-1">
      <!-- Imagen: el ratio se reserva siempre para que no haya salto de layout (S4-17). -->
      <div
        v-if="event || store.loading"
        class="relative h-[220px] w-full shrink-0 overflow-hidden bg-surface-100 md:h-auto md:w-[560px]"
      >
        <img
          v-if="event?.image_url && !imageFailed"
          :src="event.image_url"
          alt=""
          class="h-full w-full object-cover"
          @error="imageFailed = true"
        />
        <div
          v-else-if="event"
          class="flex h-full w-full items-center justify-center bg-surface-100 p-6 text-center font-display text-2xl text-ink-muted"
          aria-hidden="true"
        >
          {{ event.title }}
        </div>
        <button
          type="button"
          class="absolute left-3 top-3 z-[1] min-h-11 rounded-button border border-line-strong bg-surface-card px-3 text-sm font-semibold text-ink md:hidden"
          @click="goBack"
        >
          ← Volver
        </button>
      </div>
      <!-- Sin evento (no disponible / error) la imagen no tiene sentido, pero en mobile «volver» sigue haciendo falta. -->
      <div v-else class="px-4 pt-4 md:hidden">
        <button type="button" class="min-h-11 rounded-button border border-line-strong px-3 text-sm font-semibold text-ink" @click="goBack">
          ← Volver
        </button>
      </div>

      <div ref="scroller" class="min-w-0 flex-1 px-4 py-5 md:overflow-y-auto md:px-12 md:py-10">
        <div v-if="store.loading" class="space-y-4" role="status" aria-label="Cargando evento">
          <Skeleton width="40%" height="1rem" />
          <Skeleton width="90%" height="2rem" />
          <Skeleton width="100%" height="6rem" />
          <Skeleton width="100%" height="4rem" />
        </div>

        <section v-else-if="store.notFound" class="space-y-3">
          <h1 ref="heading" tabindex="-1" class="text-3xl focus:outline-none">Este evento ya no está disponible</h1>
          <p class="text-ink-muted">Pudo haber terminado o la fuente lo quitó.</p>
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
          <h1 ref="heading" tabindex="-1" class="text-2xl focus:outline-none">No pudimos cargar el evento</h1>
          <p class="text-sm">{{ store.error }}</p>
          <Button label="Reintentar" @click="load" />
        </section>

        <article v-else-if="event" class="space-y-5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rq-meta !text-evento">Evento</span>
            <span v-if="genre" class="rq-meta">{{ genre }}</span>
            <span v-if="price === 'GRATIS'" class="rq-meta !text-ink">GRATIS</span>
          </div>

          <h1 ref="heading" tabindex="-1" class="text-3xl focus:outline-none md:text-4xl">{{ event.title }}</h1>

          <p v-if="event.is_stale" class="rounded-card bg-surface-50 p-3 text-sm" role="status">
            Datos de ayer: la fuente no se actualizó hoy.
          </p>

          <dl class="divide-y divide-line rounded-card border border-line bg-surface-card">
            <div class="px-4 py-3">
              <dt class="rq-meta">Cuándo</dt>
              <dd>{{ when.text }}</dd>
              <dd v-if="when.note" class="text-sm text-ink-muted">{{ when.note }}</dd>
            </div>
            <div class="px-4 py-3">
              <dt class="rq-meta">Dónde</dt>
              <dd>{{ event.venue_name ?? '' }}</dd>
              <dd v-if="event.address" class="text-ink-muted">{{ event.address }}</dd>
              <dd v-if="!maps" class="text-sm text-ink-muted">ubicación no informada</dd>
            </div>
            <div class="px-4 py-3">
              <dt class="rq-meta">Precio</dt>
              <dd>{{ price ?? 'precio no informado' }}</dd>
            </div>
            <div v-if="distance" class="px-4 py-3">
              <dt class="rq-meta">Distancia</dt>
              <dd>{{ distance }}</dd>
            </div>
          </dl>

          <div v-if="description">
            <p class="whitespace-pre-line break-words">{{ description.text }}</p>
            <button
              v-if="description.truncated"
              type="button"
              class="mt-1 min-h-11 font-semibold underline"
              :aria-expanded="expanded"
              @click="expanded = !expanded"
            >
              {{ expanded ? 'Ver menos' : 'Ver más' }}
            </button>
          </div>

          <a
            v-if="maps"
            :href="maps"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-12 w-full items-center justify-center rounded-button bg-primary px-4 font-semibold md:w-auto"
          >
            Cómo llegar →<span class="sr-only"> (se abre en una pestaña nueva)</span>
          </a>

          <section v-if="primary" aria-label="Fuente" class="space-y-2">
            <SourceCard :source="primary" />
            <SourceCard v-for="s in others" :key="s.url" :source="s" via />
          </section>

          <AlsoAt :siblings="event.also_at" :origin="origin" />
        </article>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import AlsoAt from '@/components/AlsoAt.vue'
import SourceCard from '@/components/SourceCard.vue'
import { backTarget, mapsUrl, originFromState, truncateDescription } from '@/lib/detail'
import { formatDistance, formatPrice, formatWalk, formatWhen } from '@/lib/format'
import { GENRES } from '@/lib/search-query'
import { useDetailStore } from '@/stores/detail.store'

const route = useRoute()
const router = useRouter()
const store = useDetailStore()

const event = computed(() => store.event)
const heading = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const expanded = ref(false)
const imageFailed = ref(false)
// El origen de la distancia vive en `history.state` de esta entrada: sobrevive a la recarga (S4-3).
// shallowRef: el origen va al `state` del router y `history.replaceState` no clona un Proxy reactivo.
const origin = shallowRef(originFromState(history.state))

const id = computed(() => String(route.params.id ?? ''))

const genre = computed(() => {
  const g = event.value?.music_genres[0]
  return g ? (GENRES.find((x) => x.value === g)?.label ?? null) : null
})
const when = computed(() => formatWhen(event.value!))
const price = computed(() => formatPrice(event.value!.price_status, event.value!.price_from_ars))
const distance = computed(() =>
  [formatDistance(event.value!.distance_m), formatWalk(event.value!.walk_minutes)].filter(Boolean).join(' · '),
)
const maps = computed(() => mapsUrl(event.value!.lat, event.value!.lon))
const description = computed(() =>
  event.value?.description ? truncateDescription(event.value.description, expanded.value) : null,
)
const primary = computed(() => event.value?.sources[0])
const others = computed(() => event.value?.sources.slice(1) ?? [])

async function load(): Promise<void> {
  const mine = id.value
  expanded.value = false
  imageFailed.value = false
  origin.value = originFromState(history.state)
  await store.load(mine, origin.value)
  // Una carga más nueva (otro id) ya tomó el control: no se roba el foco.
  if (mine !== id.value) return
  await nextTick()
  scroller.value?.scrollTo({ top: 0 })
  window.scrollTo({ top: 0 })
  heading.value?.focus()
}

function goBack(): void {
  if (backTarget(history.state) === 'back') router.back()
  else void router.push('/resultados')
}

// El router reutiliza este componente entre `/e/A` y `/e/B` (S4-15).
// Al salir del Detalle `route.params.id` queda vacío antes de desmontar: no hay nada que cargar.
watch(id, (v) => { if (v) void load() }, { immediate: true })

// El título original se captura una sola vez y se restaura al salir (S4-4).
const originalTitle = document.title
watch(
  () => event.value?.title,
  (title) => {
    document.title = title ? `${title} · Rosario, qué hacer` : originalTitle
  },
)
onBeforeUnmount(() => {
  document.title = originalTitle
})
</script>
