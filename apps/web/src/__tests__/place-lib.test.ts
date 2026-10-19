import { describe, expect, it } from 'vitest'
import { instagramUrl, openStatus, phoneAction, placeLabels, weekSchedule } from '@/lib/place'

// Miércoles 21 de octubre de 2026, 21:00 en Buenos Aires (UTC-3, sin horario de verano).
const NOW = new Date('2026-10-22T00:00:00Z')
const hours = { hours_text: null }

describe('openStatus', () => {
  it('[AC-5] abierto: cierre el mismo día, al día siguiente y más lejos', () => {
    expect(openStatus({ ...hours, open_now: true, next_change_at: '2026-10-22T02:00:00Z' }, NOW)).toEqual({
      open: true,
      text: 'Abierto ahora · cierra 23:00',
    })
    expect(openStatus({ ...hours, open_now: true, next_change_at: '2026-10-22T06:00:00Z' }, NOW)?.text).toBe(
      'Abierto ahora · cierra mañana 03:00',
    )
    expect(openStatus({ ...hours, open_now: true, next_change_at: '2026-10-23T15:00:00Z' }, NOW)?.text).toBe(
      'Abierto ahora · cierra el vie 12:00',
    )
  })

  it('[AC-5] un cierre a las 00:00 se dice «a la medianoche» del día que termina', () => {
    expect(openStatus({ ...hours, open_now: true, next_change_at: '2026-10-22T03:00:00Z' }, NOW)?.text).toBe(
      'Abierto ahora · cierra a la medianoche',
    )
    expect(openStatus({ ...hours, open_now: true, next_change_at: '2026-10-23T03:00:00Z' }, NOW)?.text).toBe(
      'Abierto ahora · cierra a la medianoche del jue',
    )
  })

  it('[AC-5] cerrado: apertura hoy, mañana, otro día y una semana después', () => {
    expect(openStatus({ ...hours, open_now: false, next_change_at: '2026-10-22T01:30:00Z' }, NOW)).toEqual({
      open: false,
      text: 'Cerrado ahora · abre hoy 22:30',
    })
    expect(openStatus({ ...hours, open_now: false, next_change_at: '2026-10-22T15:00:00Z' }, NOW)?.text).toBe(
      'Cerrado ahora · abre mañana 12:00',
    )
    expect(openStatus({ ...hours, open_now: false, next_change_at: '2026-10-23T15:00:00Z' }, NOW)?.text).toBe(
      'Cerrado ahora · abre el vie 12:00',
    )
    expect(openStatus({ ...hours, open_now: false, next_change_at: '2026-10-28T15:00:00Z' }, NOW)?.text).toBe(
      'Cerrado ahora · abre el próximo mié 12:00',
    )
  })

  it('[AC-5] el día se cuenta en Buenos Aires, no en UTC', () => {
    // 22:30 del miércoles en Buenos Aires ya es jueves en UTC
    expect(openStatus({ ...hours, open_now: false, next_change_at: '2026-10-22T01:30:00Z' }, NOW)?.text).toContain('hoy')
  })

  it('[AC-5] abierto sin cambio de estado: abierto las 24 h', () => {
    expect(openStatus({ ...hours, open_now: true, next_change_at: null }, NOW)).toEqual({
      open: true,
      text: 'Abierto las 24 h',
    })
  })

  it('[AC-5] sin horario estructurado: texto de la fuente o «Horario no informado»', () => {
    expect(openStatus({ open_now: null, next_change_at: null, hours_text: 'Mo-Sa 12:00-23:00' }, NOW)).toEqual({
      open: null,
      text: 'Según la fuente: Mo-Sa 12:00-23:00',
    })
    expect(openStatus({ open_now: null, next_change_at: null, hours_text: null }, NOW)).toEqual({
      open: null,
      text: 'Horario no informado',
    })
  })

  it('[AC-5] con el reloj ya pasado el próximo cambio no se afirma abierto ni cerrado', () => {
    expect(openStatus({ ...hours, open_now: true, next_change_at: '2026-10-21T23:00:00Z' }, NOW)).toBeNull()
    expect(openStatus({ ...hours, open_now: false, next_change_at: '2026-10-22T00:00:00Z' }, NOW)).toBeNull()
  })
})

