import { describe, it, expect } from 'vitest'
import { classifyEvent, classifyPlace, bandOfInstant, BAND_ORDER } from '../domain/bands'
import { resolveWindow } from '../domain/windows'
import type { OpeningPeriod } from '../domain/opening-hours'

const d = (s: string) => new Date(s)
// 2026-10-06 es martes
const MARTES_21 = d('2026-10-06T21:00:00-03:00')

const ev = (start_date: string, end_date: string, start_time: string | null) => ({
  start_date,
  end_date,
  start_time,
})
const todos = (opens: string, closes: string): OpeningPeriod[] =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens, closes }))

describe('BAND_ORDER', () => {
  it('[AC-7] franjas en el orden del spec', () => {
    expect(BAND_ORDER).toEqual([
      'ahora',
      'hoy',
      'esta_noche',
      'manana',
      'proximos',
      'en_cartel',
      'a_confirmar',
    ])
  })
})

describe('bandOfInstant', () => {
  it('hoy entre 06:00 y 20:00 es hoy, desde las 20:00 hasta las 06:00 es esta_noche', () => {
    const now = d('2026-10-06T07:00:00-03:00')
    expect(bandOfInstant(d('2026-10-06T12:00:00-03:00'), now)).toBe('hoy')
    expect(bandOfInstant(d('2026-10-06T20:00:00-03:00'), now)).toBe('esta_noche')
    expect(bandOfInstant(d('2026-10-07T05:59:00-03:00'), now)).toBe('esta_noche')
    expect(bandOfInstant(d('2026-10-07T06:00:00-03:00'), now)).toBe('manana')
  })

  it('ahora: empezó hace hasta 2 h o empieza dentro de 1 h (límites inclusivos)', () => {
    expect(bandOfInstant(d('2026-10-06T19:00:00-03:00'), MARTES_21)).toBe('ahora')
    expect(bandOfInstant(d('2026-10-06T22:00:00-03:00'), MARTES_21)).toBe('ahora')
    expect(bandOfInstant(d('2026-10-06T22:01:00-03:00'), MARTES_21)).toBe('esta_noche')
  })

  it('después de mañana es proximos', () => {
    expect(bandOfInstant(d('2026-10-08T12:00:00-03:00'), MARTES_21)).toBe('proximos')
  })

  it('allowAhora=false (lugares) nunca devuelve ahora', () => {
    expect(bandOfInstant(d('2026-10-06T21:30:00-03:00'), MARTES_21, { allowAhora: false })).toBe(
      'esta_noche',
    )
  })
})

