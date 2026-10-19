import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Zone } from '@tript/shared'
import { mapStyleUrl } from '@/lib/map-style'
import { filterZones, getPosition } from '@/lib/geolocation'

describe('mapStyleUrl (S2-2, B-11)', () => {
  it('[AC-8] sin clave no hay mapa', () => {
    expect(mapStyleUrl(false, undefined)).toBeNull()
    expect(mapStyleUrl(true, '')).toBeNull()
  })

  it('[AC-8] claro y oscuro apuntan a estilos distintos y llevan la clave codificada', () => {
    const light = mapStyleUrl(false, 'k e/y')
    const dark = mapStyleUrl(true, 'k e/y')
    expect(light).toContain('streets-v2/style.json')
    expect(dark).toContain('streets-v2-dark/style.json')
    expect(light).toContain('key=k%20e%2Fy')
  })
})

const zone = (id: string, name: string) => ({ id, name, kind: 'barrio', lat: -32.9, lon: -60.6, radius_m: 800 }) as Zone

describe('filterZones (autocomplete de barrio)', () => {
  const zones = [zone('centro', 'Centro'), zone('pichincha', 'Pichincha'), zone('echesortu', 'Echesortu'), zone('alberdi', 'Alberdi')]

  it('[AC-6] ignora tildes y mayúsculas y busca en cualquier parte del nombre', () => {
    expect(filterZones(zones, 'PICH').map((z) => z.id)).toEqual(['pichincha'])
    expect(filterZones(zones, 'ntr').map((z) => z.id)).toEqual(['centro'])
  })

  it('[AC-6] los que empiezan con el texto van primero', () => {
    expect(filterZones(zones, 'e').map((z) => z.id)).toEqual(['echesortu', 'centro', 'alberdi'])
  })

  it('[AC-6] sin texto no sugiere nada y limita a 6', () => {
    expect(filterZones(zones, '  ')).toEqual([])
    const many = Array.from({ length: 10 }, (_, n) => zone(`b${n}`, `Barrio ${n}`))
    expect(filterZones(many, 'barrio')).toHaveLength(6)
  })
})

describe('getPosition', () => {
  const stub = (geo: unknown) => vi.stubGlobal('navigator', { geolocation: geo })
  afterEach(() => vi.unstubAllGlobals())

  it('[AC-7] devuelve lat y lon', async () => {
    stub({ getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: -32.95, longitude: -60.64 } }) })
    await expect(getPosition()).resolves.toEqual({ lat: -32.95, lon: -60.64 })
  })

  it('[AC-7] mapea los errores del navegador a un motivo', async () => {
    const fail = (code: number) => stub({ getCurrentPosition: (_: unknown, err: (e: unknown) => void) => err({ code }) })
    fail(1)
    await expect(getPosition()).rejects.toMatchObject({ reason: 'denied' })
    fail(2)
    await expect(getPosition()).rejects.toMatchObject({ reason: 'unavailable' })
    fail(3)
    await expect(getPosition()).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('[AC-7] sin API de geolocalización: unsupported', async () => {
    stub({})
    await expect(getPosition()).rejects.toMatchObject({ reason: 'unsupported' })
  })
})
