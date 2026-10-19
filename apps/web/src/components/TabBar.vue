<template>
  <nav aria-label="Secciones" class="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-card">
    <ul class="mx-auto flex max-w-xl">
      <li v-for="tab in tabs" :key="tab.to" class="flex-1">
        <RouterLink
          :to="tab.to"
          class="flex min-h-14 items-center justify-center text-sm font-semibold"
          :class="isActive(tab.id) ? 'text-ink underline decoration-primary decoration-4 underline-offset-8' : 'text-ink-muted'"
          :aria-current="isActive(tab.id) && !route.meta.tab ? 'page' : undefined"
        >
          {{ tab.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { activeTab, type TabId } from '@/lib/detail'

const tabs: { id: TabId; to: string; label: string }[] = [
  { id: 'buscar', to: '/', label: 'Buscar' },
  { id: 'zona', to: '/zona', label: 'Zona' },
  { id: 'resultados', to: '/resultados', label: 'Resultados' },
]

const route = useRoute()
const isActive = (id: TabId): boolean => activeTab(route) === id
</script>
