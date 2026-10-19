import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { robotsGuard } from '@/lib/curation'

// La URL es la fuente de verdad de la búsqueda (S2-3). `/e/:id` es el Detalle de evento y `/l/:id` el de lugar.
// `/curacion/*` es una sección interna sin enlaces desde el sitio: no se indexa y no muestra la tab bar.
export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('../views/HomeView.vue') },
  { path: '/resultados', component: () => import('../views/ResultadosView.vue') },
  // El Detalle no es una pestaña: la tab bar marca Resultados (S4-7).
  { path: '/e/:id', component: () => import('../views/EventoView.vue'), meta: { tab: 'resultados' } },
  { path: '/l/:id', component: () => import('../views/LugarView.vue'), meta: { tab: 'resultados' } },
  { path: '/zona', component: () => import('../views/ZonaView.vue') },
  { path: '/curacion', redirect: '/curacion/eventos' },
  {
    path: '/curacion/eventos',
    component: () => import('../views/CuracionEventosView.vue'),
    meta: { noindex: true, hideTabBar: true },
  },
  {
    path: '/curacion/lugares',
    component: () => import('../views/CuracionLugaresView.vue'),
    meta: { noindex: true, hideTabBar: true },
  },
  { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue') },
]

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })
router.afterEach(robotsGuard)

export default router