describe('classifyEvent', () => {
  const hoy = resolveWindow('hoy', undefined, MARTES_21)

  it('[AC-8] empezó a las 19:30 va en ahora; 21:30 en ahora; 23:00 en esta_noche; 18:00 no aparece', () => {
    const band = (t: string) => classifyEvent(ev('2026-10-06', '2026-10-06', t), hoy, MARTES_21)?.band
    expect(band('19:30')).toBe('ahora')
    expect(band('21:30')).toBe('ahora')
    expect(band('23:00')).toBe('esta_noche')
    expect(band('18:00')).toBeUndefined()
  })

  it('[AC-8] mañana 12:00 va en manana; dentro de 3 días va en proximos', () => {
    const manana = resolveWindow('manana', undefined, MARTES_21)
    expect(classifyEvent(ev('2026-10-07', '2026-10-07', '12:00'), manana, MARTES_21)?.band).toBe(
      'manana',
    )
    const fecha = resolveWindow('fecha', '2026-10-09', MARTES_21)
    expect(classifyEvent(ev('2026-10-09', '2026-10-09', '20:00'), fecha, MARTES_21)?.band).toBe(
      'proximos',
    )
  })

  it('[AC-9] 00:30 de D+1 con el reloj en la noche de D: esta_noche con hoy; no aparece con manana ni fecha=D+1', () => {
    const e = ev('2026-10-07', '2026-10-07', '00:30')
    expect(classifyEvent(e, hoy, MARTES_21)?.band).toBe('esta_noche')
    expect(
      classifyEvent(e, resolveWindow('manana', undefined, MARTES_21), MARTES_21),
    ).toBeNull()
    expect(
      classifyEvent(e, resolveWindow('fecha', '2026-10-07', MARTES_21), MARTES_21),
    ).toBeNull()
  })

  describe('[AC-10] rango largo (E-3)', () => {
    const e30 = ev('2026-09-25', '2026-10-24', '20:00')
    const e8 = ev('2026-10-03', '2026-10-10', '20:00')
    const e7 = ev('2026-10-04', '2026-10-10', '22:30')

    it('30 y 8 días van en en_cartel y no aparecen con ahora', () => {
      expect(classifyEvent(e30, hoy, MARTES_21)?.band).toBe('en_cartel')
      expect(classifyEvent(e8, hoy, MARTES_21)?.band).toBe('en_cartel')
      const ahora = resolveWindow('ahora', undefined, MARTES_21)
      expect(classifyEvent(e30, ahora, MARTES_21)).toBeNull()
      expect(classifyEvent(e8, ahora, MARTES_21)).toBeNull()
    })

    it('exactamente 7 días inclusivos va en la franja de su horario', () => {
      expect(classifyEvent(e7, hoy, MARTES_21)?.band).toBe('esta_noche')
    })

    it('[AC-7] en en_cartel la clave de orden es el start_time como hora del día; sin horario queda null', () => {
      const a = classifyEvent(ev('2026-09-25', '2026-10-24', '10:00'), hoy, MARTES_21)!
      const b = classifyEvent(ev('2026-09-25', '2026-10-24', '22:00'), hoy, MARTES_21)!
      const c = classifyEvent(ev('2026-09-25', '2026-10-24', null), hoy, MARTES_21)!
      expect(a.startKey).toBeLessThan(b.startKey!)
      expect(c.band).toBe('en_cartel')
      expect(c.startKey).toBeNull()
    })
  })

  describe('[AC-10b] rango de varios días repite el horario', () => {
    const e5 = ev('2026-10-05', '2026-10-09', '10:00') // lun a vie
    it('día 2 a las 15:00: no aparece con hoy; con manana va en manana', () => {
      const now = d('2026-10-06T15:00:00-03:00')
      expect(classifyEvent(e5, resolveWindow('hoy', undefined, now), now)).toBeNull()
      expect(classifyEvent(e5, resolveWindow('manana', undefined, now), now)?.band).toBe('manana')
    })
    it('último día a las 15:00 no aparece con hoy', () => {
      const now = d('2026-10-09T15:00:00-03:00')
      expect(classifyEvent(e5, resolveWindow('hoy', undefined, now), now)).toBeNull()
    })
    it('día 2 a las 10:30 aparece en ahora', () => {
      const now = d('2026-10-06T10:30:00-03:00')
      expect(classifyEvent(e5, resolveWindow('hoy', undefined, now), now)?.band).toBe('ahora')
    })
  })

  describe('[AC-11] sin horario (E-4)', () => {
    const sinHora = ev('2026-10-06', '2026-10-06', null)
    it('con hoy y finde va en a_confirmar con startKey null', () => {
      const c = classifyEvent(sinHora, hoy, MARTES_21)
      expect(c?.band).toBe('a_confirmar')
      expect(c?.startKey).toBeNull()
      const finde = resolveWindow('finde', undefined, MARTES_21)
      expect(
        classifyEvent(ev('2026-10-10', '2026-10-10', null), finde, MARTES_21)?.band,
      ).toBe('a_confirmar')
    })
    it('con ahora, manana o fecha no aparece', () => {
      for (const w of [
        resolveWindow('ahora', undefined, MARTES_21),
        resolveWindow('manana', undefined, MARTES_21),
        resolveWindow('fecha', '2026-10-06', MARTES_21),
      ]) {
        expect(classifyEvent(ev('2026-10-07', '2026-10-07', null), w, MARTES_21)).toBeNull()
      }
      // fecha=hoy usa la ventana de hoy pero cuando sigue siendo "fecha": E-4 literal
      expect(
        classifyEvent(sinHora, resolveWindow('fecha', '2026-10-06', MARTES_21), MARTES_21),
      ).toBeNull()
    })
  })

  it('[AC-12] 10 días sin horario que incluye hoy: en_cartel, aparece con hoy/manana/fecha dentro del rango y no con ahora', () => {
    const e = ev('2026-10-01', '2026-10-10', null)
    expect(classifyEvent(e, hoy, MARTES_21)?.band).toBe('en_cartel')
    expect(
      classifyEvent(e, resolveWindow('manana', undefined, MARTES_21), MARTES_21)?.band,
    ).toBe('en_cartel')
    expect(
      classifyEvent(e, resolveWindow('fecha', '2026-10-08', MARTES_21), MARTES_21)?.band,
    ).toBe('en_cartel')
    expect(
      classifyEvent(e, resolveWindow('fecha', '2026-10-20', MARTES_21), MARTES_21),
    ).toBeNull()
    expect(
      classifyEvent(e, resolveWindow('ahora', undefined, MARTES_21), MARTES_21),
    ).toBeNull()
  })
})

