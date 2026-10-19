import type { OpeningPeriod, PlaceDetail } from '@tript/shared'
import { placeKindLabel, todayInBuenosAires } from '@/lib/format'

const TZ = 'America/Argentina/Buenos_Aires'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** «23:00» en hora de Buenos Aires. */
const timeInBuenosAires = (at: Date): string => timeFormat.format(at)

// Abreviaturas del día; el índice es `Date.getUTCDay()` (0 = domingo).
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const WEEK_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const DAY_MS = 86_400_000

/** Medianoche UTC de un `YYYY-MM-DD`: sirve para contar días calendario y leer el día de la semana. */
const utcDay = (date: string): number => Date.parse(`${date}T00:00:00Z`)
const weekdayShort = (date: string): string => WEEKDAYS_SHORT[new Date(utcDay(date)).getUTCDay()]!

export interface OpenStatus {
  /** `true` abierto, `false` cerrado, `null` sin horario estructurado. */
  open: boolean | null
  text: string
}

type StatusInput = Pick<PlaceDetail, 'open_now' | 'next_change_at' | 'hours_text'>

/**
 * Estado de horario del lugar (L-4). El servidor dice cuándo cambia (`next_change_at`); acá solo se formatea,
 * por día calendario de Buenos Aires. `null` si el reloj ya pasó ese instante: no se afirma nada.
 */
export function openStatus(p: StatusInput, now: Date = new Date()): OpenStatus | null {
  if (p.open_now === null) {
    return { open: null, text: p.hours_text ? `Según la fuente: ${p.hours_text}` : 'Horario no informado' }
  }

  const open = p.open_now
  if (p.next_change_at === null) return open ? { open, text: 'Abierto las 24 h' } : null

  const at = new Date(p.next_change_at)
  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) return null

  const today = todayInBuenosAires(now)
  const day = todayInBuenosAires(at)
  const diff = Math.round((utcDay(day) - utcDay(today)) / DAY_MS)
  const time = timeInBuenosAires(at)

  if (open) {
    const lead = 'Abierto ahora · cierra'
    if (time === '00:00') {
      // La medianoche pertenece al día que termina, no al que empieza.
      const ending = todayInBuenosAires(new Date(at.getTime() - DAY_MS))
      return { open, text: ending === today ? `${lead} a la medianoche` : `${lead} a la medianoche del ${weekdayShort(ending)}` }
    }
    if (diff === 0) return { open, text: `${lead} ${time}` }
    if (diff === 1) return { open, text: `${lead} mañana ${time}` }
    return { open, text: `${lead} el ${weekdayShort(day)} ${time}` }
  }

  const lead = 'Cerrado ahora · abre'
  if (diff === 0) return { open, text: `${lead} hoy ${time}` }
  if (diff === 1) return { open, text: `${lead} mañana ${time}` }
  if (diff >= 7) return { open, text: `${lead} el próximo ${weekdayShort(day)} ${time}` }
  return { open, text: `${lead} el ${weekdayShort(day)} ${time}` }
}

export interface WeekRow {
  label: string
  text: string
  today: boolean
}

const range = (p: OpeningPeriod): string => (p.opens === p.closes ? '24 h' : `${p.opens}–${p.closes}`)

/** Semana plegada (L-5): siete filas lunes → domingo; un cierre pasada la medianoche va en el día en que abre. */
export function weekSchedule(periods: OpeningPeriod[], now: Date = new Date()): WeekRow[] {
  // `getUTCDay()`: 0 = domingo; el contrato usa 0 = lunes.
  const todayIndex = (new Date(utcDay(todayInBuenosAires(now))).getUTCDay() + 6) % 7
  return WEEK_LABELS.map((label, day) => {
    const tramos = periods.filter((p) => p.day === day).sort((a, b) => a.opens.localeCompare(b.opens))
    return { label, text: tramos.length ? tramos.map(range).join(' y ') : 'Cerrado', today: day === todayIndex }
  })
}

export interface PhoneAction {
  kind: 'whatsapp' | 'call'
  href: string
}

/**
 * Botón de contacto del teléfono (L-6): celular argentino → WhatsApp, fijo o `+` de otro país → Llamar.
 * El campo puede traer varios números separados por `;` (OSM): se usa el primero. Lo que no encaja, sin botón.
 */
export function phoneAction(phone: string | null | undefined): PhoneAction | null {
  const first = phone?.split(';')[0]?.trim()
  if (!first) return null
  const digits = first.replace(/\D/g, '')

  if (digits.startsWith('54')) {
    if (/^549\d{10}$/.test(digits)) return { kind: 'whatsapp', href: `https://wa.me/${digits}` }
    if (/^54\d{10}$/.test(digits)) return { kind: 'call', href: `tel:+${digits}` }
    return null
  }
  if (first.startsWith('+') && digits.length >= 8 && digits.length <= 15) return { kind: 'call', href: `tel:+${digits}` }
  return null
}

/** Perfil de Instagram; el usuario se valida porque va dentro de una URL (L-6). */
export function instagramUrl(user: string | null | undefined): string | null {
  return user && /^[A-Za-z0-9._]{1,30}$/.test(user) ? `https://www.instagram.com/${user}/` : null
}

const OFFER_LABELS: Record<string, string> = {
  musica_en_vivo: 'Música en vivo',
  cena: 'Cena',
  baile: 'Baile',
}

/** Etiquetas de la cabecera (L-7): tipo, lo que ofrece y aire libre (solo con `true`). */
export function placeLabels(p: Pick<PlaceDetail, 'kind' | 'offers' | 'outdoor'>): string[] {
  const labels = [placeKindLabel(p.kind), ...p.offers.map((o) => OFFER_LABELS[o] ?? null)]
  if (p.outdoor === true) labels.push('Aire libre')
  return labels.filter((l): l is string => l !== null)
}
