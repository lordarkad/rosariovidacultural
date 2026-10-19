import { addDays, DAY_MS, localDate, localToInstant, weekdayMon0 } from './time'

/** Hasta dónde mira `nextStateChange`: si no hay un cambio antes de «ahora + 8 días», no lo informa. */
const CHANGE_HORIZON_MS = 8 * DAY_MS

/** Período semanal (spec `OpeningPeriod`): `day` 0 = lunes. `closes < opens` cierra al día siguiente. */
export interface OpeningPeriod {
  day: number
  opens: string
  closes: string
}


/** Intervalos abiertos que se superponen con [from, to). Un período puede venir del día anterior. */
function openIntervals(periods: OpeningPeriod[], from: Date, to: Date): Array<[Date, Date]> {
  const out: Array<[Date, Date]> = []
  const last = localDate(to)
  for (let date = addDays(localDate(from), -1); date <= last; date = addDays(date, 1)) {
    const wd = weekdayMon0(date)
    for (const p of periods) {
      if (p.day !== wd) continue
      const start = localToInstant(date, p.opens)
      const end =
        p.closes === p.opens
          ? new Date(start.getTime() + DAY_MS)
          : p.closes > p.opens
            ? localToInstant(date, p.closes)
            : localToInstant(addDays(date, 1), p.closes)
      if (end > from && start < to) out.push([start, end])
    }
  }
  return out
}

/** `null` = horario no informado. */
export function isOpenAt(periods: OpeningPeriod[] | null, at: Date): boolean | null {
  if (!periods) return null
  const probe = new Date(at.getTime() + 1)
  return openIntervals(periods, at, probe).some(([s, e]) => s <= at && at < e)
}

/**
 * Primer instante posterior a `at` en que `isOpenAt` cambia de valor (el cierre si está abierto, la próxima apertura si
 * está cerrado). Los tramos contiguos o superpuestos se fusionan, así que 12:00–16:00 y 16:00–23:00 cierran a las 23:00.
 * `null` si no hay horario o si no hay cambio antes de `at` + 8 días (el 24/7, en cualquier representación).
 */
export function nextStateChange(periods: OpeningPeriod[] | null, at: Date): Date | null {
  if (!periods) return null
  const horizon = new Date(at.getTime() + CHANGE_HORIZON_MS)
  const merged: Array<[Date, Date]> = []
  for (const [s, e] of openIntervals(periods, at, horizon).sort((a, b) => a[0].getTime() - b[0].getTime())) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) {
      if (e > last[1]) last[1] = e
    } else merged.push([s, e])
  }
  const current = merged.find(([s, e]) => s <= at && at < e)
  const change = current ? current[1] : merged.find(([s]) => s > at)?.[0]
  return change && change < horizon ? change : null
}

/** Primer momento abierto dentro de [from, to), o `null` si no abre. */
export function firstOpenInWindow(
  periods: OpeningPeriod[] | null,
  from: Date,
  to: Date,
): Date | null {
  if (!periods) return null
  let best: Date | null = null
  for (const [s] of openIntervals(periods, from, to)) {
    const t = s > from ? s : from
    if (!best || t < best) best = t
  }
  return best
}
