<template>
  <section
    ref="sheet"
    aria-label="Lista de resultados"
    class="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-sheet border border-b-0 border-line bg-surface-card shadow-lg md:static md:!h-full md:rounded-none md:border-0 md:border-l md:shadow-none"
    :class="[dragging ? '' : 'transition-[height] duration-200 motion-reduce:transition-none', heightClass]"
    :style="dragging ? { height: `${liveHeight}px` } : undefined"
  >
    <button
      type="button"
      class="flex min-h-11 w-full shrink-0 touch-none items-center justify-center md:hidden"
      :aria-label="label"
      :aria-expanded="state !== 'collapsed'"
      @click="onTap"
      @keydown.up.prevent="step(1)"
      @keydown.down.prevent="step(-1)"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <span class="h-1.5 w-12 rounded-full bg-line-strong" aria-hidden="true" />
    </button>
    <!-- Colapsada, la lista no se alcanza con Tab ni con lector de pantalla (S2-17). -->
    <div class="min-h-0 flex-1 overflow-y-auto" :inert="state === 'collapsed' && !desktop ? true : undefined">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

export type SheetState = 'collapsed' | 'half' | 'full'

const ORDER: SheetState[] = ['collapsed', 'half', 'full']
const state = defineModel<SheetState>({ default: 'half' })

// Desde md la lista es un panel fijo sin asa: aunque haya quedado «colapsada» en mobile, tiene que seguir alcanzable.
const wide = window.matchMedia('(min-width: 768px)')
const desktop = ref(wide.matches)
const onWide = (e: MediaQueryListEvent) => (desktop.value = e.matches)
wide.addEventListener('change', onWide)
onBeforeUnmount(() => wide.removeEventListener('change', onWide))

const sheet = ref<HTMLElement | null>(null)
const dragging = ref(false)
const liveHeight = ref(0)
let startY = 0
let startHeight = 0
let moved = false

const COLLAPSED_PX = 56

const heightClass = computed(
  () => ({ collapsed: 'h-14', half: 'h-1/2', full: 'h-full' })[state.value],
)
const label = computed(
  () =>
    ({
      collapsed: 'Mostrar la lista de resultados',
      half: 'Agrandar la lista de resultados',
      full: 'Ocultar la lista de resultados',
    })[state.value],
)

function step(delta: 1 | -1): void {
  const next = ORDER.indexOf(state.value) + delta
  if (next >= 0 && next < ORDER.length) state.value = ORDER[next]!
}

/** Un toque sin arrastre recorre las tres alturas: colapsada → media → completa → colapsada. */
function onTap(): void {
  if (moved) {
    moved = false
    return
  }
  state.value = ORDER[(ORDER.indexOf(state.value) + 1) % ORDER.length]!
}

function onDown(e: PointerEvent): void {
  if (!sheet.value) return
  startY = e.clientY
  startHeight = sheet.value.getBoundingClientRect().height
  moved = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent): void {
  if (!sheet.value || !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return
  const delta = startY - e.clientY
  if (!dragging.value && Math.abs(delta) < 6) return
  dragging.value = true
  moved = true
  const max = sheet.value.parentElement?.clientHeight ?? startHeight
  liveHeight.value = Math.min(max, Math.max(COLLAPSED_PX, startHeight + delta))
}

/** Al soltar queda la altura más cercana. */
function onUp(e: PointerEvent): void {
  const target = e.currentTarget as HTMLElement
  if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
  if (!dragging.value || !sheet.value) return
  dragging.value = false
  const max = sheet.value.parentElement?.clientHeight ?? liveHeight.value
  const targets: Record<SheetState, number> = { collapsed: COLLAPSED_PX, half: max / 2, full: max }
  state.value = ORDER.reduce((best, s) =>
    Math.abs(targets[s] - liveHeight.value) < Math.abs(targets[best] - liveHeight.value) ? s : best,
  )
}
</script>
