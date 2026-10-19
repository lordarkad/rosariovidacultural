// Formateadores es-AR. Las fechas se calculan en hora de Buenos Aires, sin importar la zona del dispositivo (S2).
const TZ = 'America/Argentina/Buenos_Aires'
const LOCALE = 'es-AR'

const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const decimal1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 })

/** Fecha calendario (`YYYY-MM-DD`) de hoy en Buenos Aires: el mínimo del selector de fecha (S2-18). */
export function todayInBuenosAires(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
}

/** «sáb 18 oct» para un `YYYY-MM-DD`. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  // mediodía UTC: el día no cambia en ninguna zona horaria
  const at = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
    .format(at)
    .replace(/[.,]/g, '')
}

/** `HH:MM` o `null` («horario no informado») → «21:30 h» o `null`. */
export function formatTime(time: string | null | undefined): string | null {
  return time ? `${time} h` : null
}

/** Precio del ítem (S2-11): «GRATIS», «$ 12.000» o nada si no se conoce. */
export function formatPrice(status: string, fromArs: number | null | undefined): string | null {
  if (status === 'free') return 'GRATIS'
  if (status === 'paid' && fromArs != null) return `$ ${number.format(fromArs)}`
  return null
}

/** «850 m» o «1,2 km»; `null` si no hay origen. */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null) return null
  return meters < 1000 ? `${number.format(meters)} m` : `${decimal1.format(meters / 1000)} km`
}

/** «12 min a pie»; `null` si no hay dato. */
export function formatWalk(minutes: number | null | undefined): string | null {
  return minutes == null ? null : `${minutes} min a pie`
}

const BAND_LABELS: Record<string, string> = {
  ahora: 'Ahora',
  hoy: 'Hoy',
  esta_noche: 'Esta noche',
  manana: 'Mañana',
  proximos: 'Próximos días',
  en_cartel: 'En cartel',
  a_confirmar: 'Horario a confirmar',
}

/** Etiqueta de franja (S2-10). Una franja que la UI no conoce se muestra como «Más». */
export function bandLabel(band: string): string {
  return BAND_LABELS[band] ?? 'Más'
}
