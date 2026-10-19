/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base de la API. Por defecto `/api` (mismo origen). */
  readonly VITE_API_URL?: string
  /** Clave pública de MapTiler (restringida por origen). Sin ella el mapa no se muestra y queda la lista. */
  readonly VITE_MAPTILER_KEY?: string
  /** Entorno que muestra el cartel de `/curacion/*` («staging»). Sin ella, «producción». */
  readonly VITE_ENV_LABEL?: string
}
