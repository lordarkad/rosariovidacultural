// Tiempo local de America/Argentina/Buenos_Aires (E-5): UTC-3 fijo, sin horario de verano.
// El «día de negocio» va de las 06:00 a las 06:00 del siguiente: un evento a las 00:30 de D+1 es del día D.
// Todo es aritmética sobre UTC, sin Intl, para que corra igual en Node y en Workers.

export const HOUR_MS = 3_600_000
export const DAY_MS = 24 * HOUR_MS
/** Un evento con inicio hasta 2 h atrás sigue «en curso» (F-5, AC-8). */
export const EVENT_TOLERANCE_MS = 2 * HOUR_MS
const OFFSET_MS = -3 * HOUR_MS
const BUSINESS_DAY_START = '06:00'

const shifted = (d: Date): Date => new Date(d.getTime() + OFFSET_MS)

/** Fecha calendario local (YYYY-MM-DD). */
export const localDate = (d: Date): string => shifted(d).toISOString().slice(0, 10)

/** Minutos desde la medianoche local. */
export const localMinutes = (d: Date): number => {
  const s = shifted(d)
  return s.getUTCHours() * 60 + s.getUTCMinutes()
}

/** Día de negocio (06:00 a 06:00) al que pertenece un instante. */
export const businessDate = (d: Date): string => localDate(new Date(d.getTime() - 6 * HOUR_MS))

/** Instante UTC de una fecha local y una hora `HH:MM`. Sin hora, el inicio del día de negocio. */
export const localToInstant = (date: string, time: string | null): Date => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const [hh, mm] = (time ?? BUSINESS_DAY_START).split(':').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - OFFSET_MS)
}

export const businessDayStart = (date: string): Date => localToInstant(date, BUSINESS_DAY_START)

const dateToUtcMs = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

export const addDays = (date: string, n: number): string =>
  new Date(dateToUtcMs(date) + n * DAY_MS).toISOString().slice(0, 10)

/** 0 = lunes ... 6 = domingo. */
export const weekdayMon0 = (date: string): number => (new Date(dateToUtcMs(date)).getUTCDay() + 6) % 7

/** Cantidad de días de un rango inclusivo. */
export const daysInclusive = (start: string, end: string): number =>
  Math.round((dateToUtcMs(end) - dateToUtcMs(start)) / DAY_MS) + 1

/** Todas las fechas de un rango inclusivo. */
export const dateRange = (start: string, end: string): string[] =>
  Array.from({ length: daysInclusive(start, end) }, (_, i) => addDays(start, i))

export const minutesOfTime = (time: string): number => {
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  return hh * 60 + mm
}
