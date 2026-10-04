import { describe, it, expect } from 'vitest'
import {
  addDays,
  businessDate,
  businessDayStart,
  daysInclusive,
  localDate,
  localMinutes,
  localToInstant,
  weekdayMon0,
} from '../domain/time'

const d = (s: string) => new Date(s)

describe('time (E-5: America/Argentina/Buenos_Aires, UTC-3, día de negocio 06:00-06:00)', () => {
  it('[AC-9] un evento a las 00:30 locales de D+1 pertenece al día de negocio D y se guarda como 03:30Z', () => {
    const t = localToInstant('2026-10-07', '00:30')
    expect(t.toISOString()).toBe('2026-10-07T03:30:00.000Z')
    expect(localDate(t)).toBe('2026-10-07')
    expect(localMinutes(t)).toBe(30)
    expect(businessDate(t)).toBe('2026-10-06')
  })

  it('el día de negocio cambia a las 06:00 locales, no a medianoche', () => {
    expect(businessDate(d('2026-10-06T05:59:00-03:00'))).toBe('2026-10-05')
    expect(businessDate(d('2026-10-06T06:00:00-03:00'))).toBe('2026-10-06')
    expect(businessDate(d('2026-10-06T23:59:00-03:00'))).toBe('2026-10-06')
  })

  it('localToInstant con hora nula usa el inicio del día de negocio', () => {
    expect(localToInstant('2026-10-06', null).toISOString()).toBe(
      businessDayStart('2026-10-06').toISOString(),
    )
    expect(businessDayStart('2026-10-06').toISOString()).toBe('2026-10-06T09:00:00.000Z')
  })

  it('addDays, weekdayMon0 (0 = lunes) y daysInclusive', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(weekdayMon0('2026-10-05')).toBe(0)
    expect(weekdayMon0('2026-10-11')).toBe(6)
    expect(daysInclusive('2026-10-06', '2026-10-06')).toBe(1)
    expect(daysInclusive('2026-10-01', '2026-10-30')).toBe(30)
  })
})
