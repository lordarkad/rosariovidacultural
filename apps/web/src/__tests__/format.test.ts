import { describe, expect, it } from 'vitest'
import {
  bandLabel,
  formatDate,
  formatDistance,
  formatPrice,
  formatTime,
  formatWalk,
  todayInBuenosAires,
} from '@/lib/format'

describe('formateadores es-AR', () => {
  it('precio: GRATIS, monto con separador de miles, nada si se desconoce (S2-11)', () => {
    expect(formatPrice('free', null)).toBe('GRATIS')
    expect(formatPrice('paid', 12000)).toBe('$ 12.000')
    expect(formatPrice('paid', null)).toBeNull()
    expect(formatPrice('unknown', null)).toBeNull()
  })

  it('distancia: metros bajo 1 km, km con coma decimal, null sin origen', () => {
    expect(formatDistance(850)).toBe('850 m')
    expect(formatDistance(1234)).toBe('1,2 km')
    expect(formatDistance(null)).toBeNull()
  })

  it('caminata y hora', () => {
    expect(formatWalk(12)).toBe('12 min a pie')
    expect(formatWalk(null)).toBeNull()
    expect(formatTime('21:30')).toBe('21:30 h')
    expect(formatTime(null)).toBeNull()
  })

  it('fecha corta en español sin depender de la zona del dispositivo', () => {
    expect(formatDate('2026-10-17')).toBe('sáb 17 oct')
    expect(formatDate('no-es-fecha')).toBe('no-es-fecha')
  })

  it('hoy se calcula en Buenos Aires: a las 01:00 UTC todavía es el día anterior', () => {
    expect(todayInBuenosAires(new Date('2026-10-18T01:00:00Z'))).toBe('2026-10-17')
    expect(todayInBuenosAires(new Date('2026-10-18T15:00:00Z'))).toBe('2026-10-18')
  })

  it('franjas (S2-10) y tolerancia a una franja desconocida', () => {
    expect(bandLabel('esta_noche')).toBe('Esta noche')
    expect(bandLabel('a_confirmar')).toBe('Horario a confirmar')
    expect(bandLabel('inventada')).toBe('Más')
  })
})
