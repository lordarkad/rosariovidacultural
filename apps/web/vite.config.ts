import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tript/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    // En desarrollo la API de staging se consulta por el mismo origen (la API solo admite CORS de *.pages.dev)
    proxy: {
      '/api': {
        target: 'https://rosariovidacultural-api-staging.dry-brook-7eef.workers.dev',
        changeOrigin: true,
      },
    },
  },
})
