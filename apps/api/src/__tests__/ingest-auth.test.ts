import { describe, it, expect, vi } from 'vitest'
import app from '../index'
import { envWithoutDb, TEST_TOKEN } from './helpers/fake-d1'

const post = (headers: Record<string, string>, body: unknown = { source: { name: 'x', tier: 'curated' }, generated_at: '2026-10-06T00:00:00Z' }, env = envWithoutDb()) =>
  app.request(
    '/api/ingest',
    { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) },
    env,
  )

describe('POST /api/ingest — auth', () => {
  it('[AC-31] sin Authorization: 401 con envelope y no toca la base', async () => {
    const res = await post({})
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ success: false, error: expect.any(String) })
    expect(res.headers.get('www-authenticate')).toMatch(/^Bearer/)
  })

  it('[AC-31] token distinto de INGEST_TOKEN: 401', async () => {
    const res = await post({ authorization: 'Bearer otro-token' })
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ success: false })
  })

  it('[AC-31] esquema distinto de Bearer o token vacío: 401', async () => {
    expect((await post({ authorization: `Basic ${TEST_TOKEN}` })).status).toBe(401)
    expect((await post({ authorization: 'Bearer ' })).status).toBe(401)
    expect((await post({ authorization: TEST_TOKEN })).status).toBe(401)
  })

  it('[AC-31] un body inválido sin token da 401, no 400 (la auth corre primero)', async () => {
    const res = await post({}, { nada: true })
    expect(res.status).toBe(401)
  })

  it('falla cerrado si el servidor no tiene INGEST_TOKEN configurado', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post({ authorization: 'Bearer ' }, undefined, envWithoutDb({ INGEST_TOKEN: '' }))
    expect(res.status).toBe(401)
    const res2 = await post({ authorization: 'Bearer x' }, undefined, envWithoutDb({ INGEST_TOKEN: undefined }))
    expect(res2.status).toBe(401)
    spy.mockRestore()
  })
})
