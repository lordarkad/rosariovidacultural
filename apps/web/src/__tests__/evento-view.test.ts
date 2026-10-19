import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, isReactive, nextTick, type App } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { createMemoryHistory, createRouter, createWebHistory, type Router } from 'vue-router'
import type { EventDetail } from '@tript/shared'

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api')
  return { ...actual, getEvent: vi.fn() }
})

import { ApiError, getEvent } from '@/services/api'
import { originFromState } from '@/lib/detail'
import EventoView from '@/views/EventoView.vue'

const ev = (id: string, extra: Partial<EventDetail> = {}) =>
  ({
    id,
    title: `Evento ${id}`,
    description: null,
    music_genres: [],
    start_date: '2026-10-24',
    end_date: '2026-10-24',
    start_time: '21:00',
    date_text: null,
    venue_name: 'Sala A',
    place: null,
    address: null,
    lat: -32.9,
    lon: -60.6,
    location_known: true,
    distance_m: null,
    walk_minutes: null,
    price_status: 'free',
    price_from_ars: null,
    image_url: null,
    sources: [{ name: 'Fuente', url: 'https://ej.com/e' }],
    also_at: [],
    is_stale: false,
    ...extra,
  }) as unknown as EventDetail

let app: App
let router: Router
let root: HTMLElement

async function mount(path: string): Promise<void> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/e/:id', component: EventoView, meta: { tab: 'resultados' } },
      { path: '/l/:id', component: { template: '<div />' } },
      { path: '/resultados', component: { template: '<div />' } },
    ],
  })
  app = createApp({ template: '<RouterView />' })
  app.use(createPinia()).use(PrimeVue).use(router)
  root = document.createElement('div')
  document.body.appendChild(root)
  await router.push(path)
  app.mount(root)
  await vi.waitFor(() => expect(root.querySelector('h1')).not.toBeNull())
}

const flush = async () => {
  await new Promise((r) => setTimeout(r))
  await nextTick()
}

beforeEach(() => {
  vi.mocked(getEvent).mockReset()
  document.title = 'Rosario, qué hacer'
})

afterEach(() => {
  app.unmount()
  root.remove()
})

