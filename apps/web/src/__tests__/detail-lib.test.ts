import { describe, expect, it } from 'vitest'
import {
  activeTab,
  backTarget,
  detailLink,
  mapsUrl,
  originFromState,
  safeSourceUrl,
  searchOrigin,
  truncateDescription,
} from '@/lib/detail'
import { round5n, validCoord } from '@/lib/coords'
import { formatWhen } from '@/lib/format'

describe('coordenadas compartidas', () => {
  it('[AC-3] validCoord: finito y dentro del rango; round5n a 5 decimales', () => {
    expect(validCoord(-32.94682, 90)).toBe(true)
    expect(validCoord(91, 90)).toBe(false)
    expect(validCoord(Number.NaN, 90)).toBe(false)
    expect(validCoord(undefined, 90)).toBe(false)
    expect(round5n(-32.9468212345)).toBe(-32.94682)
  })
})

describe('detailLink', () => {
  it('[AC-2] los lugares no tienen enlace (S4-2)', () => {
    expect(detailLink('place', 'p1', { lat: -32.9, lon: -60.6 })).toBeNull()
    expect(detailLink('otro', 'x')).toBeNull()
  })

  it('[AC-2][AC-3] evento: path canónico sin lat/lon y origen en el state', () => {
    expect(detailLink('event', 'e1', { lat: -32.946821234, lon: -60.639 })).toEqual({
      path: '/e/e1',
      state: { origin: { lat: -32.94682, lon: -60.639 } },
    })
  })

  it('[AC-3] sin origen, o con un origen inválido, el state no lleva origen', () => {
    expect(detailLink('event', 'e1')).toEqual({ path: '/e/e1', state: {} })
    expect(detailLink('event', 'e1', { lat: 200, lon: 0 })).toEqual({ path: '/e/e1', state: {} })
  })
})

describe('origen de la navegación', () => {
  const zone = { id: 'pichincha', lat: -32.93, lon: -60.65 }

  it('[AC-3] la zona usa su centro; sin zonas cargadas, sin origen', () => {
    expect(searchOrigin({ z: 'pichincha' }, zone)).toEqual({ lat: -32.93, lon: -60.65 })
    expect(searchOrigin({ z: 'pichincha' }, undefined)).toBeNull()
  })

  it('[AC-3] por coordenadas: el par completo y válido; si no, nada', () => {
    expect(searchOrigin({ lat: -32.9, lon: -60.6 })).toEqual({ lat: -32.9, lon: -60.6 })
    expect(searchOrigin({ lat: -32.9 })).toBeNull()
    expect(searchOrigin({})).toBeNull()
  })

  it('[AC-3][AC-4] originFromState lee history.state y descarta lo inválido', () => {
    expect(originFromState({ origin: { lat: -32.9, lon: -60.6 } })).toEqual({ lat: -32.9, lon: -60.6 })
    expect(originFromState({ origin: { lat: 'x', lon: 1 } })).toBeNull()
    expect(originFromState({ origin: { lat: 95, lon: 1 } })).toBeNull()
    expect(originFromState(null)).toBeNull()
    expect(originFromState({})).toBeNull()
  })
})

describe('backTarget', () => {
  it('[AC-14] router.back() solo si venimos de /resultados', () => {
    expect(backTarget({ back: '/resultados?i=comer' })).toBe('back')
    expect(backTarget({ back: '/resultados' })).toBe('back')
  })

  it('[AC-14] link directo, Home, Zona o evento hermano: va a /resultados', () => {
    expect(backTarget(null)).toBe('/resultados')
    expect(backTarget({ back: null })).toBe('/resultados')
    expect(backTarget({ back: '/' })).toBe('/resultados')
    expect(backTarget({ back: '/zona?z=centro' })).toBe('/resultados')
    expect(backTarget({ back: '/e/otro' })).toBe('/resultados')
    expect(backTarget({ back: '/resultadosx' })).toBe('/resultados')
  })
})

