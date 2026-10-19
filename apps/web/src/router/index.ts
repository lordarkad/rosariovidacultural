import { createRouter, createWebHistory } from 'vue-router'

// La URL es la fuente de verdad de la búsqueda (S2-3). `/e/:id` es el Detalle de evento y `/l/:id` el de lugar.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('../views/HomeView.vue') },
    { path: '/resultados', component: () => import('../views/ResultadosView.vue') },
    // El Detalle no es una pestaña: la tab bar marca Resultados (S4-7).
    { path: '/e/:id', component: () => import('../views/EventoView.vue'), meta: { tab: 'resultados' } },
    { path: '/l/:id', component: () => import('../views/LugarView.vue'), meta: { tab: 'resultados' } },
    { path: '/zona', component: () => import('../views/ZonaView.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue') },
  ],
})

export default router
