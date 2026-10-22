import { describe, expect, it } from 'vitest'
import type { SearchItem } from '@tript/shared'
import { describeSearch, groupByBand, parseSearch, toRouteQuery } from '@/lib/search-query'

const item = (id: string, band: string) => ({ kind: 'event', id, band }) as unknown as SearchItem

describe('parseSearch (la URL manda, S2-3)', () => {
  it('lee intenciones, cuándo, zona y gratis', () => {
    expect(parseSearch({ i: 'comer,bailar', cuando: 'manana', z: 'pichincha', gratis: 'true' })).toEqual({
      i: ['comer', 'bailar'],
      cuando: 'manana',
      z: 'pichincha',
      gratis: true,
    })
  })

  it('descarta valores desconocidos y repetidos sin romper', () => {
    expect(parseSearch({ i: 'comer,volar,comer', cuando: 'siempre', z: 'Mal Id!', gratis: 'si' })).toEqual({
      i: ['comer'],
    })
  })

  it('«fecha» exige una fecha válida', () => {
    expect(parseSearch({ cuando: 'fecha', fecha: '2026-10-20' })).toEqual({ cuando: 'fecha', fecha: '2026-10-20' })
    expect(parseSearch({ cuando: 'fecha' })).toEqual({})
    expect(parseSearch({ cuando: 'fecha', fecha: 'mañana' })).toEqual({})
  })

  it('los géneros solo valen con música en vivo o bailar (F-16/F-17)', () => {
    expect(parseSearch({ i: 'comer', musica: 'tango' })).toEqual({ i: ['comer'] })
    expect(parseSearch({ i: 'bailar', musica: 'tango,vallenato' })).toEqual({ i: ['bailar'], musica: ['tango'] })
    // [AC-16c] los géneros de F-19 se conservan; trap/reguetón no son valores del enum (el género es urbano)
    expect(parseSearch({ i: 'bailar', musica: 'pop,urbano,reggae,cuarteto,metal,trap' })).toEqual({
      i: ['bailar'],
      musica: ['pop', 'urbano', 'reggae', 'cuarteto', 'metal'],
    })
  })

  it('texto libre recortado; vacío se ignora; toma el primer valor si viene repetido', () => {
    expect(parseSearch({ q: '  jazz  ' })).toEqual({ q: 'jazz' })
    expect(parseSearch({ q: '   ' })).toEqual({})
    expect(parseSearch({ cuando: ['hoy', 'manana'] })).toEqual({ cuando: 'hoy' })
  })
})

describe('toRouteQuery', () => {
  it('es la inversa de parseSearch', () => {
    const q = { i: ['musica_en_vivo' as const], musica: ['jazz' as const], cuando: 'fecha' as const, fecha: '2026-10-20', z: 'centro', q: 'trío', gratis: true }
    expect(parseSearch(toRouteQuery(q))).toEqual(q)
  })

  it('no emite claves vacías', () => {
    expect(toRouteQuery({ i: [], q: '' })).toEqual({})
  })
})

describe('groupByBand (orden del servidor, F-10)', () => {
  it('abre un grupo por cada cambio de franja y rotula las desconocidas «Más»', () => {
    const groups = groupByBand([item('1', 'hoy'), item('2', 'hoy'), item('3', 'manana'), item('4', 'nueva')])
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Hoy', 2],
      ['Mañana', 1],
      ['Más', 1],
    ])
  })

  it('lista vacía → sin grupos', () => {
    expect(groupByBand([])).toEqual([])
  })
})

describe('describeSearch', () => {
  it('sin filtros: Todo · Toda la ciudad · Hoy', () => {
    expect(describeSearch({})).toEqual({ que: 'Todo', donde: 'Toda la ciudad', cuando: 'Hoy' })
  })

  it('con filtros usa el nombre de la zona y la fecha elegida', () => {
    expect(
      describeSearch({ i: ['comer', 'bailar'], z: 'centro', cuando: 'fecha', fecha: '2026-10-17', gratis: true }, 'Centro'),
    ).toEqual({ que: 'Comer + Bailar + Gratis', donde: 'Centro', cuando: 'sáb 17 oct' })
  })
})

describe('origen por coordenadas (lat, lon, radio_m)', () => {
  it('[AC-1] lee el origen y lo acota al rango del contrato', () => {
    expect(parseSearch({ lat: '-32.9468', lon: '-60.6393', radio_m: '3000' })).toEqual({
      lat: -32.9468,
      lon: -60.6393,
      radio_m: 3000,
    })
    expect(parseSearch({ lat: '-32.9', lon: '-60.6', radio_m: '99999' })).toMatchObject({ radio_m: 10000 })
    expect(parseSearch({ lat: '-32.9', lon: '-60.6', radio_m: '10' })).toMatchObject({ radio_m: 500 })
  })

  it('[AC-1] exige lat y lon juntas y válidas; sin radio queda el del servidor', () => {
    expect(parseSearch({ lat: '-32.9' })).toEqual({})
    expect(parseSearch({ lat: 'abc', lon: '-60.6' })).toEqual({})
    expect(parseSearch({ lat: '120', lon: '-60.6' })).toEqual({})
    expect(parseSearch({ lat: '-32.9', lon: '-60.6' })).toEqual({ lat: -32.9, lon: -60.6 })
  })

  it('[AC-1] la zona y el origen son excluyentes: gana la zona', () => {
    expect(parseSearch({ z: 'centro', lat: '-32.9', lon: '-60.6', radio_m: '3000' })).toEqual({ z: 'centro' })
  })

  it('[AC-1] toRouteQuery es inversa, redondea a 5 decimales y descarta el origen si hay zona', () => {
    const q = { lat: -32.946812, lon: -60.639312, radio_m: 2500 }
    expect(toRouteQuery(q)).toEqual({ lat: '-32.94681', lon: '-60.63931', radio_m: '2500' })
    expect(parseSearch(toRouteQuery(q))).toEqual({ lat: -32.94681, lon: -60.63931, radio_m: 2500 })
    expect(toRouteQuery({ z: 'centro', lat: -32.9, lon: -60.6 })).toEqual({ z: 'centro' })
  })

  it('[AC-2] la frase dice «Cerca» con el radio', () => {
    expect(describeSearch({ lat: -32.9, lon: -60.6, radio_m: 2500 }).donde).toBe('Cerca · 2,5 km')
    expect(describeSearch({ lat: -32.9, lon: -60.6 }).donde).toBe('Cerca · 2 km')
  })
})
