import { describe, it, expect } from 'vitest'
import { firstOpenInWindow, isOpenAt, type OpeningPeriod } from '../domain/opening-hours'

const d = (s: string) => new Date(s)
const iso = (s: string) => d(s).toISOString()
const todos = (opens: string, closes: string): OpeningPeriod[] =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens, closes }))

describe('opening-hours', () => {
  it('[AC-17] sin horario: open_now null', () => {
    expect(isOpenAt(null, d('2026-10-06T21:00:00-03:00'))).toBeNull()
  })

  it('[AC-17] abierto hasta las 23:00 a las 21:00 / cerró a las 20:00', () => {
    const now = d('2026-10-06T21:00:00-03:00')
    expect(isOpenAt(todos('12:00', '23:00'), now)).toBe(true)
    expect(isOpenAt(todos('12:00', '20:00'), now)).toBe(false)
    expect(isOpenAt(todos('21:30', '23:00'), now)).toBe(false)
  })

  it('el cierre es exclusivo y la apertura inclusiva', () => {
    const p = todos('12:00', '23:00')
    expect(isOpenAt(p, d('2026-10-06T12:00:00-03:00'))).toBe(true)
    expect(isOpenAt(p, d('2026-10-06T23:00:00-03:00'))).toBe(false)
  })

  it('un período que cruza la medianoche sigue abierto de madrugada del día siguiente', () => {
    // martes (day 1) 20:00 -> 02:00: el miércoles 00:30 sigue abierto
    const p: OpeningPeriod[] = [{ day: 1, opens: '20:00', closes: '02:00' }]
    expect(isOpenAt(p, d('2026-10-07T00:30:00-03:00'))).toBe(true)
    expect(isOpenAt(p, d('2026-10-07T02:00:00-03:00'))).toBe(false)
    expect(isOpenAt(p, d('2026-10-06T19:59:00-03:00'))).toBe(false)
  })

  it('[AC-17] opens == closes es 24 h abierto a cualquier hora', () => {
    const p = todos('00:00', '00:00')
    expect(isOpenAt(p, d('2026-10-06T03:00:00-03:00'))).toBe(true)
    expect(isOpenAt(p, d('2026-10-06T21:00:00-03:00'))).toBe(true)
  })

  it('los días se interpretan 0 = lunes (2026-10-05 es lunes)', () => {
    const soloLunes: OpeningPeriod[] = [{ day: 0, opens: '10:00', closes: '18:00' }]
    expect(isOpenAt(soloLunes, d('2026-10-05T12:00:00-03:00'))).toBe(true)
    expect(isOpenAt(soloLunes, d('2026-10-06T12:00:00-03:00'))).toBe(false)
  })

  describe('firstOpenInWindow', () => {
    const from = d('2026-10-06T21:00:00-03:00')
    const to = d('2026-10-07T06:00:00-03:00')

    it('[AC-17] devuelve el primer momento abierto dentro de la ventana', () => {
      expect(firstOpenInWindow(todos('21:30', '23:00'), from, to)?.toISOString()).toBe(
        iso('2026-10-06T21:30:00-03:00'),
      )
      expect(firstOpenInWindow(todos('12:00', '23:00'), from, to)?.toISOString()).toBe(
        from.toISOString(),
      )
    })

    it('[AC-17] un lugar que ya cerró por hoy no tiene primer momento abierto', () => {
      expect(firstOpenInWindow(todos('12:00', '20:00'), from, to)).toBeNull()
    })

    it('[AC-13] abre solo los viernes 12-19: no aparece cuando la ventana arranca el viernes 21:00', () => {
      const viernes: OpeningPeriod[] = [{ day: 4, opens: '12:00', closes: '19:00' }]
      expect(
        firstOpenInWindow(viernes, d('2026-10-09T21:00:00-03:00'), d('2026-10-12T06:00:00-03:00')),
      ).toBeNull()
    })

    it('[AC-13] abre todos los días 12-19: aparece por su apertura del sábado', () => {
      expect(
        firstOpenInWindow(
          todos('12:00', '19:00'),
          d('2026-10-09T21:00:00-03:00'),
          d('2026-10-12T06:00:00-03:00'),
        )?.toISOString(),
      ).toBe(iso('2026-10-10T12:00:00-03:00'))
    })

    it('sin horario devuelve null', () => {
      expect(firstOpenInWindow(null, from, to)).toBeNull()
    })
  })
})
