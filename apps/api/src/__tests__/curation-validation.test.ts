import { describe, it, expect } from 'vitest'
import { createApp } from '../index'
import { envWithoutDb } from './helpers/fake-d1'

const app = createApp({ now: () => new Date('2026-10-06T21:00:00-03:00') })
const get = (path: string) => app.request(path, {}, envWithoutDb())

const fuentes = Array.from({ length: 21 }, (_, i) => `f${i}`).join(',')

describe('listEvents y listPlaces — validación (400 sin tocar la base)', () => {
  it.each([
    ['eventos: per_page=101', '/api/events?per_page=101'],
    ['eventos: per_page=0', '/api/events?per_page=0'],
    ['eventos: page=0', '/api/events?page=0'],
    ['eventos: page=abc', '/api/events?page=abc'],
    ['eventos: page=10001', '/api/events?page=10001'],
    ['eventos: page enorme', '/api/events?page=99999999999999999999'],
    ['lugares: per_page=101', '/api/places?per_page=101'],
    ['lugares: page=10001', '/api/places?page=10001'],
  ])('[AC-10] %s', async (_n, path) => {
    const res = await get(path)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { success: boolean; error: unknown }
    expect(body.success).toBe(false)
    expect(typeof body.error).toBe('string')
  })

  it.each([
    ['eventos: estado inválido', '/api/events?estado=otro'],
    ['eventos: faltan inválido', '/api/events?faltan=foto'],
    ['eventos: q de 101 caracteres', `/api/events?q=${'a'.repeat(101)}`],
    ['eventos: más de 20 fuentes', `/api/events?fuente=${fuentes}`],
    ['lugares: origen inválido', '/api/places?origen=otro'],
    ['lugares: tipo inválido', '/api/places?tipo=hotel'],
    ['lugares: faltan inválido', '/api/places?faltan=foto'],
  ])('[AC-11] %s', async (_n, path) => {
    const res = await get(path)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { success: boolean; error: unknown }
    expect(body.success).toBe(false)
    expect(typeof body.error).toBe('string')
  })
})
