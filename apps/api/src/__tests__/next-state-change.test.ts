import { describe, it, expect } from 'vitest'
import { isOpenAt, nextStateChange, type OpeningPeriod } from '../domain/opening-hours'

// Buenos Aires es UTC-3 sin horario de verano. 2026-10-19 es lunes; 2026-10-21, miércoles.
const d = (s: string) => new Date(s)
const next = (periods: OpeningPeriod[] | null, now: string) => nextStateChange(periods, d(now))?.toISOString() ?? null
const dia = (day: number, opens: string, closes: string): OpeningPeriod => ({ day, opens, closes })
const semana = (opens: string, closes: string): OpeningPeriod[] => [0, 1, 2, 3, 4, 5, 6].map((day) => dia(day, opens, closes))

const MIE_21 = '2026-10-21T21:00:00-03:00'

describe('nextStateChange', () => {
  it('[AC-1] abierto: el cierre', () => {
    const p = [dia(2, '12:00', '23:00')]
    expect(isOpenAt(p, d(MIE_21))).toBe(true)
    expect(next(p, MIE_21)).toBe('2026-10-22T02:00:00.000Z')
  })

  it('[AC-2] cerrado: la próxima apertura (hoy, mañana y a una semana)', () => {
    expect(next([dia(2, '22:30', '23:30')], MIE_21)).toBe('2026-10-22T01:30:00.000Z')
    expect(next([dia(2, '12:00', '20:00'), dia(3, '12:00', '20:00')], MIE_21)).toBe('2026-10-22T15:00:00.000Z')
    expect(next([dia(2, '12:00', '20:00')], MIE_21)).toBe('2026-10-28T15:00:00.000Z')
  })

  it('[AC-3] los tramos contiguos se fusionan: el cambio es el cierre del último', () => {
    const p = [dia(2, '12:00', '16:00'), dia(2, '16:00', '23:00')]
    expect(next(p, '2026-10-21T14:00:00-03:00')).toBe('2026-10-22T02:00:00.000Z')
  })

  it('[AC-4] cierre pasada la medianoche', () => {
    expect(next([dia(4, '18:00', '03:00')], '2026-10-24T01:00:00-03:00')).toBe('2026-10-24T06:00:00.000Z')
  })

  it('[AC-5] abierto las 24 h todos los días: sin cambio, sea cual sea la representación', () => {
    expect(next(semana('00:00', '00:00'), '2026-10-21T10:00:00-03:00')).toBeNull()
    expect(next(semana('06:00', '06:00'), '2026-10-21T10:00:00-03:00')).toBeNull()
  })

  it('[AC-6] 24 h solo un día: cambia al terminar ese día', () => {
    expect(next([dia(0, '00:00', '00:00')], '2026-10-19T10:00:00-03:00')).toBe('2026-10-20T03:00:00.000Z')
  })

  it('[AC-6b] varios días de 24 h seguidos y períodos superpuestos', () => {
    expect(next([dia(0, '00:00', '00:00'), dia(1, '00:00', '00:00')], '2026-10-19T10:00:00-03:00')).toBe(
      '2026-10-21T03:00:00.000Z',
    )
    expect(next([dia(0, '00:00', '00:00'), dia(0, '20:00', '02:00')], '2026-10-19T10:00:00-03:00')).toBe(
      '2026-10-20T05:00:00.000Z',
    )
  })

  it('[AC-7] sin horario estructurado: null', () => {
    expect(next(null, MIE_21)).toBeNull()
  })

  it('en el instante exacto del cierre ya está cerrado y el cambio es la próxima apertura', () => {
    const p = [dia(2, '12:00', '23:00'), dia(3, '12:00', '23:00')]
    expect(next(p, '2026-10-21T23:00:00-03:00')).toBe('2026-10-22T15:00:00.000Z')
  })
})
