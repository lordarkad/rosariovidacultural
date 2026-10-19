<template>
  <div class="flex items-center gap-3 rounded-card border border-line bg-surface-card p-3">
    <div class="min-w-0 flex-1">
      <p v-if="via" class="rq-meta">Vía</p>
      <p class="truncate font-semibold">{{ source.name }}</p>
    </div>
    <a
      v-if="href"
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-h-11 shrink-0 items-center rounded-button border border-line-strong px-3 text-sm font-semibold"
    >
      ↗ Fuente<span class="sr-only"> de {{ source.name }} (se abre en una pestaña nueva)</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SourceLink } from '@tript/shared'
import { safeSourceUrl } from '@/lib/detail'

const props = defineProps<{ source: SourceLink; via?: boolean }>()

// Solo http(s): una URL con otro esquema no se enlaza, el nombre queda como texto (S4-11).
const href = computed(() => safeSourceUrl(props.source.url))
</script>
