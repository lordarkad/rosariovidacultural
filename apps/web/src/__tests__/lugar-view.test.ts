import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { PlaceDetail } from '@tript/shared'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api')
  return { ...actual, getPlace: vi.fn() }
})

import { ApiError, getPlace } from '@/services/api'
import LugarView from '@/views/LugarView.vue'

const inOneHour = () => new Date(Date.now() + 3600_000).toISOString()

const upcoming = (n: number, extra: Record<string, unknown> = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    title: `Show ${i + 1}`,
    start_date: '2026-10-24',
    end_date: '2026-10-24',
    start_time: '21:00',
    price_status: 'free',
    price_from_ars: null,
    ...extra,
  }))

const pl = (id: string, extra: Partial<PlaceDetail> = {}) =>
  ({
    id,
    name: `Bar ${id}`,
    kind: 'bar',
    origin: 'curated',
    intents: ['bailar'],
    offers: ['musica_en_vivo'],
    cuisine: ['parrilla', 'pizzas'],
    address: 'Corrientes 1234',
    lat: -32.9,
    lon: -60.6,
    location_known: true,
    distance_m: 850,
    walk_minutes: 11,
    opening_hours: [{ day: 2, opens: '12:00', closes: '23:00' }],
    hours_text: null,
    open_now: true,
    next_change_at: inOneHour(),
    phone: '+54 9 341 555-1234',
    website: 'https://bar.example.com/',
    instagram: 'el_bar',
    outdoor: true,
    note: null,
    image_url: null,
    upcoming_events: [],
    last_seen_at: '2026-10-19T10:00:00Z',
    ...extra,
  }) as unknown as PlaceDetail

let app: App
let router: Router
let root: HTMLElement

async function mount(path: string, waitFor: () => void = () => expect(root.querySelector('h1')).not.toBeNull()): Promise<void> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/l/:id', component: LugarView, meta: { tab: 'resultados' } },
      { path: '/e/:id', component: { template: '<div />' } },
      { path: '/resultados', component: { template: '<div />' } },
    ],
  })
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
  vi.mocked(getPlace).mockReset()
  document.title = 'Rosario, qué hacer'
})

afterEach(() => {
  app.unmount()
  root.remove()
})

