import type { Bindings } from './bindings'

/** Entorno de Hono de toda la API: bindings de Wrangler y el reloj inyectado (tests de franjas y vencimientos). */
export interface AppEnv {
  Bindings: Bindings
  Variables: { now: () => Date }
}
