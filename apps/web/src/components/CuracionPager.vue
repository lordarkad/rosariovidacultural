<template>
  <nav v-if="total > 0" aria-label="Paginación" class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-ink-muted" role="status">
      Página {{ page }} de {{ pages }} · {{ total.toLocaleString('es-AR') }} resultados
    </p>
    <div class="flex gap-2">
      <Button label="← Anterior" variant="outlined" size="small" :disabled="page <= 1" @click="emit('go', page - 1)" />
      <Button label="Siguiente →" variant="outlined" size="small" :disabled="page >= pages" @click="emit('go', page + 1)" />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'

const props = defineProps<{ page: number; total: number; perPage: number }>()
const emit = defineEmits<{ go: [page: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))
</script>