describe('LugarView', () => {
  it('[AC-1][AC-9] título h1, etiquetas, cocina aparte y sin intents', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    expect(root.querySelector('h1')?.textContent).toBe('Bar a')
    const t = text()
    expect(t).toContain('Lugar')
    expect(t).toContain('Bar')
    expect(t).toContain('Música en vivo')
    expect(t).toContain('Aire libre')
    expect(t).toContain('Cocina')
    expect(t).toContain('parrilla')
    expect(t).toContain('pizzas')
    expect(t).not.toContain('bailar')
  })

  it('[AC-5] el estado de horario sale del servidor: abierto con el cierre', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    expect(text()).toContain('Abierto ahora · cierra')
  })

  it('[AC-5] sin horario estructurado muestra el texto de la fuente y no ofrece la semana', async () => {
    vi.mocked(getPlace).mockResolvedValue(
      pl('a', { open_now: null, next_change_at: null, opening_hours: null, hours_text: 'Mo-Sa 12:00-23:00' }),
    )
    await mount('/l/a')
    expect(text()).toContain('Según la fuente: Mo-Sa 12:00-23:00')
    expect(byText('button', 'Ver horarios de la semana')).toBeUndefined()
  })

  it('[AC-6] la semana está plegada y se abre con aria-expanded', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    const btn = byText('button', 'Ver horarios de la semana')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(root.querySelectorAll('[data-week-row]').length).toBe(0)
    btn.click()
    await nextTick()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    const rows = [...root.querySelectorAll('[data-week-row]')]
    expect(rows.length).toBe(7)
    expect(rows[0]!.textContent).toContain('Lunes')
    expect(rows.filter((r) => r.textContent?.includes('(hoy)')).length).toBe(1)
  })

  it('[AC-7][AC-8] Cómo llegar, WhatsApp, Sitio e Instagram en pestaña nueva con rel seguro', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    const link = (t: string) => byText('a', t) as HTMLAnchorElement | undefined
    expect(link('Cómo llegar')?.href).toContain('destination=-32.9%2C-60.6')
    expect(link('WhatsApp')?.href).toBe('https://wa.me/5493415551234')
    expect(link('Sitio')?.href).toBe('https://bar.example.com/')
    expect(link('Instagram')?.href).toBe('https://www.instagram.com/el_bar/')
    expect(link('Llamar')).toBeUndefined()
    for (const t of ['Cómo llegar', 'WhatsApp', 'Sitio', 'Instagram']) {
      expect(link(t)?.target).toBe('_blank')
      expect(link(t)?.rel).toBe('noopener noreferrer')
    }
  })

  it('[AC-7] fijo → Llamar; sitio no http(s) e Instagram inválido no se enlazan; «15» local se muestra como texto', async () => {
    vi.mocked(getPlace).mockResolvedValue(
      pl('a', { phone: '+54 341 421-1234', website: 'javascript:alert(1)', instagram: '../x' }),
    )
    await mount('/l/a')
    expect((byText('a', 'Llamar') as HTMLAnchorElement).href).toBe('tel:+543414211234')
    expect(byText('a', 'Sitio')).toBeUndefined()
    expect(byText('a', 'Instagram')).toBeUndefined()
    app.unmount()
    root.remove()

    vi.mocked(getPlace).mockResolvedValue(pl('b', { phone: '+54 341 15 555123' }))
    await mount('/l/b')
    expect(byText('a', 'Llamar')).toBeUndefined()
    expect(byText('a', 'WhatsApp')).toBeUndefined()
    expect(text()).toContain('+54 341 15 555123')
  })

  it('[AC-10] sin eventos no hay bloque', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    expect(text()).not.toContain('Próximos eventos')
  })

  it('[AC-10] muestra 5 y «Ver más (N)» muestra todos; cada fila enlaza a /e/:id', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a', { upcoming_events: upcoming(7) as never }))
    await mount('/l/a')
    const rows = () => [...root.querySelectorAll<HTMLAnchorElement>('section[aria-labelledby="upcoming"] a')]
    expect(rows().length).toBe(5)
    expect(rows()[0]!.getAttribute('href')).toBe('/e/e1')
    const more = byText('button', 'Ver más (7)')!
    more.click()
    await nextTick()
    expect(rows().length).toBe(7)
    expect(byText('button', 'Ver menos')).toBeDefined()
  })

  it('[AC-10] rango cuando end_date difiere y sin precio si no se conoce', async () => {
    vi.mocked(getPlace).mockResolvedValue(
      pl('a', {
        upcoming_events: upcoming(1, {
          start_date: '2026-10-03',
          end_date: '2026-10-30',
          price_status: 'unknown',
        }) as never,
      }),
    )
    await mount('/l/a')
    const row = root.querySelector('section[aria-labelledby="upcoming"] a')!
    expect(row.textContent).toContain('Del 3 al 30 oct')
    expect(row.textContent).not.toContain('GRATIS')
    expect(row.textContent).not.toContain('$')
  })

  it('[AC-10] el origen viaja en el state al abrir un evento', async () => {
    history.replaceState({ origin: { lat: -32.9, lon: -60.6 } }, '')
    vi.mocked(getPlace).mockResolvedValue(pl('a', { upcoming_events: upcoming(1) as never }))
    await mount('/l/a')
    const spy = vi.spyOn(router, 'push')
    root.querySelector<HTMLAnchorElement>('section[aria-labelledby="upcoming"] a')!.click()
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
    const arg = spy.mock.calls[0]![0] as { state?: { origin?: unknown } }
    expect(arg.state?.origin).toEqual({ lat: -32.9, lon: -60.6 })
  })

  it('[AC-11] la atribución de OpenStreetMap solo con origin = osm', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a', { origin: 'osm' }))
    await mount('/l/a')
    const a = byText('a', 'OpenStreetMap') as HTMLAnchorElement
    expect(a.href).toBe('https://www.openstreetmap.org/copyright')
    expect(text()).toContain('contribuidores (ODbL)')
    app.unmount()
    root.remove()

    vi.mocked(getPlace).mockResolvedValue(pl('b', { origin: 'curated' }))
    await mount('/l/b')
    expect(text()).not.toContain('OpenStreetMap')
  })

  it('[AC-12] la nota se renderiza como texto, sin interpretar HTML, y solo si existe', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a', { note: 'Pedir <b>mesa</b> afuera\nlos viernes' }))
    await mount('/l/a')
    const quote = root.querySelector('blockquote')!
    expect(quote.querySelector('b')).toBeNull()
    expect(quote.textContent).toContain('<b>mesa</b>')
    app.unmount()
    root.remove()

    vi.mocked(getPlace).mockResolvedValue(pl('b'))
    await mount('/l/b')
    expect(root.querySelector('blockquote')).toBeNull()
  })

  it('[AC-3] la fila de distancia solo existe con distance_m', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    expect(text()).toContain('850 m · 11 min a pie')
    app.unmount()
    root.remove()

    vi.mocked(getPlace).mockResolvedValue(pl('b', { distance_m: null, walk_minutes: null }))
    await mount('/l/b')
    expect(text()).not.toContain('Distancia')
  })

  it('[AC-13] el título de la pestaña refleja el lugar y se restaura al salir; el foco va al h1', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    await flush()
    expect(document.title).toBe('Bar a · Rosario, qué hacer')
    expect(document.activeElement).toBe(root.querySelector('h1'))
    await router.push('/resultados')
    await flush()
    expect(document.title).toBe('Rosario, qué hacer')
  })

  it('[AC-13] al salir del lugar no se pide ninguno más', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    await flush()
    await router.push('/resultados')
    await flush()
    expect(vi.mocked(getPlace).mock.calls.map((c) => c[0])).toEqual(['a'])
  })

  it('[AC-4] 404 → «No encontramos este lugar» con salidas; no es un error de red', async () => {
    vi.mocked(getPlace).mockRejectedValue(new ApiError(404, 'No encontrado'))
    await mount('/l/x')
    expect(root.querySelector('h1')?.textContent).toBe('No encontramos este lugar')
    expect(byText('a', 'Ver resultados')).toBeDefined()
    expect(byText('a', 'Volver al inicio')).toBeDefined()
    expect(root.querySelector('[role="alert"]')).toBeNull()
  })

  it('[AC-4] error de red → alerta con «Reintentar» que vuelve a pedir el lugar', async () => {
    vi.mocked(getPlace).mockRejectedValueOnce(new ApiError(503, 'Error 503')).mockResolvedValueOnce(pl('x'))
    await mount('/l/x')
    expect(root.querySelector('[role="alert"]')).not.toBeNull()
    byText('button', 'Reintentar')!.click()
    await vi.waitFor(() => expect(root.querySelector('h1')?.textContent).toBe('Bar x'))
  })

  it('[AC-14] «Volver» desde una entrada directa rotula «Volver a resultados»', async () => {
    vi.mocked(getPlace).mockResolvedValue(pl('a'))
    await mount('/l/a')
    expect(byText('button', 'Volver a resultados')).toBeDefined()
  })
})
