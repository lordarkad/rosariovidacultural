import { firstOpenInWindow, isOpenAt, type OpeningPeriod } from './opening-hours'
import {
  addDays,
  businessDate,
  dateRange,
  daysInclusive,
  localMinutes,
  localToInstant,
  minutesOfTime,
} from './time'
import type { SearchWindow } from './windows'

export type Band =
  | 'ahora'
  | 'hoy'
  | 'esta_noche'
  | 'manana'
  | 'proximos'
  | 'en_cartel'
  | 'a_confirmar'

/** Orden de las franjas en la lista (B-9). */
export const BAND_ORDER: Band[] = [
  'ahora',
  'hoy',
  'esta_noche',
  'manana',
  'proximos',
  'en_cartel',
  'a_confirmar',
]

const HOUR_MS = 3_600_000
const LONG_RANGE_DAYS = 7
const NIGHT_FROM_MIN = 20 * 60
const DAY_FROM_MIN = 6 * 60

export interface BandResult {
  band: Band
  /** Clave de orden dentro de la franja: instante en ms, o hora del día en minutos en `en_cartel`. `null` = al final. */
  startKey: number | null
}

/** Franja de un instante concreto, relativo a `now`. */
export function bandOfInstant(t: Date, now: Date, opts: { allowAhora?: boolean } = {}): Band {
  const allowAhora = opts.allowAhora ?? true
  const ms = t.getTime()
  if (allowAhora && ms >= now.getTime() - 2 * HOUR_MS && ms <= now.getTime() + HOUR_MS) {
    return 'ahora'
  }
  const tb = businessDate(t)
  const nb = businessDate(now)
  if (tb === nb || tb < nb) {
    const m = localMinutes(t)
    return m >= NIGHT_FROM_MIN || m < DAY_FROM_MIN ? 'esta_noche' : 'hoy'
  }
  return tb === addDays(nb, 1) ? 'manana' : 'proximos'
}

const overlapsWindow = (start: string, end: string, w: SearchWindow): boolean =>
  w.businessDates.some((d) => start <= d && d <= end)

const withinWindow = (t: Date, from: Date, w: SearchWindow): boolean =>
  t >= from && (w.toInclusive ? t <= w.to : t < w.to)

/** Reglas de franja de un evento (descripción de `searchItems`). `null` = no aparece en la ventana. */
export function classifyEvent(
  e: { start_date: string; end_date: string; start_time: string | null },
  w: SearchWindow,
  now: Date,
): BandResult | null {
  // 1. Rango largo (E-3): en_cartel, con o sin horario; nunca con `ahora`
  if (daysInclusive(e.start_date, e.end_date) > LONG_RANGE_DAYS) {
    if (w.cuando === 'ahora' || !overlapsWindow(e.start_date, e.end_date, w)) return null
    return { band: 'en_cartel', startKey: e.start_time ? minutesOfTime(e.start_time) : null }
  }
  // 2. Sin horario (E-4): solo con hoy o finde
  if (!e.start_time) {
    if (w.cuando !== 'hoy' && w.cuando !== 'finde') return null
    return overlapsWindow(e.start_date, e.end_date, w) ? { band: 'a_confirmar', startKey: null } : null
  }
  // 3. Con horario: primera ocurrencia (el horario se repite cada día del rango) dentro de la ventana
  for (const date of dateRange(e.start_date, e.end_date)) {
    const t = localToInstant(date, e.start_time)
    if (withinWindow(t, w.eventFrom, w)) {
      return { band: bandOfInstant(t, now), startKey: t.getTime() }
    }
  }
  return null
}

/** Reglas de franja de un lugar (F-9, F-14). `open_now` se calcula contra `now`. */
export function classifyPlace(
  p: { opening_hours: OpeningPeriod[] | null },
  w: SearchWindow,
  now: Date,
): (BandResult & { open_now: boolean | null }) | null {
  if (!p.opening_hours) {
    return w.cuando === 'hoy' || w.cuando === 'finde'
      ? { band: 'a_confirmar', startKey: null, open_now: null }
      : null
  }
  const open_now = isOpenAt(p.opening_hours, now)
  if (w.cuando === 'ahora') {
    return open_now ? { band: 'ahora', startKey: now.getTime(), open_now } : null
  }
  if (open_now && w.includesNow) return { band: 'ahora', startKey: now.getTime(), open_now }
  const first = firstOpenInWindow(p.opening_hours, w.placeFrom, w.to)
  if (!first) return null
  return {
    band: bandOfInstant(first, now, { allowAhora: false }),
    startKey: first.getTime(),
    open_now,
  }
}
