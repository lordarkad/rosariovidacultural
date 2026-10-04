import { describe, it, expect } from 'vitest'
import { createApp } from '../index'
import { envWithoutDb } from './helpers/fake-d1'

// martes 21:00 local; la base lanza si se la toca: todo 400 se decide antes de leer
const app = createApp({ now: () => new Date('2026-10-06T21:00:00-03:00') })
const get = (path: string) => app.request(path, {}, envWithoutDb())

// Pasar la validación es llegar a la base; la base de este archivo lanza, así que el 500 prueba que no hubo 400
const reachesDb = async (path: string) => {
  const res = await get(path)
  expect(res.status, path).toBe(500)
}

const bad = async (path: string) => {
  const res = await get(path)
  expect(res.status, path).toBe(400)
  const body = (await res.json()) as { success: boolean; error: unknown }
  expect(body.success).toBe(false)
  expect(typeof body.error).toBe('string')
}

describe('GET /api/search — parámetros inválidos (400)', () => {
  it.each([
    ['z y lat/lon a la vez', '/api/search?z=funes&lat=-32.9&lon=-60.6'],
    ['lat sin lon', '/api/search?lat=-32.9'],
    ['lon sin lat', '/api/search?lon=-60.6'],
    ['cuando=fecha sin fecha', '/api/search?cuando=fecha'],
    ['radio_m demasiado grande', '/api/search?lat=-32.9&lon=-60.6&radio_m=20000'],
    ['radio_m demasiado chico', '/api/search?lat=-32.9&lon=-60.6&radio_m=100'],
    ['per_page=101', '/api/search?per_page=101'],
    ['per_page=0', '/api/search?per_page=0'],
    ['page=0', '/api/search?page=0'],
    ['fecha pasada', '/api/search?cuando=fecha&fecha=2026-10-05'],
    ['fecha mal formada', '/api/search?cuando=fecha&fecha=mañana'],
    ['cuando desconocido', '/api/search?cuando=siempre'],
    ['q de 101 caracteres', `/api/search?q=${'a'.repeat(101)}`],
    ['intención desconocida', '/api/search?i=comer,volar'],
    ['género fuera del enum', '/api/search?musica=tango'],
    ['gratis no booleano', '/api/search?gratis=quizas'],
    ['lat fuera de rango', '/api/search?lat=95&lon=-60'],
    ['lat no numérica', '/api/search?lat=abc&lon=-60'],
    ['z con formato inválido', '/api/search?z=Funes%20Centro'],
  ])('[AC-5] %s', async (_name, path) => bad(path))

  it('[AC-20] q de exactamente 100 caracteres es válido (no da 400)', async () => {
    await reachesDb(`/api/search?q=${'a'.repeat(100)}`)
  })

  it('[AC-16] musica con género fuera del enum es 400 aunque musica_en_vivo no esté en i', async () => {
    await bad('/api/search?i=comer&musica=tango')
  })

  it('[AC-5] cuando=fecha&fecha de hoy no es 400 (se comporta como hoy)', async () => {
    await reachesDb('/api/search?cuando=fecha&fecha=2026-10-06')
  })

  it('[AC-5] fecha con cuando distinto de fecha se ignora aunque sea inválida', async () => {
    await reachesDb('/api/search?cuando=hoy&fecha=ayer')
  })

  it('[AC-5] radio_m inválido se ignora cuando viene z (la zona usa su propio radio, E-8)', async () => {
    await reachesDb('/api/search?z=funes&radio_m=999999')
  })
})

describe('GET /api/search/pins — parámetros inválidos (400)', () => {
  it.each([
    ['bbox mal formado', '/api/search/pins?bbox=a,b,c,d'],
    ['bbox con 3 valores', '/api/search/pins?bbox=-60.7,-33,-60.6'],
    ['bbox con min mayor que max', '/api/search/pins?bbox=-60.6,-33,-60.7,-32.9'],
    ['mismas validaciones que search: z y lat/lon', '/api/search/pins?z=funes&lat=-32.9&lon=-60.6'],
    ['mismas validaciones que search: género', '/api/search/pins?musica=tango'],
  ])('[AC-23] %s', async (_name, path) => bad(path))
})