describe('classifyPlace', () => {
  const hoy = resolveWindow('hoy', undefined, MARTES_21)
  const place = (opening_hours: OpeningPeriod[] | null) => ({ opening_hours })

  it('[AC-17] abierto hasta las 23:00: ahora con open_now true', () => {
    const c = classifyPlace(place(todos('12:00', '23:00')), hoy, MARTES_21)
    expect(c).toMatchObject({ band: 'ahora', open_now: true })
  })

  it('[AC-17] abre a las 21:30 y a las 22:30: esta_noche con open_now false (ahora solo si open_now)', () => {
    expect(classifyPlace(place(todos('21:30', '23:59')), hoy, MARTES_21)).toMatchObject({
      band: 'esta_noche',
      open_now: false,
    })
    expect(classifyPlace(place(todos('22:30', '23:59')), hoy, MARTES_21)).toMatchObject({
      band: 'esta_noche',
      open_now: false,
    })
  })

  it('[AC-17] cerró a las 20:00: no aparece con hoy', () => {
    expect(classifyPlace(place(todos('12:00', '20:00')), hoy, MARTES_21)).toBeNull()
  })

  it('[AC-17] sin horario: a_confirmar con open_now null, y no aparece con ahora', () => {
    expect(classifyPlace(place(null), hoy, MARTES_21)).toMatchObject({
      band: 'a_confirmar',
      open_now: null,
    })
    expect(
      classifyPlace(place(null), resolveWindow('ahora', undefined, MARTES_21), MARTES_21),
    ).toBeNull()
  })

  it('[AC-17] con ahora solo aparecen los lugares con open_now true', () => {
    const ahora = resolveWindow('ahora', undefined, MARTES_21)
    expect(classifyPlace(place(todos('12:00', '23:00')), ahora, MARTES_21)?.band).toBe('ahora')
    expect(classifyPlace(place(todos('21:30', '23:59')), ahora, MARTES_21)).toBeNull()
  })

  it('[AC-17] con manana, un lugar abierto ahora que también abre mañana va en manana', () => {
    const manana = resolveWindow('manana', undefined, MARTES_21)
    expect(classifyPlace(place(todos('12:00', '23:00')), manana, MARTES_21)?.band).toBe('manana')
  })

  it('[AC-17] 24 h está abierto a cualquier hora', () => {
    const madrugada = d('2026-10-06T03:00:00-03:00')
    expect(
      classifyPlace(place(todos('00:00', '00:00')), resolveWindow('hoy', undefined, madrugada), madrugada),
    ).toMatchObject({ band: 'ahora', open_now: true })
  })

  it('el startKey de un lugar es su primer momento abierto (ahora si ya está abierto)', () => {
    const c = classifyPlace(place(todos('21:30', '23:59')), hoy, MARTES_21)!
    expect(c.startKey).toBe(d('2026-10-06T21:30:00-03:00').getTime())
  })
})
