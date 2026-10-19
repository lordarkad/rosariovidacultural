import { createRouter, createWebHistory } from 'vue-router'

// La URL es la fuente de verdad de la búsqueda (S2-3); el Detalle (`/e/:id`, `/l/:id`) se suma con su slice.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('../views/HomeView.vue') },
    { path: '/resultados', component: () => import('../views/ResultadosView.vue') },
    { path: '/zona', component: () => import('../views/ZonaView.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue') },
  ],
})

export default router
