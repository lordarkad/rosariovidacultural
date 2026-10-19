<template>
  <main class="mx-auto max-w-xl px-4 py-6">
    <p class="rq-meta">Rosario</p>
    <h1 class="mt-1 text-3xl">¿Qué hacemos hoy?</h1>

    <form class="mt-6 space-y-6" @submit.prevent="submit">
      <fieldset>
        <legend class="rq-meta mb-2">¿Qué querés hacer?</legend>
        <div class="flex flex-wrap gap-2">
          <ChipToggle
            v-for="o in INTENTS"
            :key="o.value"
            :label="o.label"
            :pressed="form.i.includes(o.value)"
            @click="toggle(form.i, o.value)"
          />
        </div>
        <input
          v-model="form.q"
          type="search"
          maxlength="80"
          aria-label="Buscar por texto"
          placeholder="O escribí algo: jazz, pizza, teatro…"
          class="mt-3 min-h-11 w-full rounded-input border border-line bg-surface-card px-3.5"
        />
      </fieldset>

      <fieldset v-if="showGenres">
        <legend class="rq-meta mb-2">¿Qué música?</legend>
        <div class="flex flex-wrap gap-2">
          <ChipToggle
            v-for="g in GENRES"
            :key="g.value"
            :label="g.label"
            :pressed="form.musica.includes(g.value)"
            @click="toggle(form.musica, g.value)"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend class="rq-meta mb-2">¿Cuándo?</legend>
        <div class="flex flex-wrap gap-2">
          <ChipToggle
            v-for="c in CUANDO"
            :key="c.value"
            :label="c.label"
            :pressed="form.cuando === c.value"
            @click="form.cuando = c.value"
          />
          <ChipToggle label="Gratis" :pressed="form.gratis" @click="form.gratis = !form.gratis" />
        </div>
        <label v-if="form.cuando === 'fecha'" class="mt-3 block">
          <span class="rq-meta">Día</span>
          <input
            v-model="form.fecha"
            type="date"
            :min="today"
            required
            class="mt-1 min-h-11 w-full rounded-input border border-line bg-surface-card px-3.5"
          />
        </label>
      </fieldset>

      <Button type="submit" label="Buscar →" size="large" fluid />
    </form>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import type { Intent, MusicGenre } from '@tript/shared'
import ChipToggle from '@/components/ChipToggle.vue'
import { todayInBuenosAires } from '@/lib/format'
import { CUANDO, GENRES, INTENTS, hasMusicIntent, parseSearch, toRouteQuery } from '@/lib/search-query'
import type { Cuando } from '@/services/api'

const route = useRoute()
const router = useRouter()
const today = todayInBuenosAires()

// Si se llega desde la frase de Resultados, el formulario arranca con la búsqueda de la URL (S2-3).
const initial = parseSearch(route.query)
const form = reactive({
  i: [...(initial.i ?? [])] as Intent[],
  musica: [...(initial.musica ?? [])] as MusicGenre[],
  q: initial.q ?? '',
  gratis: initial.gratis ?? false,
  cuando: (initial.cuando ?? 'hoy') as Cuando,
  fecha: initial.fecha ?? '',
  z: initial.z,
  lat: initial.lat,
  lon: initial.lon,
  radio_m: initial.radio_m,
})

const showGenres = computed(() => hasMusicIntent(form.i))

function toggle<T>(list: T[], value: T): void {
  const at = list.indexOf(value)
  if (at >= 0) list.splice(at, 1)
  else list.push(value)
}

function submit(): void {
  const query = toRouteQuery({
    i: form.i,
    musica: form.musica,
    q: form.q.trim(),
    gratis: form.gratis,
    cuando: form.cuando,
    fecha: form.cuando === 'fecha' ? form.fecha : undefined,
    z: form.z,
    lat: form.lat,
    lon: form.lon,
    radio_m: form.radio_m,
  })
  void router.push({ path: '/resultados', query })
}
</script>
