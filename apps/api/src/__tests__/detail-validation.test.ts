import { describe, it, expect } from 'vitest'
import { createApp } from '../index'
import { envWithoutDb } from './helpers/fake-d1'

const app = createApp({ now: () => new Date('2026-10-06T21:00:00-03:00') })
const get = (path: string) => app.request(path, {}, envWithoutDb())
const UUID = '00000000-0000-4000-8000-000000000001'

describe('GET /api/events/:id y /api/places/:id — validación (400 sin tocar la base)', () => {
  it.each([
    ['evento: id que no es UUID', '/api/events/no-es-uuid'],
    ['lugar: id que no es UUID', '/api/places/123'],
    ['evento: lat sin lon', `/api/events/${UUID}?lat=-32.9`],
    ['evento: lon sin lat', `/api/events/${UUID}?lon=-60.6`],
    ['lugar: lat sin lon', `/api/places/${UUID}?lat=-32.9`],
    ['evento: lat fuera de rango', `/api/events/${UUID}?lat=95&lon=-60`],
    ['evento: lat no numérica', `/api/events/${UUID}?lat=abc&lon=-60`],
  ])('[AC-26] %s', async (_name, path) => {
    const res = await get(path)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { success: boolean; error: unknown }
    expect(body.success).toBe(false)
    expect(typeof body.error).toBe('string')
  })
})
