import { describe, it, expect } from 'vitest'
import { nextOccurrence } from '../domain/occurrences'

const d = (s: string) => new Date(s)
const ev = (start_date: string, end_date: string, start_time: string | null) => ({ start_date, end_date, start_time })
// martes 2026-10-06, 21:00
const NOW = d('2026-10-06T21:00:00-03:00')

describe('nextOccurrence (eventos próximos de un lugar, AC-28)', () => {
  it('un evento de hoy que empezó hace menos de 2 h todavía cuenta', () => {
    expect(nextOccurrence(ev('2026-10-06', '2026-10-06', '19:30'), NOW)?.toISOString()).toBe(
      d('2026-10-06T19:30:00-03:00').toISOString(),
    )
  })

  it('un evento de hoy que empezó hace más de 2 h ya pasó', () => {
    expect(nextOccurrence(ev('2026-10-06', '2026-10-06', '18:00'), NOW)).toBeNull()
  })

  it('un evento futuro devuelve su primera ocurrencia', () => {
    expect(nextOccurrence(ev('2026-10-09', '2026-10-09', '20:00'), NOW)?.toISOString()).toBe(
      d('2026-10-09T20:00:00-03:00').toISOString(),
    )
  })

  it('un rango repite el horario cada día: devuelve la próxima ocurrencia no pasada', () => {
    expect(nextOccurrence(ev('2026-10-01', '2026-10-10', '10:00'), NOW)?.toISOString()).toBe(
      d('2026-10-07T10:00:00-03:00').toISOString(),
    )
  })

  it('un rango cuya última ocurrencia ya pasó ya pasó', () => {
    expect(nextOccurrence(ev('2026-10-01', '2026-10-06', '10:00'), NOW)).toBeNull()
  })

  it('sin horario: cuenta mientras end_date no sea anterior al día de negocio de hoy', () => {
    expect(nextOccurrence(ev('2026-10-06', '2026-10-06', null), NOW)).not.toBeNull()
    expect(nextOccurrence(ev('2026-10-05', '2026-10-05', null), NOW)).toBeNull()
    expect(nextOccurrence(ev('2026-10-01', '2026-10-30', null), NOW)).not.toBeNull()
  })

  it('sin horario, el evento queda para el final de la lista de un mismo día', () => {
    const conHora = nextOccurrence(ev('2026-10-07', '2026-10-07', '23:00'), NOW)!
    const sinHora = nextOccurrence(ev('2026-10-07', '2026-10-07', null), NOW)!
    expect(sinHora.getTime()).toBeLessThan(conHora.getTime()) // arranca el día de negocio a las 06:00
  })
})
