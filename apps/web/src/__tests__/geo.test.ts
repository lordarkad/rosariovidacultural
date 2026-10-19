import { describe, expect, it } from 'vitest'
import { RADIO_DEFAULT, RADIO_MAX, RADIO_MIN, circlePolygon, clampRadius, formatRadius } from '@/lib/geo'

describe('clampRadius (500 m–10 km, E-8)', () => {
  it('[AC-3] deja pasar un radio válido y lo redondea a entero', () => {
    expect(clampRadius(2000)).toBe(2000)
    expect(clampRadius(1234.6)).toBe(1235)
  })

  it('[AC-3] acota los extremos', () => {
    expect(clampRadius(100)).toBe(RADIO_MIN)
    expect(clampRadius(99999)).toBe(RADIO_MAX)
  })

  it('[AC-3] un valor que no es número cae al radio por defecto', () => {
    expect(clampRadius(Number.NaN)).toBe(RADIO_DEFAULT)
  })
})

describe('formatRadius', () => {
  it('[AC-3] metros por debajo del km, km con coma decimal por encima', () => {
    expect(formatRadius(500)).toBe('500 m')
    expect(formatRadius(2000)).toBe('2 km')
    expect(formatRadius(2500)).toBe('2,5 km')
    expect(formatRadius(10000)).toBe('10 km')
  })
})

describe('circlePolygon', () => {
  const ring = circlePolygon(-32.95, -60.64, 1000, 32)

  it('[AC-4] es un anillo cerrado de [lon, lat]', () => {
    expect(ring).toHaveLength(33)
    expect(ring[0]).toEqual(ring[32])
  })

  it('[AC-4] cada punto está a ~el radio del centro', () => {
    const R = 6371008.8
    const rad = (d: number) => (d * Math.PI) / 180
    for (const [lon, lat] of ring) {
      const dLat = rad(lat! - -32.95)
      const dLon = rad(lon! - -60.64)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(-32.95)) * Math.cos(rad(lat!)) * Math.sin(dLon / 2) ** 2
      const d = 2 * R * Math.asin(Math.sqrt(a))
      expect(Math.abs(d - 1000)).toBeLessThan(5)
    }
  })
})
