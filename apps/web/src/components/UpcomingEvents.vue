<template>
  <section v-if="events.length" aria-labelledby="upcoming">
    <h2 id="upcoming" class="rq-meta">Próximos eventos</h2>
    <ul class="mt-2 space-y-2">
      <li v-for="e in visible" :key="e.id">
        <RouterLink
          :to="to(e.id)"
          class="flex min-h-11 items-center justify-between gap-3 rounded-card border border-line bg-surface-card px-3 py-2 hover:border-line-strong"
        >
          <span class="min-w-0">
            <span class="rq-meta block">{{ when(e) }}</span>
            <span class="block truncate font-semibold">{{ e.title }}</span>
          </span>
          <span v-if="price(e)" class="rq-meta shrink-0 !text-ink">{{ price(e) }}</span>
        </RouterLink>
      </li>
    </ul>
    <button
      v-if="events.length > LIMIT"
      type="button"
      class="mt-2 min-h-11 rounded-button border border-line-strong px-4 font-semibold"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Ver menos' : `Ver más (${events.length})` }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { UpcomingEvent } from '@tript/shared'
import { detailLink, type Origin } from '@/lib/detail'
import { formatPrice, formatWhen } from '@/lib/format'

const LIMIT = 5

const props = defineProps<{ events: UpcomingEvent[]; origin?: Origin | null }>()

const expanded = ref(false)
const visible = computed(() => (expanded.value ? props.events : props.events.slice(0, LIMIT)))

// Cada fila abre su Detalle con el origen de la distancia en el `state` (L-8).
const to = (id: string) => detailLink('event', id, props.origin)!
// Estos eventos no traen `date_text`.
const when = (e: UpcomingEvent) => formatWhen({ ...e, date_text: null }).text
const price = (e: UpcomingEvent) => formatPrice(e.price_status, e.price_from_ars)
</script>
