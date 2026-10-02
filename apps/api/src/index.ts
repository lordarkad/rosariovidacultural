import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { requestLog } from './middleware/request-log'
import type { StatusCode } from 'hono/utils/http-status'
import type { AppEnv } from './types/app'
import ingestRoute from './routes/ingest'
import searchRoute from './routes/search'
import zonesRoute from './routes/zones'

/** `now` se inyecta en los tests para fijar el reloj (franjas, vencimientos, last_seen_at). */
export function createApp(opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date())
  const app = new Hono<AppEnv>()

  app.use('*', requestLog)
  app.use('*', async (c, next) => {
    c.set('now', now)
    await next()
  })
  app.use(
    '/api/*',
    cors({
      origin: (origin) =>
        origin.endsWith('.pages.dev') || origin === 'http://localhost:5173' ? origin : '',
      // sin esto el navegador no puede leer los headers de paginación entre orígenes (F-2, F-3)
      exposeHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page', 'X-Truncated'],
    }),
  )

  app.get('/api/health', (c) =>
    c.json({ success: true, data: { status: 'ok', ts: c.get('now')().toISOString() } }),
  )

  app.route('/api/zones', zonesRoute)
  app.route('/api/search', searchRoute)
  app.route('/api/ingest', ingestRoute)

  app.notFound((c) => c.json({ success: false, error: 'Not found' }, 404))

  app.onError((err, c) => {
    // errores de request (p. ej. JSON malformado) conservan su status con el envelope canónico
    if (err instanceof HTTPException) {
      return c.json({ success: false, error: err.message }, err.status as Exclude<StatusCode, 101 | 204 | 205 | 304>)
    }
    console.error(err)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  })

  return app
}

export default createApp()
