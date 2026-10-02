import { addDays, businessDate, businessDayStart, EVENT_TOLERANCE_MS, HOUR_MS, localToInstant, weekdayMon0 } from './time'

export type Cuando = 'ahora' | 'hoy' | 'manana' | 'finde' | 'fecha'

/**
 * Ventana de búsqueda (descripción de `searchItems`). Los eventos toleran 2 h hacia atrás (F-14);
 * los lugares empiezan en `ahora`.
 */
export interface SearchWindow {
  cuando: Cuando
  eventFrom: Date
  placeFrom: Date
  to: Date
  /** `true` solo en `ahora`: un inicio exacto en `now + 1 h` todavía entra. */
  toInclusive: boolean
  /** La ventana contiene el momento actual (habilita la franja `ahora` de los lugares). */
  includesNow: boolean
  /** Días de negocio que toca la ventana (para rangos largos y eventos sin horario). */
  businessDates: string[]
}

export class InvalidWindowError extends Error {}

const FRIDAY = 4

const dayWindow = (cuando: Cuando, date: string): SearchWindow => ({
  cuando,
  eventFrom: businessDayStart(date),
  placeFrom: businessDayStart(date),
  to: businessDayStart(addDays(date, 1)),
  toInclusive: false,
  includesNow: false,
  businessDates: [date],
})

export function resolveWindow(cuando: Cuando, fecha: string | undefined, now: Date): SearchWindow {
  const today = businessDate(now)
  const tolerantFrom = new Date(now.getTime() - EVENT_TOLERANCE_MS)

  const restOfToday = (c: Cuando): SearchWindow => ({
    cuando: c,
    eventFrom: tolerantFrom,
    placeFrom: now,
    to: businessDayStart(addDays(today, 1)),
    toInclusive: false,
    includesNow: true,
    businessDates: [today],
  })

  switch (cuando) {
    case 'ahora': {
      const to = new Date(now.getTime() + HOUR_MS)
      return {
        cuando,
        eventFrom: tolerantFrom,
        placeFrom: now,
        to,
        toInclusive: true,
        includesNow: true,
        businessDates: [...new Set([businessDate(tolerantFrom), today, businessDate(to)])],
      }
    }
    case 'hoy':
      return restOfToday('hoy')
    case 'manana':
      return dayWindow('manana', addDays(today, 1))
    case 'fecha': {
      if (!fecha || fecha < today) {
        throw new InvalidWindowError('La fecha no puede ser anterior a hoy')
      }
      return fecha === today ? restOfToday('fecha') : dayWindow('fecha', fecha)
    }
    case 'finde': {
      const wd = weekdayMon0(today)
      const inCourse = wd > FRIDAY || (wd === FRIDAY && now >= localToInstant(today, '18:00'))
      const friday = addDays(today, FRIDAY - wd)
      const friday18 = localToInstant(friday, '18:00')
      const to = businessDayStart(addDays(friday, 3))
      const firstDate = inCourse ? today : friday
      const dates = [firstDate]
      while (addDays(dates[dates.length - 1]!, 1) <= addDays(friday, 2)) {
        dates.push(addDays(dates[dates.length - 1]!, 1))
      }
      const later = (a: Date, b: Date) => (a > b ? a : b)
      return {
        cuando,
        eventFrom: inCourse ? later(friday18, tolerantFrom) : friday18,
        placeFrom: inCourse ? later(friday18, now) : friday18,
        to,
        toInclusive: false,
        includesNow: inCourse,
        businessDates: dates,
      }
    }
  }
}
