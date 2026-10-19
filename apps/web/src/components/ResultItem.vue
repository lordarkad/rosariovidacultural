<template>
  <li :id="`item-${item.kind}-${item.id}`">
    <component
      :is="to ? RouterLink : 'div'"
      v-bind="to ? { to } : {}"
      class="flex gap-3 rounded-card border bg-surface-card p-3"
      :class="[selected ? 'border-line-strong ring-2 ring-[var(--rq-focus)]' : 'border-line', to && 'hover:border-line-strong']"
      :aria-current="selected ? 'true' : undefined"
    >
      <div class="h-16 w-16 shrink-0 overflow-hidden rounded-tag bg-surface-100">
        <img v-if="item.image_url" :src="item.image_url" alt="" loading="lazy" class="h-full w-full object-cover" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span v-if="kindLabel" class="rq-meta" :class="item.kind === 'event' ? '!text-evento' : '!text-lugar'">
            {{ kindLabel }}
          </span>
          <span v-if="price" class="rq-meta !text-ink">{{ price }}</span>
        </div>
        <h3 class="mt-0.5 truncate text-base">{{ item.title }}</h3>
        <p class="truncate text-sm text-ink-muted">{{ when }}</p>
        <p class="truncate text-sm text-ink-muted">{{ where }}</p>
      </div>
    </component>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { SearchItem } from '@tript/shared'
import { detailLink, type Origin } from '@/lib/detail'
import {
  formatDate,
  formatDistance,
  formatPrice,
  formatTime,
  formatWalk,
  placeKindLabel,
} from '@/lib/format'

const props = defineProps<{ item: SearchItem; selected?: boolean; origin?: Origin | null }>()

// Eventos y lugares tienen Detalle (S4-2, L-1); un `kind` desconocido se ve igual pero sin enlace.
const to = computed(() => detailLink(props.item.kind, props.item.id, props.origin))
const kindLabel = computed(() => ({ event: 'Evento', place: 'Lugar' })[props.item.kind as string] ?? null)
const price = computed(() => formatPrice(props.item.price_status, props.item.price_from_ars))

/** Eventos: día y hora. Lugares: abierto/cerrado. Siempre dice «horario no informado» si no se sabe. */
const when = computed(() => {
  const i = props.item
  if (i.kind === 'event') {
    const date = i.start_date ? formatDate(i.start_date) : null
    const time = formatTime(i.start_time)
    return [date, time ?? 'horario no informado'].filter(Boolean).join(' · ')
  }
  if (i.open_now === true) return 'Abierto ahora'
  if (i.open_now === false) return 'Cerrado ahora'
  return 'Horario no informado'
})

const where = computed(() => {
  const i = props.item
  if (!i.location_known) return [i.venue_name, 'ubicación no informada'].filter(Boolean).join(' · ')
  const parts = [
    i.kind === 'place' ? placeKindLabel(i.place_kind) : i.venue_name,
    formatDistance(i.distance_m),
    formatWalk(i.walk_minutes),
  ]
  return parts.filter(Boolean).join(' · ')
})
</script>
