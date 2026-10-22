import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api')
  return { ...actual, listEvents: vi.fn(), listPlaces: vi.fn(), listEventSources: vi.fn() }
})

import { ApiError, listEventSources, listEvents, listPlaces } from '@/services/api'
import CuracionEventosView from '@/views/CuracionEventosView.vue'
import CuracionLugaresView from '@/views/CuracionLugaresView.vue'

const hoy = () => new Date().toISOString()

const ev = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Show ${id}`,
  description: null,
  intents: ['espectaculo'],
  music_genres: [],
  estado: 'vigente',
  start_date: '2026-10-24',
  end_date: '2026-10-24',
  start_time: '21:00',
  date_text: null,
  venue_name: 'Sala Mayor',
  address: 'Corrientes 100',
  lat: -32.9,
  lon: -60.6,
  place: null,
  price_status: 'free',
  price_from_ars: null,
  image_url: null,
  source_name: 'Cartel',
  source_tier: 'official',
  sources: [
    { name: 'Cartel', url: 'https://cartel.test/e' },
    { name: 'Blog', url: 'https://blog.test/e' },
  ],
  last_seen_at: hoy(),
  missing: ['imagen'],
  ...extra,
})

const pl = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Bar ${id}`,
  kind: 'bar',
  origin: 'osm',
  intents: [],
  offers: ['cena'],
  cuisine: ['café'],
  address: 'Mitre 1',
  lat: -32.9,
  lon: -60.6,
  has_opening_hours: false,
  hours_text: null,
  phone: null,
  website: null,
  instagram: null,
  outdoor: null,
  note: null,
  image_url: null,
  last_seen_at: hoy(),
  missing: ['horario', 'telefono'],
  ...extra,
})

const evPage = (items: unknown[], total = items.length) => ({ items: items as never[], total, page: 1, perPage: 50 })

let app: App
let router: Router
let root: HTMLElement

async function mount(path: string, view = CuracionEventosView, waitFor: () => void = () => expect(root.querySelector('h1')).not.toBeNull()) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/curacion/eventos', component: CuracionEventosView, meta: { hideTabBar: true, noindex: true } },
      { path: '/curacion/lugares', component: CuracionLugaresView, meta: { hideTabBar: true, noindex: true } },
    ],
  })
  void view
  app = createApp({ template: '<RouterView />' })
  app.use(createPinia()).use(PrimeVue).use(router)
  root = document.createElement('div')
  document.body.appendChild(root)
  await router.push(path)
  app.mount(root)
  await vi.waitFor(waitFor)
}

const flush = async () => {
  await new Promise((r) => setTimeout(r))
  await nextTick()
}
const text = () => root.textContent ?? ''
const byText = (sel: string, t: string) => [...root.querySelectorAll<HTMLElement>(sel)].find((e) => e.textContent?.includes(t))

beforeEach(() => {
  vi.mocked(listEvents).mockReset()
  vi.mocked(listPlaces).mockReset()
  vi.mocked(listEventSources).mockReset()
  vi.mocked(listEventSources).mockResolvedValue([
    { name: 'Cartel', count: 12 },
    { name: 'Agenda municipal', count: 5 },
  ])
  vi.unstubAllEnvs()
})

afterEach(() => {
  app.unmount()
  root.remove()
})