describe('activeTab', () => {
  it('[AC-15] /e/:id marca Resultados vía meta.tab', () => {
    expect(activeTab({ path: '/e/abc', meta: { tab: 'resultados' } })).toBe('resultados')
  })

  it('[AC-15] las demás rutas se resuelven por path', () => {
    expect(activeTab({ path: '/', meta: {} })).toBe('buscar')
    expect(activeTab({ path: '/zona', meta: {} })).toBe('zona')
    expect(activeTab({ path: '/resultados', meta: {} })).toBe('resultados')
    expect(activeTab({ path: '/nada', meta: {} })).toBeNull()
  })
})

describe('formatWhen', () => {
  const base = { start_time: null, date_text: null }

  it('[AC-6] fecha única con hora', () => {
    expect(formatWhen({ ...base, start_date: '2026-10-24', end_date: '2026-10-24', start_time: '21:00' })).toEqual({
      text: 'Sáb 24 oct · 21:00',
      note: null,
    })
  })

  it('[AC-6] fecha única sin hora: «Horario a confirmar»', () => {
    expect(formatWhen({ ...base, start_date: '2026-10-24', end_date: '2026-10-24' }).text).toBe(
      'Sáb 24 oct · Horario a confirmar',
    )
  })

  it('[AC-6] rango dentro de un mes, sin hora', () => {
    expect(
      formatWhen({ ...base, start_date: '2026-10-03', end_date: '2026-10-30', start_time: '20:00' }).text,
    ).toBe('Del 3 al 30 oct')
  })

  it('[AC-6] rango entre meses y entre años', () => {
    expect(formatWhen({ ...base, start_date: '2026-12-28', end_date: '2027-01-05' }).text).toBe(
      'Del 28 dic 2026 al 5 ene 2027',
    )
    expect(formatWhen({ ...base, start_date: '2026-09-28', end_date: '2026-10-05' }).text).toBe(
      'Del 28 sep al 5 oct',
    )
  })

  it('[AC-6] date_text va como nota secundaria, nunca en lugar de la fecha', () => {
    const w = formatWhen({ ...base, start_date: '2026-10-24', end_date: '2026-10-24', date_text: 'Sábados de octubre' })
    expect(w.note).toBe('Según la fuente: Sábados de octubre')
    expect(w.text).toContain('24 oct')
  })
})

describe('Cómo llegar', () => {
  it('[AC-8] enlace universal de Google Maps por coordenadas', () => {
    expect(mapsUrl(-32.9468, -60.6393)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-32.9468%2C-60.6393',
    )
  })

  it('[AC-8] sin coordenadas, o inválidas, no hay enlace', () => {
    expect(mapsUrl(null, -60)).toBeNull()
    expect(mapsUrl(-32, null)).toBeNull()
    expect(mapsUrl(95, 0)).toBeNull()
  })
})

describe('safeSourceUrl', () => {
  it('[AC-10] solo se enlazan URLs http(s)', () => {
    expect(safeSourceUrl('https://ej.com/a')).toBe('https://ej.com/a')
    expect(safeSourceUrl('http://ej.com')).toBe('http://ej.com/')
    expect(safeSourceUrl('javascript:alert(1)')).toBeNull()
    expect(safeSourceUrl('data:text/html,x')).toBeNull()
    expect(safeSourceUrl('no es url')).toBeNull()
  })
})

describe('truncateDescription', () => {
  it('[AC-12] hasta 400 caracteres no se trunca', () => {
    expect(truncateDescription('a'.repeat(400))).toEqual({ text: 'a'.repeat(400), truncated: false })
  })

  it('[AC-12] por encima de 400 se corta y avisa; expandido muestra todo', () => {
    const long = 'a'.repeat(401)
    const t = truncateDescription(long)
    expect(t.truncated).toBe(true)
    expect(t.text.length).toBeLessThanOrEqual(401)
    expect(truncateDescription(long, true)).toEqual({ text: long, truncated: true })
  })
})
