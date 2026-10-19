<template>
  <section v-if="siblings.length" aria-labelledby="also-at">
    <h2 id="also-at" class="text-xl">También en</h2>
    <ul class="mt-2 space-y-2">
      <li v-for="s in siblings" :key="s.id">
        <RouterLink
          :to="{ path: `/e/${s.id}`, state: origin ? { origin: { lat: origin.lat, lon: origin.lon } } : {} }"
          replace
          class="flex min-h-11 items-center rounded-card border border-line bg-surface-card px-3 py-2 font-semibold hover:border-line-strong"
        >
          {{ s.venue_name || s.address || 'Otra sede' }}
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { EventSibling } from '@tript/shared'
import type { Origin } from '@/lib/detail'

// `replace` + `state`: «atrás» no pasa por otro evento y la distancia se conserva (S4-13, S4-5).
defineProps<{ siblings: EventSibling[]; origin?: Origin | null }>()
</script>
