<template>
  <div>
    <div class="flex items-baseline justify-between">
      <label :for="id" class="rq-meta">Radio de búsqueda</label>
      <output :for="id" class="text-lg font-semibold">{{ formatRadius(model) }}</output>
    </div>
    <input
      :id="id"
      v-model.number="model"
      type="range"
      :min="RADIO_MIN"
      :max="RADIO_MAX"
      step="100"
      :aria-valuetext="formatRadius(model)"
      class="mt-2 h-11 w-full accent-[var(--rq-text)]"
    />
    <div class="flex justify-between text-xs text-ink-muted" aria-hidden="true">
      <span>{{ formatRadius(RADIO_MIN) }}</span>
      <span>{{ formatRadius(RADIO_MAX) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { RADIO_MAX, RADIO_MIN, formatRadius } from '@/lib/geo'

const model = defineModel<number>({ required: true })
const id = useId()
</script>
