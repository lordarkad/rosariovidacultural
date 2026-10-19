<template>
  <div class="relative">
    <label :for="inputId" class="rq-meta">Buscar barrio</label>
    <input
      :id="inputId"
      v-model="text"
      type="text"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && active >= 0 ? `${listId}-${active}` : undefined"
      placeholder="Pichincha, Centro, Fisherton…"
      class="mt-1 min-h-11 w-full rounded-input border border-line bg-surface-card px-3.5"
      @input="onInput"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter="onEnter"
      @keydown.esc="close"
      @blur="close"
    />
    <ul
      v-show="open"
      :id="listId"
      role="listbox"
      aria-label="Barrios sugeridos"
      class="absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-card border border-line-strong bg-surface-card shadow-lg"
    >
      <li
        v-for="(z, n) in suggestions"
        :id="`${listId}-${n}`"
        :key="z.id"
        role="option"
        :aria-selected="n === active"
        class="min-h-11 cursor-pointer px-3.5 py-2.5"
        :class="n === active ? 'bg-primary text-ink-on-primary' : ''"
        @mousedown.prevent="pick(z)"
      >
        {{ z.name }}
        <span class="rq-meta ml-2 !text-current">{{ z.kind === 'localidad' ? 'Localidad' : 'Barrio' }}</span>
      </li>
    </ul>
    <p class="sr-only" role="status">{{ open ? `${suggestions.length} sugerencias` : '' }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { Zone } from '@tript/shared'
import { filterZones } from '@/lib/geolocation'

const props = defineProps<{ zones: Zone[] }>()
const emit = defineEmits<{ pick: [zone: Zone] }>()

const inputId = useId()
const listId = useId()
const text = ref('')
const open = ref(false)
const active = ref(-1)

const suggestions = computed(() => filterZones(props.zones, text.value))

function onInput(): void {
  open.value = suggestions.value.length > 0
  active.value = -1
}

function move(delta: 1 | -1): void {
  if (!suggestions.value.length) return
  open.value = true
  const n = suggestions.value.length
  active.value = (active.value + delta + n) % n
}

function onEnter(e: KeyboardEvent): void {
  if (!open.value) return
  e.preventDefault()
  const z = suggestions.value[active.value >= 0 ? active.value : 0]
  if (z) pick(z)
}

function pick(z: Zone): void {
  text.value = z.name
  close()
  emit('pick', z)
}

function close(): void {
  open.value = false
  active.value = -1
}
</script>