describe('EventoView', () => {
  it('[AC-9] is_stale muestra «datos de ayer» con role=status; false no', async () => {
    vi.mocked(getEvent).mockResolvedValue(ev('a', { is_stale: true }))
    await mount('/e/a')
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Datos de ayer')
    app.unmount()
    root.remove()

    vi.mocked(getEvent).mockResolvedValue(ev('b', { is_stale: false }))
    await mount('/e/b')
    expect(root.textContent).not.toContain('Datos de ayer')
  })

  it('[AC-15] con place el nombre del lugar enlaza a /l/:id con el origen en el state; sin place es texto', async () => {
    history.replaceState({ origin: { lat: -32.9, lon: -60.6 } }, '')
    vi.mocked(getEvent).mockResolvedValue(ev('a', { place: { id: 'p1', name: 'Bar Uno' } }))
    await mount('/e/a')
    const link = [...root.querySelectorAll<HTMLAnchorElement>('a')].find((a) => a.textContent?.trim() === 'Bar Uno')!
    expect(link.getAttribute('href')).toBe('/l/p1')
    const spy = vi.spyOn(router, 'push')
    link.click()
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
    expect((spy.mock.calls[0]![0] as { state?: { origin?: unknown } }).state?.origin).toEqual({ lat: -32.9, lon: -60.6 })
    app.unmount()
    root.remove()

    vi.mocked(getEvent).mockResolvedValue(ev('b', { place: null }))
    await mount('/e/b')
    expect([...root.querySelectorAll('a')].some((a) => a.getAttribute('href')?.startsWith('/l/'))).toBe(false)
    expect(root.textContent).toContain('Sala A')
  })

  it('[AC-14] «Volver» rotula «a resultados» en una entrada directa y los tres estados lo ofrecen', async () => {
    vi.mocked(getEvent).mockResolvedValue(ev('a'))
    await mount('/e/a')
    expect([...root.querySelectorAll('button')].some((b) => b.textContent?.includes('Volver a resultados'))).toBe(true)
    app.unmount()
    root.remove()

    vi.mocked(getEvent).mockRejectedValue(new ApiError(404, 'x'))
    await mount('/e/x')
    expect([...root.querySelectorAll('button')].some((b) => b.textContent?.includes('Volver'))).toBe(true)
  })

  it('[AC-14] llegado desde un lugar, «Volver» se rotula «Volver al lugar» y hace router.back()', async () => {
    vi.mocked(getEvent).mockResolvedValue(ev('a'))
    // `backTarget` lee `window.history.state`, que la memory history no escribe
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/e/:id', component: EventoView, meta: { tab: 'resultados' } },
        { path: '/l/:id', component: { template: '<div />' } },
        { path: '/resultados', component: { template: '<div />' } },
      ],
    })
    app = createApp({ template: '<RouterView />' })
    app.use(createPinia()).use(PrimeVue).use(router)
    root = document.createElement('div')
    document.body.appendChild(root)
    await router.push('/l/p1')
    await router.push('/e/a')
    app.mount(root)
    await vi.waitFor(() => expect(root.querySelector('h1')).not.toBeNull())
    const back = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('Volver al lugar'))!
    expect(back).toBeDefined()
    const spy = vi.spyOn(router, 'back')
    back.click()
    expect(spy).toHaveBeenCalled()
  })

  it('[AC-11] sin hermanos no hay bloque; con hermanos enlazan a su /e/:id y «Otra sede» sin nombre', async () => {
    vi.mocked(getEvent).mockResolvedValue(
      ev('a', { also_at: [{ id: 'h1', venue_name: 'Sala B' }, { id: 'h2', venue_name: null, address: null }] }),
    )
    await mount('/e/a')
    const links = [...root.querySelectorAll('section[aria-labelledby="also-at"] a')]
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/e/h1', '/e/h2'])
    expect(links.map((l) => l.textContent?.trim())).toEqual(['Sala B', 'Otra sede'])
    app.unmount()
    root.remove()

    vi.mocked(getEvent).mockResolvedValue(ev('b'))
    await mount('/e/b')
    expect(root.querySelector('#also-at')).toBeNull()
  })

  it('[AC-11] el hermano se abre con replace y la distancia se conserva', async () => {
    vi.mocked(getEvent)
      .mockResolvedValueOnce(ev('a', { also_at: [{ id: 'h1', venue_name: 'Sala B' }] }))
      .mockResolvedValueOnce(ev('h1'))
    await mount('/e/a')
    const before = router.options.history.state.position
    root.querySelector<HTMLAnchorElement>('section[aria-labelledby="also-at"] a')!.click()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/e/h1'))
    expect(router.options.history.state.position).toBe(before)
  })

  it('[AC-13] el título de la pestaña refleja el evento y se restaura al salir, también tras A → B', async () => {
    vi.mocked(getEvent).mockResolvedValueOnce(ev('a', { also_at: [{ id: 'b' }] })).mockResolvedValueOnce(ev('b'))
    await mount('/e/a')
    await flush()
    expect(document.title).toBe('Evento a · Rosario, qué hacer')

    await router.replace('/e/b')
    await vi.waitFor(() => expect(document.title).toBe('Evento b · Rosario, qué hacer'))

    await router.push('/resultados')
    await flush()
    expect(document.title).toBe('Rosario, qué hacer')
  })

  it('[AC-5][AC-13] al salir del Detalle no se pide ningún evento más', async () => {
    vi.mocked(getEvent).mockResolvedValue(ev('a'))
    await mount('/e/a')
    await flush()
    expect(getEvent).toHaveBeenCalledTimes(1)
    await router.push('/resultados')
    await flush()
    expect(vi.mocked(getEvent).mock.calls.map((c) => c[0])).toEqual(['a'])
  })

  it('[AC-11] el state que se le pasa al router es clonable (sin Proxy reactivo)', async () => {
    vi.mocked(getEvent).mockResolvedValue(ev('a', { also_at: [{ id: 'h1', venue_name: 'Sala B' }] }))
    // el origen viene del `history.state` de la entrada actual, como tras navegar desde Resultados
    history.replaceState({ origin: { lat: -32.9, lon: -60.6 } }, '')
    await mount('/e/a')
    const spy = vi.spyOn(router, 'replace')
    root.querySelector<HTMLAnchorElement>('section[aria-labelledby="also-at"] a')!.click()
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
    const state = (spy.mock.calls[0]![0] as { state?: unknown }).state
    const origin = (state as { origin?: object }).origin
    expect(origin).toBeDefined()
    expect(isReactive(origin)).toBe(false)
  })

  it('[AC-3][AC-11] el origen sobrevive en history.state tras un replace a un hermano (lo que lee la recarga)', async () => {
    const r = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/e/:id', component: { template: '<div />' } }],
    })
    await r.push({ path: '/e/a', state: { origin: { lat: -32.9, lon: -60.6 } } })
    await r.replace({ path: '/e/b', state: { origin: { lat: -32.9, lon: -60.6 } } })
    expect(history.state.origin).toEqual({ lat: -32.9, lon: -60.6 })
    expect(originFromState(history.state)).toEqual({ lat: -32.9, lon: -60.6 })
  })
})
