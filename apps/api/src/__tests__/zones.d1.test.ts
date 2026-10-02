import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { ZoneSchema } from '@tript/shared'
import app from '../index'

describe('GET /api/zones', () => {
  // AC-1: zonas sembradas por migración (8 barrios y 5 localidades)
  it('[AC-1] devuelve el envelope con las 13 zonas del seed', async () => {
    const res = await app.request('/api/zones', {}, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; data: unknown[] }
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(13)
    for (const z of body.data) expect(ZoneSchema.safeParse(z).success).toBe(true)
    const zones = body.data as { id: string; kind: string; radius_m: number }[]
    expect(zones.filter((z) => z.kind === 'barrio')).toHaveLength(8)
    expect(zones.filter((z) => z.kind === 'localidad')).toHaveLength(5)
    expect(zones.map((z) => z.id)).toEqual(expect.arrayContaining(['funes', 'pichincha']))
    expect(zones.find((z) => z.id === 'funes')?.radius_m).toBe(3000)
  })

  it('[AC-1] no expone columnas internas (sort_order)', async () => {
    const res = await app.request('/api/zones', {}, env)
    const body = (await res.json()) as { data: Record<string, unknown>[] }
    expect(Object.keys(body.data[0]!).sort()).toEqual(
      ['id', 'kind', 'lat', 'lon', 'name', 'radius_m'].sort(),
    )
  })
})
