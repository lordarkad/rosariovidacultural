import { describe, it, expect } from 'vitest'
import { InvalidWindowError, resolveWindow } from '../domain/windows'

const d = (s: string) => new Date(s)
const iso = (s: string) => d(s).toISOString()
// 2026-10-06 es martes
const MARTES_21 = d('2026-10-06T21:00:00-03:00')

describe('resolveWindow', () => {
  it('[AC-8] ahora: de hace 2 h a dentro de 1 h (eventos) y desde ahora (lugares)', () => {
    const w = resolveWindow('ahora', undefined, MARTES_21)
    expect(w.eventFrom.toISOString()).toBe(iso('2026-10-06T19:00:00-03:00'))
    expect(w.placeFrom.toISOString()).toBe(MARTES_21.toISOString())
    expect(w.to.toISOString()).toBe(iso('2026-10-06T22:00:00-03:00'))
    expect(w.toInclusive).toBe(true)
    expect(w.includesNow).toBe(true)
  })

  it('[AC-8] hoy: hasta las 06:00 del día siguiente', () => {
    const w = resolveWindow('hoy', undefined, MARTES_21)
    expect(w.to.toISOString()).toBe(iso('2026-10-07T06:00:00-03:00'))
    expect(w.businessDates).toEqual(['2026-10-06'])
    expect(w.includesNow).toBe(true)
  })

  it('[AC-8] manana: el día de negocio siguiente completo, sin incluir ahora', () => {
    const w = resolveWindow('manana', undefined, MARTES_21)
    expect(w.eventFrom.toISOString()).toBe(iso('2026-10-07T06:00:00-03:00'))
    expect(w.to.toISOString()).toBe(iso('2026-10-08T06:00:00-03:00'))
    expect(w.businessDates).toEqual(['2026-10-07'])
    expect(w.includesNow).toBe(false)
  })

  it('[AC-13] fecha futura: ese día de negocio entero', () => {
    const w = resolveWindow('fecha', '2026-10-09', MARTES_21)
    expect(w.eventFrom.toISOString()).toBe(iso('2026-10-09T06:00:00-03:00'))
    expect(w.to.toISOString()).toBe(iso('2026-10-10T06:00:00-03:00'))
    expect(w.cuando).toBe('fecha')
  })

  it('[AC-13] fecha igual a hoy se comporta como hoy (recortada a ahora)', () => {
    const w = resolveWindow('fecha', '2026-10-06', MARTES_21)
    const hoy = resolveWindow('hoy', undefined, MARTES_21)
    expect(w.eventFrom.toISOString()).toBe(hoy.eventFrom.toISOString())
    expect(w.to.toISOString()).toBe(hoy.to.toISOString())
    expect(w.includesNow).toBe(true)
  })

  it('[AC-5] fecha anterior al día de negocio actual lanza InvalidWindowError', () => {
    expect(() => resolveWindow('fecha', '2026-10-05', MARTES_21)).toThrow(InvalidWindowError)
    expect(() => resolveWindow('fecha', undefined, MARTES_21)).toThrow(InvalidWindowError)
  })

  it('[AC-13] fecha con cuando distinto de fecha se ignora', () => {
    const w = resolveWindow('hoy', '1999-01-01', MARTES_21)
    expect(w.cuando).toBe('hoy')
  })

  describe('[AC-13] finde', () => {
    it('viernes 15:00: arranca el viernes 18:00 y llega hasta el lunes 06:00', () => {
      const w = resolveWindow('finde', undefined, d('2026-10-09T15:00:00-03:00'))
      expect(w.eventFrom.toISOString()).toBe(iso('2026-10-09T18:00:00-03:00'))
      expect(w.placeFrom.toISOString()).toBe(iso('2026-10-09T18:00:00-03:00'))
      expect(w.to.toISOString()).toBe(iso('2026-10-12T06:00:00-03:00'))
      expect(w.includesNow).toBe(false)
      expect(w.businessDates).toEqual(['2026-10-09', '2026-10-10', '2026-10-11'])
    })

    it('viernes 21:00: los lugares arrancan a las 21:00 y el fin de semana ya está en curso', () => {
      const w = resolveWindow('finde', undefined, d('2026-10-09T21:00:00-03:00'))
      expect(w.placeFrom.toISOString()).toBe(iso('2026-10-09T21:00:00-03:00'))
      expect(w.eventFrom.toISOString()).toBe(iso('2026-10-09T19:00:00-03:00'))
      expect(w.includesNow).toBe(true)
    })

    it('lunes 02:00 sigue siendo domingo: la ventana llega hasta las 06:00 de ese lunes', () => {
      const w = resolveWindow('finde', undefined, d('2026-10-12T02:00:00-03:00'))
      expect(w.to.toISOString()).toBe(iso('2026-10-12T06:00:00-03:00'))
      expect(w.includesNow).toBe(true)
    })

    it('lunes 06:00 y martes: la ventana es la del próximo viernes 18:00', () => {
      for (const now of ['2026-10-12T06:00:00-03:00', '2026-10-13T12:00:00-03:00']) {
        const w = resolveWindow('finde', undefined, d(now))
        expect(w.eventFrom.toISOString()).toBe(iso('2026-10-16T18:00:00-03:00'))
        expect(w.to.toISOString()).toBe(iso('2026-10-19T06:00:00-03:00'))
        expect(w.includesNow).toBe(false)
      }
    })
  })
})
