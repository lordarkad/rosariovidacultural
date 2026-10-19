import { createRouter, createWebHistory } from 'vue-router'

// La URL es la fuente de verdad de la búsqueda (S2-3); las rutas de Resultados, Zona y Detalle se suman con su slice.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('../views/HomeView.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue') },
  ],
})

export default router
