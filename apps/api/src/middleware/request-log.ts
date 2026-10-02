import type { MiddlewareHandler } from 'hono'

/**
 * Log de requests sin query string (D-9): `lat`/`lon` de la búsqueda son la ubicación del usuario y no se
 * loguean. El `logger()` de Hono imprime la URL completa, por eso no se usa.
 */
export const requestLog: MiddlewareHandler = async (c, next) => {
  const started = Date.now()
  await next()
  const { pathname } = new URL(c.req.url)
  console.log(`${c.req.method} ${pathname} ${c.res.status} ${Date.now() - started}ms`)
}
