import { describe, it, expect } from 'vitest'
import app from '../index'
import { envWithoutDb, TEST_TOKEN } from './helpers/fake-d1'

const auth = { authorization: `Bearer ${TEST_TOKEN}`, 'content-type': 'application/json' }
const post = (raw: string) =>
  app.request('/api/ingest', { method: 'POST', headers: auth, body: raw }, envWithoutDb())
const base = { source: { name: 'Fuente', tier: 'aggregator' }, generated_at: '2026-10-06T00:00:00Z' }

describe('POST /api/ingest — estructura del lote (400 sin tocar la base)', () => {
  it('[AC-32] falta source', async () => {
    const res = await post(JSON.stringify({ generated_at: base.generated_at, events: [] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('[AC-32] events con 201 ítems', async () => {
    const events = Array.from({ length: 201 }, () => ({}))
    const res = await post(JSON.stringify({ ...base, events }))
    expect(res.status).toBe(400)
  })

  it('[AC-32] places con 201 ítems', async () => {
    const places = Array.from({ length: 201 }, () => ({}))
    expect((await post(JSON.stringify({ ...base, places }))).status).toBe(400)
  })

  it('[AC-32] el JSON no es un objeto', async () => {
    for (const raw of ['[]', '"texto"', '42', 'null']) {
      const res = await post(raw)
      expect(res.status, raw).toBe(400)
      expect(await res.json()).toMatchObject({ success: false })
    }
  })

  it('[AC-32] JSON malformado: 400 con envelope, no 500', async () => {
    const res = await post('{ no es json')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('[AC-34] un ítem que no es objeto tumba el lote entero (400)', async () => {
    expect((await post(JSON.stringify({ ...base, events: ['texto'] }))).status).toBe(400)
  })

  it('tier fuera del enum: 400', async () => {
    const res = await post(JSON.stringify({ ...base, source: { name: 'x', tier: 'otro' } }))
    expect(res.status).toBe(400)
  })
})
