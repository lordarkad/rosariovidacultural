<template>
  <button
    type="button"
    :aria-pressed="pressed"
    class="min-h-11 rounded-chip border-[length:var(--rq-chip-border-width)] px-3.5 text-sm font-semibold transition-colors"
    :class="
      pressed
        ? 'border-line-strong bg-primary text-ink-on-primary'
        : 'border-line bg-surface-card text-ink hover:border-line-strong'
    "
  >
    {{ label }}
  </button>
</template>

<script setup lang="ts">
defineProps<{ label: string; pressed: boolean }>()
</script>