describe('Curación · eventos', () => {
  it('[AC-26] cargando: esqueleto anunciado', async () => {
    vi.mocked(listEvents).mockReturnValue(new Promise(() => {}))
    await mount('/curacion/eventos')
    const status = root.querySelector('[role="status"]')!
    expect(status.textContent).toContain('Cargando')
    expect(status.querySelectorAll('.p-skeleton').length).toBeGreaterThan(1)
  })

  it('[AC-26] si falla una recarga con filas visibles, un solo aviso con Reintentar', async () => {
    vi.mocked(listEvents).mockResolvedValueOnce(evPage([ev('e1')]))
    await mount('/curacion/eventos', CuracionEventosView, () => expect(root.querySelector('table')).not.toBeNull())
    vi.mocked(listEvents).mockRejectedValueOnce(new ApiError(503, 'Error 503'))
    await router.push({ query: { q: 'x' } })
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')).not.toBeNull())
    expect(root.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(root.querySelector('table')).not.toBeNull()
  })

  it('[AC-24] escribir en el buscador agrega una entrada al historial: Atrás la restaura', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')]))
    await mount('/curacion/eventos', CuracionEventosView, () => expect(root.querySelector('table')).not.toBeNull())
    vi.useFakeTimers()
    try {
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!
      input.value = 'tango'
      input.dispatchEvent(new Event('input'))
      await vi.advanceTimersByTimeAsync(400)
      expect(router.currentRoute.value.query).toEqual({ q: 'tango' })
      router.back()
      await vi.advanceTimersByTimeAsync(50)
      expect(router.currentRoute.value.query).toEqual({})
    } finally {
      vi.useRealTimers()
    }
  })

  it('[AC-27] columnas, enlace a pestaña nueva, estado, visto, fuente con vías y faltantes', async () => {
    vi.mocked(listEvents).mockResolvedValue(
      evPage([
        ev('e1'),
        ev('e2', { estado: 'pasado', last_seen_at: '2026-10-10T10:00:00Z', venue_name: null, address: null, lat: null, lon: null, missing: ['lugar', 'direccion'] }),
      ], 312),
    )
    await mount('/curacion/eventos', CuracionEventosView, () => expect(root.querySelector('table')).not.toBeNull())
    const heads = [...root.querySelectorAll('th')].map((h) => h.textContent?.trim())
    for (const h of ['Fecha', 'Hora', 'Título', 'Lugar', 'Fuente', 'Precio', 'Estado', 'Visto', 'Faltan']) {
      expect(heads, h).toContain(h)
    }
    const link = root.querySelector<HTMLAnchorElement>('a[href="/e/e1"]')!
    expect(link.textContent).toContain('Show e1')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(text()).toContain('Cartel')
    expect(text()).toContain('+1 vía')
    expect(text()).toContain('hoy')
    expect(text()).toContain('Vigente')
    expect(text()).toContain('Pasado')
    expect(text()).toContain('— sin lugar')
    expect(root.querySelector('tr[data-estado="pasado"]')).not.toBeNull()
    expect(root.querySelector('tr[data-estado="vigente"]')).not.toBeNull()
    expect(text()).toContain('Exportar CSV (312)')
  })

  it('[AC-26] sin resultados con filtros: «Limpiar filtros» deja la URL sin filtros', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([], 0))
    await mount('/curacion/eventos?q=zzz', CuracionEventosView, () => expect(text()).toContain('Sin resultados'))
    byText('button', 'Limpiar filtros')!.click()
    await flush()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('[AC-26] catálogo vacío (sin filtros) distinto de sin resultados', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([], 0))
    await mount('/curacion/eventos', CuracionEventosView, () => expect(text()).toContain('Todavía no hay eventos'))
    expect(text()).not.toContain('Limpiar filtros')
  })

  it('[AC-26] error con «Reintentar»', async () => {
    vi.mocked(listEvents).mockRejectedValueOnce(new ApiError(503, 'Error 503'))
    vi.mocked(listEvents).mockResolvedValueOnce(evPage([ev('e1')]))
    await mount('/curacion/eventos', CuracionEventosView, () => expect(root.querySelector('[role="alert"]')).not.toBeNull())
    expect(text()).toContain('Error 503')
    byText('button', 'Reintentar')!.click()
    await vi.waitFor(() => expect(root.querySelector('a[href="/e/e1"]')).not.toBeNull())
  })

  it('[AC-24] la URL manda: los filtros de la URL viajan al API', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')]))
    await mount('/curacion/eventos?estado=pasado&faltan=imagen,hora&q=tango&page=2&fuente=Cartel')
    await vi.waitFor(() => expect(listEvents).toHaveBeenCalled())
    expect(vi.mocked(listEvents).mock.calls[0]![0]).toMatchObject({
      q: 'tango',
      estado: ['pasado'],
      faltan: ['imagen', 'hora'],
      fuente: ['Cartel'],
      page: 2,
    })
  })

  it('[AC-24] cambiar un filtro vuelve a la página 1 y actualiza la URL', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')], 200))
    await mount('/curacion/eventos?page=3', CuracionEventosView, () => expect(root.querySelector('table')).not.toBeNull())
    const box = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) =>
      i.closest('label')?.textContent?.includes('Pasado'),
    )!
    box.click()
    await flush()
    expect(router.currentRoute.value.query).toEqual({ estado: 'pasado' })
  })

  it('[AC-24] el buscador no pisa lo que se escribe: el espacio final sobrevive a la pausa del debounce', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')]))
    await mount('/curacion/eventos', CuracionEventosView, () => expect(root.querySelector('table')).not.toBeNull())
    vi.useFakeTimers()
    try {
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!
      input.value = 'foo '
      input.dispatchEvent(new Event('input'))
      await vi.advanceTimersByTimeAsync(400)
      expect(router.currentRoute.value.query).toEqual({ q: 'foo' })
      expect(input.value).toBe('foo ')
    } finally {
      vi.useRealTimers()
    }
  })

  it('[AC-7] la URL que llega con retraso no pisa lo que se sigue escribiendo', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')]))
    await mount('/curacion/eventos', CuracionEventosView, () => expect(root.querySelector('table')).not.toBeNull())
    vi.useFakeTimers()
    try {
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!
      input.value = 'a'
      input.dispatchEvent(new Event('input'))
      vi.advanceTimersByTime(300) // dispara el push, que todavía no resolvió
      input.value = 'ab'
      input.dispatchEvent(new Event('input'))
      await vi.advanceTimersByTimeAsync(0) // ahora la URL llega con q=a
      expect(router.currentRoute.value.query).toEqual({ q: 'a' })
      expect(input.value).toBe('ab')
      await vi.advanceTimersByTimeAsync(400)
      expect(router.currentRoute.value.query).toEqual({ q: 'ab' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('[AC-8] «Limpiar filtros» cancela la búsqueda pendiente', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([], 0))
    await mount('/curacion/eventos?q=zzz', CuracionEventosView, () => expect(text()).toContain('Sin resultados'))
    vi.useFakeTimers()
    try {
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!
      input.value = 'x'
      input.dispatchEvent(new Event('input'))
      byText('button', 'Limpiar filtros')!.click()
      await vi.advanceTimersByTimeAsync(400)
      expect(router.currentRoute.value.query).toEqual({})
      expect(input.value).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('[AC-8] «Limpiar filtros» vacía el campo aunque la URL no tuviera q', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([], 0))
    await mount('/curacion/eventos?estado=pasado', CuracionEventosView, () => expect(text()).toContain('Sin resultados'))
    vi.useFakeTimers()
    try {
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!
      input.value = 'x'
      input.dispatchEvent(new Event('input'))
      byText('button', 'Limpiar filtros')!.click()
      await vi.advanceTimersByTimeAsync(400)
      expect(router.currentRoute.value.query).toEqual({})
      expect(input.value).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('[AC-24] Atrás y «Limpiar filtros» sí actualizan el buscador', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([], 0))
    await mount('/curacion/eventos?q=zzz', CuracionEventosView, () => expect(text()).toContain('Sin resultados'))
    const input = root.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(input.value).toBe('zzz')
    byText('button', 'Limpiar filtros')!.click()
    await flush()
    expect(input.value).toBe('')
  })

  it('[AC-24] los valores inválidos de la URL se ignoran', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')]))
    await mount('/curacion/eventos?estado=nada&page=abc')
    await vi.waitFor(() => expect(listEvents).toHaveBeenCalled())
    expect(vi.mocked(listEvents).mock.calls[0]![0]).toMatchObject({ page: 1 })
    expect(vi.mocked(listEvents).mock.calls[0]![0].estado ?? []).toEqual([])
  })

  it('[AC-28] cartel de entorno fijo con VITE_ENV_LABEL; sin la variable dice producción', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')]))
    vi.stubEnv('VITE_ENV_LABEL', 'staging')
    await mount('/curacion/eventos')
    expect(root.querySelector('[data-testid="env-banner"]')?.textContent?.toLowerCase()).toContain('staging')
    app.unmount()
    root.remove()
    vi.stubEnv('VITE_ENV_LABEL', '')
    await mount('/curacion/eventos')
    expect(root.querySelector('[data-testid="env-banner"]')?.textContent?.toLowerCase()).toContain('producción')
  })

  it('[AC-22] pestañas Eventos / Lugares', async () => {
    vi.mocked(listEvents).mockResolvedValue(evPage([ev('e1')]))
    await mount('/curacion/eventos')
    const nav = root.querySelector('nav[aria-label="Curación"]')!
    expect(nav.querySelector('a[href="/curacion/eventos"]')?.getAttribute('aria-current')).toBe('page')
    expect(nav.querySelector('a[href="/curacion/lugares"]')).not.toBeNull()
  })
})

describe('Curación · lugares', () => {
  it('[AC-27] columnas, enlace a /l/:id y faltantes', async () => {
    vi.mocked(listPlaces).mockResolvedValue(evPage([pl('p1')], 2400))
    await mount('/curacion/lugares', CuracionLugaresView, () => expect(root.querySelector('table')).not.toBeNull())
    const heads = [...root.querySelectorAll('th')].map((h) => h.textContent?.trim())
    for (const h of ['Nombre', 'Tipo', 'Origen', 'Dirección', 'Coords', 'Visto', 'Faltan']) expect(heads, h).toContain(h)
    const link = root.querySelector<HTMLAnchorElement>('a[href="/l/p1"]')!
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(text()).toContain('café')
    expect(text()).toContain('horario')
    expect(text()).toContain('Exportar CSV (2400)')
  })

  it('[AC-26] catálogo vacío de lugares', async () => {
    vi.mocked(listPlaces).mockResolvedValue(evPage([], 0))
    await mount('/curacion/lugares', CuracionLugaresView, () => expect(text()).toContain('Todavía no hay lugares'))
  })
})
