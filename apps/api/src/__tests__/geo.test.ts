import { describe, it, expect } from 'vitest'
import { bboxAround, haversineM, parseBbox, pointInBbox, walkMinutes } from '../domain/geo'
import { normalizeText } from '../domain/normalize'

describe('geo', () => {
  it('haversineM: un grado de longitud en el ecuador ≈ 111,2 km', () => {
    expect(haversineM(0, 0, 0, 1)).toBeCloseTo(111_195, -2)
  })

  it('haversineM: mismo punto es 0', () => {
    expect(haversineM(-32.94, -60.65, -32.94, -60.65)).toBe(0)
  })

  it('[AC-3] walkMinutes = ceil(distance_m / 80)', () => {
    expect(walkMinutes(0)).toBe(0)
    expect(walkMinutes(80)).toBe(1)
    expect(walkMinutes(81)).toBe(2)
    expect(walkMinutes(850)).toBe(11)
  })

  it('bboxAround contiene todos los puntos a menos de radius_m (conservador)', () => {
    const [minLon, minLat, maxLon, maxLat] = bboxAround(-32.94, -60.65, 1000)
    for (const [dlat, dlon] of [
      [0.008, 0],
      [-0.008, 0],
      [0, 0.0105],
      [0, -0.0105],
    ] as const) {
      const lat = -32.94 + dlat
      const lon = -60.65 + dlon
      if (haversineM(-32.94, -60.65, lat, lon) <= 1000) {
        expect(pointInBbox(lat, lon, [minLon, minLat, maxLon, maxLat])).toBe(true)
      }
    }
  })

  describe('[AC-23] parseBbox', () => {
    it('lee min_lon,min_lat,max_lon,max_lat', () => {
      expect(parseBbox('-60.7,-33,-60.6,-32.9')).toEqual([-60.7, -33, -60.6, -32.9])
    })
    it('min mayor que max o mal formado lanza error', () => {
      expect(() => parseBbox('-60.6,-33,-60.7,-32.9')).toThrow()
      expect(() => parseBbox('-60.7,-32.9,-60.6,-33')).toThrow()
      expect(() => parseBbox('a,b,c,d')).toThrow()
      expect(() => parseBbox('1,2,3')).toThrow()
    })
    it('pointInBbox es inclusivo en los bordes', () => {
      expect(pointInBbox(-33, -60.7, [-60.7, -33, -60.6, -32.9])).toBe(true)
      expect(pointInBbox(-33.1, -60.65, [-60.7, -33, -60.6, -32.9])).toBe(false)
    })
  })
})

describe('normalizeText', () => {
  it('[AC-20] minúsculas, sin tildes ni signos, espacios colapsados', () => {
    expect(normalizeText('  Teatro  El Círculo! ')).toBe('teatro el circulo')
    expect(normalizeText('Pérez – Ñandú & Co.')).toBe('perez nandu co')
  })
  it('vacío o solo signos da cadena vacía', () => {
    expect(normalizeText('')).toBe('')
    expect(normalizeText('¡!?')).toBe('')
  })
})
