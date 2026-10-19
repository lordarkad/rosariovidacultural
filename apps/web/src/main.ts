import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import router from './router'
import App from './App.vue'
import { RiberaPreset } from './theme'
import './assets/main.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, { theme: { preset: RiberaPreset, options: { darkModeSelector: 'system' } } })
  .mount('#app')
