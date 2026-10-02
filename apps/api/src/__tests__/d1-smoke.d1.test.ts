import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import app from '../index'

describe('infra D1', () => {
  it('aplica las migraciones y responde /api/health con D1 real', async () => {
    const t = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations_applied'",
    ).all()
    expect(t.results).toHaveLength(1)
    const res = await app.request('/api/health', {}, env)
    expect(res.status).toBe(200)
  })
})
