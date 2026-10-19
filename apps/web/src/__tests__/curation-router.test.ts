import { afterEach, describe, expect, it } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/router'
import { robotsGuard } from '@/lib/curation'
import AppRoot from '@/App.vue'

describe('rutas de curación', () => {
  it('[AC-22] existen antes del catch-all, con noindex y sin tab bar; /curacion redirige', () => {
    const paths = routes.map((r) => r.path)
    const catchAll = paths.indexOf('/:pathMatch(.*)*')
    for (const p of ['/curacion/eventos', '/curacion/lugares']) {
      const i = paths.indexOf(p)
      expect(i, p).toBeGreaterThan(-1)
      expect(i, p).toBeLessThan(catchAll)
      expect(routes[i]!.meta).toMatchObject({ noindex: true, hideTabBar: true })
    }
    const base = routes.find((r) => r.path === '/curacion')
    expect(base?.redirect).toBe('/curacion/eventos')
  })

  it('[AC-22] ninguna ruta pública enlaza a la curación', () => {
    const publicRoutes = routes.filter((r) => !r.path.startsWith('/curacion'))
    expect(publicRoutes.every((r) => !r.meta?.noindex)).toBe(true)
  })
})

describe('robotsGuard', () => {
  afterEach(() => document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove()))

  it('[AC-23] pone el meta al entrar a una ruta noindex y lo quita al salir', () => {
    robotsGuard({ meta: { noindex: true } })
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    robotsGuard({ meta: {} })
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })
})

describe('App', () => {
  let app: App
  afterEach(() => app?.unmount())

  const mountAt = async (meta: Record<string, unknown>) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/x', component: { template: '<main>pantalla</main>' }, meta }],
    })
    app = createApp(AppRoot)
    app.use(router)
    const root = document.createElement('div')
    document.body.appendChild(root)
    await router.push('/x')
    app.mount(root)
    await nextTick()
    return root
  }

  it('[AC-22] sin tab bar en las rutas con hideTabBar; con tab bar en el resto', async () => {
    const curacion = await mountAt({ hideTabBar: true })
    expect(curacion.querySelector('nav[aria-label="Secciones"]')).toBeNull()
    app.unmount()
    const publica = await mountAt({})
    expect(publica.querySelector('nav[aria-label="Secciones"]')).not.toBeNull()
  })
})
