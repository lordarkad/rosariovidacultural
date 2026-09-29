import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings } from './types/bindings'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use(
  '/api/*',
  cors({
    origin: (origin) =>
      origin.endsWith('.pages.dev') || origin === 'http://localhost:5173' ? origin : '',
  }),
)

app.get('/api/health', (c) =>
  c.json({ success: true, data: { status: 'ok', ts: new Date().toISOString() } }),
)

app.notFound((c) => c.json({ success: false, error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ success: false, error: 'Internal server error' }, 500)
})

export default app
