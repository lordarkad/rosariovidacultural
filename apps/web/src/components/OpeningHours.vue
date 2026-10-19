<template>
  <div class="space-y-1">
    <p v-if="status" class="font-semibold" :class="status.open === false && 'text-ink-muted'">
      <span v-if="status.open !== null" class="mr-1" aria-hidden="true">{{ status.open ? '●' : '○' }}</span>{{ status.text }}
    </p>
    <template v-if="week">
      <button
        type="button"
        class="min-h-11 text-sm font-semibold underline"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        Ver horarios de la semana <span aria-hidden="true">{{ expanded ? '▴' : '▾' }}</span>
      </button>
      <ul v-if="expanded" id="week-schedule" class="divide-y divide-line rounded-card border border-line text-sm">
        <li
          v-for="row in week"
          :key="row.label"
          data-week-row
          class="flex justify-between gap-3 px-3 py-2"
          :class="row.today && 'bg-surface-50 font-semibold'"
        >
          <span>{{ row.label }}<template v-if="row.today"> (hoy)</template></span>
          <span>{{ row.text }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PlaceDetail } from '@tript/shared'
import { openStatus, weekSchedule } from '@/lib/place'

const props = defineProps<{
  place: Pick<PlaceDetail, 'open_now' | 'next_change_at' | 'hours_text' | 'opening_hours'>
}>()

const expanded = ref(false)

// Se calcula al montar (la vista pide la ficha de nuevo cada vez que se monta, L-4).
const status = computed(() => openStatus(props.place))
const week = computed(() => (props.place.opening_hours?.length ? weekSchedule(props.place.opening_hours) : null))
</script>
