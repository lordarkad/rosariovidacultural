import { businessDate, businessDayStart, dateRange, EVENT_TOLERANCE_MS, localToInstant } from './time'


/**
 * Próxima ocurrencia de un evento a partir de `now`, o `null` si ya pasó. El horario se repite cada día del
 * rango (F-14); una ocurrencia que empezó hace hasta 2 h todavía cuenta (igual que la franja `ahora`).
 * Sin horario cuenta hasta el final de `end_date` y arranca con el día de negocio.
 */
export function nextOccurrence(
  e: { start_date: string; end_date: string; start_time: string | null },
  now: Date,
): Date | null {
  if (!e.start_time) {
    const today = businessDate(now)
    if (e.end_date < today) return null
    return businessDayStart(e.start_date > today ? e.start_date : today)
  }
  const cutoff = now.getTime() - EVENT_TOLERANCE_MS
  for (const date of dateRange(e.start_date, e.end_date)) {
    const t = localToInstant(date, e.start_time)
    if (t.getTime() >= cutoff) return t
  }
  return null
}