describe('weekSchedule', () => {
  const periods = [
    { day: 2, opens: '20:00', closes: '03:00' },
    { day: 2, opens: '12:00', closes: '16:00' },
    { day: 5, opens: '18:00', closes: '03:00' },
    { day: 6, opens: '00:00', closes: '00:00' },
  ]

  it('[AC-6] siete filas de lunes a domingo; sin tramos, «Cerrado»', () => {
    const rows = weekSchedule(periods, NOW)
    expect(rows.map((r) => r.label)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
    expect(rows[0]!.text).toBe('Cerrado')
    expect(rows[3]!.text).toBe('Cerrado')
  })

  it('[AC-6] varios tramos del día ordenados y unidos con «y»; el cierre pasada la medianoche va en el día de apertura', () => {
    const rows = weekSchedule(periods, NOW)
    expect(rows[2]!.text).toBe('12:00–16:00 y 20:00–03:00')
    expect(rows[5]!.text).toBe('18:00–03:00')
  })

  it('[AC-6] apertura igual al cierre: «24 h»', () => {
    expect(weekSchedule(periods, NOW)[6]!.text).toBe('24 h')
  })

  it('[AC-6] marca hoy en hora de Buenos Aires', () => {
    expect(weekSchedule(periods, NOW).map((r) => r.today)).toEqual([false, false, true, false, false, false, false])
    // 01:00 UTC del jueves sigue siendo miércoles 22:00 en Buenos Aires
    const lateWed = new Date('2026-10-22T01:00:00Z')
    expect(weekSchedule(periods, lateWed)[2]!.today).toBe(true)
  })
})

describe('phoneAction', () => {
  it('[AC-7] celular argentino → WhatsApp con wa.me', () => {
    expect(phoneAction('+54 9 341 555-1234')).toEqual({ kind: 'whatsapp', href: 'https://wa.me/5493415551234' })
  })

  it('[AC-7] fijo argentino → Llamar con tel:', () => {
    expect(phoneAction('+54 341 421-1234')).toEqual({ kind: 'call', href: 'tel:+543414211234' })
  })

  it('[AC-7] varios números con «;»: se usa el primero', () => {
    expect(phoneAction('+54 341 421-1234; +54 9 341 555-1234')).toEqual({ kind: 'call', href: 'tel:+543414211234' })
  })

  it('[AC-7] otro país con «+» → Llamar', () => {
    expect(phoneAction('+598 2 900 1234')).toEqual({ kind: 'call', href: 'tel:+59829001234' })
  })

  it('[AC-7] «15» local, sin prefijo, corto o no parseable → sin botón', () => {
    expect(phoneAction('+54 341 15 555123')).toBeNull()
    expect(phoneAction('341 421-1234')).toBeNull()
    expect(phoneAction('+1234')).toBeNull()
    expect(phoneAction('llamar al bar')).toBeNull()
    expect(phoneAction('')).toBeNull()
    expect(phoneAction(null)).toBeNull()
  })
})

describe('instagramUrl', () => {
  it('[AC-7] usuario válido → perfil de Instagram', () => {
    expect(instagramUrl('el.bar_rosario')).toBe('https://www.instagram.com/el.bar_rosario/')
  })

  it('[AC-7] usuario inválido o vacío → sin enlace', () => {
    expect(instagramUrl('a b')).toBeNull()
    expect(instagramUrl('../x')).toBeNull()
    expect(instagramUrl('a'.repeat(31))).toBeNull()
    expect(instagramUrl('')).toBeNull()
    expect(instagramUrl(null)).toBeNull()
  })
})

describe('placeLabels', () => {
  it('[AC-9] tipo, lo que ofrece y aire libre, en ese orden', () => {
    expect(placeLabels({ kind: 'bar', offers: ['musica_en_vivo', 'cena'], outdoor: true })).toEqual([
      'Bar',
      'Música en vivo',
      'Cena',
      'Aire libre',
    ])
  })

  it('[AC-9] AIRE LIBRE solo con true; «otro» y desconocidos no se rotulan', () => {
    expect(placeLabels({ kind: 'otro', offers: [], outdoor: false })).toEqual([])
    expect(placeLabels({ kind: 'otro', offers: [], outdoor: null })).toEqual([])
    expect(placeLabels({ kind: 'nuevo' as never, offers: ['baile', 'nuevo' as never], outdoor: null })).toEqual(['Baile'])
  })
})
