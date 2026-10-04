import { addDays, DAY_MS, localDate, localToInstant, weekdayMon0 } from './time'

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
