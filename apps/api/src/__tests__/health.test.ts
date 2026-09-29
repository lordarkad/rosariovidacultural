import { describe, it, expect } from 'vitest'
import app from '../index'

describe('GET /api/health', () => {
  it('returns success envelope with status ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, data: { status: 'ok' } })
  })

  it('returns 404 envelope for unknown routes', async () => {
    const res = await app.request('/not-found')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toMatchObject({ success: false, error: expect.any(String) })
  })
})
