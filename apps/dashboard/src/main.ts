import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import router from './router'
import App from './App.vue'
import { TriptongoPreset } from './theme'
import './assets/main.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, { theme: { preset: TriptongoPreset } })
  .use(ToastService)
  .mount('#app')
