<template>
  <div class="min-h-dvh bg-surface-0">
    <!-- Cartel de entorno: esta sección no es el sitio público -->
    <p
      data-testid="env-banner"
      role="note"
      class="sticky top-0 z-10 bg-surface-inverse px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-ink-inverse"
    >
      Entorno: {{ env }} · sección interna de curación
    </p>
    <main class="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <p class="rq-meta">Uso interno</p>
      <h1 class="mt-1 text-3xl">Curación</h1>
      <nav aria-label="Curación" class="mt-4 flex gap-2 border-b border-line">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="-mb-px border-b-4 px-4 py-2 text-sm font-semibold"
          :class="route.path === tab.to ? 'border-primary text-ink' : 'border-transparent text-ink-muted hover:text-ink'"
        >
          {{ tab.label }}
        </RouterLink>
      </nav>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { envLabel } from '@/lib/curation'

const env = envLabel()
const route = useRoute()
const tabs = [
  { to: '/curacion/eventos', label: 'Eventos' },
  { to: '/curacion/lugares', label: 'Lugares' },
]
</script>
