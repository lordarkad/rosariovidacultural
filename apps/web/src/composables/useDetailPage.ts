import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { backTarget, originFromState, type Origin } from '@/lib/detail'

/**
 * Lo común del Detalle de evento y de lugar (S4-4, S4-5, S4-14, S4-15; L-12): carga por `:id` con el origen del
 * `history.state`, foco al `h1` y scroll al inicio en cada carga, título de la pestaña y «Volver».
 */
export function useDetailPage(options: {
  desde: 'evento' | 'lugar'
  /** Pide el recurso al store; resuelve cuando terminó (con o sin error). */
  fetch: (id: string, origin: Origin | null) => Promise<void>
  /** Nombre del recurso cargado: va al título de la pestaña; `undefined` mientras no hay. */
  title: () => string | undefined
  /** Estado propio de la vista que se reinicia en cada carga. */
  reset?: () => void
}) {
  const route = useRoute()
  const router = useRouter()

  const heading = ref<HTMLElement | null>(null)
  const scroller = ref<HTMLElement | null>(null)
  // El origen de la distancia vive en `history.state` de esta entrada: sobrevive a la recarga (S4-3).
  // shallowRef: el origen va al `state` del router y `history.replaceState` no clona un Proxy reactivo.
  const origin = shallowRef(originFromState(history.state))
  const back = ref(backTarget(history.state, options.desde))

  const id = computed(() => String(route.params.id ?? ''))
  const backLabel = computed(() => (back.value.label === 'lugar' ? 'Volver al lugar' : 'Volver a resultados'))

  async function load(): Promise<void> {
    const mine = id.value
    options.reset?.()
    origin.value = originFromState(history.state)
    back.value = backTarget(history.state, options.desde)
    await options.fetch(mine, origin.value)
    // Una carga más nueva (otro id) ya tomó el control: no se roba el foco.
    if (mine !== id.value) return
    await nextTick()
    scroller.value?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
    heading.value?.focus()
  }

  function goBack(): void {
    if (back.value.action === 'back') router.back()
    else void router.push('/resultados')
  }

  // El router reutiliza el componente entre `/e/A` y `/e/B` (S4-15).
  // Al salir del Detalle `route.params.id` queda vacío antes de desmontar: no hay nada que cargar.
  watch(id, (v) => { if (v) void load() }, { immediate: true })

  // El título original se captura una sola vez y se restaura al salir (S4-4).
  const originalTitle = document.title
  watch(options.title, (title) => {
    document.title = title ? `${title} · Rosario, qué hacer` : originalTitle
  })
  onBeforeUnmount(() => {
    document.title = originalTitle
  })

  return { heading, scroller, origin, backLabel, load, goBack }
}
