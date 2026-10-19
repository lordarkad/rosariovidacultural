import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EVENT_CSV_COLUMNS,
  PLACE_CSV_COLUMNS,
  buildCsv,
  csvFileName,
  filtersToQuery,
  parseEventsFilters,
  parsePlacesFilters,
  setRobotsMeta,
  vistoLabel,
} from '@/lib/curation'

describe('filtros ⇄ URL', () => {
  it('[AC-24] lee la URL y descarta lo desconocido sin romper', () => {
    expect(
      parseEventsFilters({
        fuente: 'Agenda municipal,Cartel',
        estado: 'pasado,otro',
        faltan: 'imagen,hora,foto',
        q: 'tango',
        page: '3',
      }),
    ).toEqual({ fuente: ['Agenda municipal', 'Cartel'], estado: ['pasado'], faltan: ['imagen', 'hora'], q: 'tango', page: 3 })
    expect(parseEventsFilters({ page: 'abc', estado: 'x' })).toEqual({})
    expect(parseEventsFilters({ page: '0' })).toEqual({})
    expect(parseEventsFilters({ page: '10001' })).toEqual({})
    expect(parseEventsFilters({ q: 'a'.repeat(150) }).q).toHaveLength(100)
    expect(parsePlacesFilters({ origen: 'osm,otro', tipo: 'bar,hotel', faltan: 'cocina,x', page: '2' })).toEqual({
      origen: ['osm'],
      tipo: ['bar'],
      faltan: ['cocina'],
      page: 2,
    })
  })

  it('[AC-24] serializa: omite vacíos y la página 1', () => {
    expect(filtersToQuery({ q: 'tango', estado: ['pasado', 'sin_ver'], faltan: [], page: 1 })).toEqual({
      q: 'tango',
      estado: 'pasado,sin_ver',
    })
    expect(filtersToQuery({ fuente: ['A'], page: 4 })).toEqual({ fuente: 'A', page: '4' })
    expect(filtersToQuery({})).toEqual({})
  })
})

describe('Visto', () => {
  const now = new Date('2026-10-20T15:00:00-03:00')
  it('[AC-27] «hoy» o «N d» por día calendario en Buenos Aires', () => {
    expect(vistoLabel('2026-10-20T10:00:00-03:00', now)).toBe('hoy')
    expect(vistoLabel('2026-10-19T23:59:00-03:00', now)).toBe('1 d')
    expect(vistoLabel('2026-10-13T08:00:00-03:00', now)).toBe('7 d')
    // 01:00Z del 20 todavía es el 19 en Buenos Aires
    expect(vistoLabel('2026-10-20T01:00:00Z', now)).toBe('1 d')
  })
})

describe('CSV', () => {
  const ev = (o: Record<string, unknown> = {}) =>
    ({
      id: 'e1',
      title: 'Show',
      estado: 'vigente',
      start_date: '2026-10-21',
      end_date: '2026-10-21',
      start_time: '21:00',
      date_text: null,
      venue_name: 'Sala',
      address: 'Corrientes 100',
      lat: -32.93415,
      lon: -60.65,
      place: { id: 'p1', name: 'Teatro', address: null },
      price_status: 'paid',
      price_from_ars: 15000,
      image_url: null,
      source_name: 'Cartel',
      source_tier: 'official',
      sources: [
        { name: 'Cartel', url: 'https://cartel.test/e' },
        { name: 'Blog', url: 'https://blog.test/e' },
      ],
      description: null,
      intents: ['espectaculo', 'bailar'],
      music_genres: [],
      last_seen_at: '2026-10-20T10:00:00Z',
      missing: ['imagen', 'descripcion'],
      ...o,
    }) as never

  const lines = (csv: string) => csv.split('\r\n')

  it('[AC-31] BOM, separador ;, CRLF y cabecera con los nombres de columna', () => {
    const csv = buildCsv(EVENT_CSV_COLUMNS, [ev()])
    expect(csv.startsWith('﻿')).toBe(true)
    const [header, row] = lines(csv.slice(1))
    expect(header).toContain('Título;')
    expect(header).toContain(';Fuente;')
    expect(row!.split(';')[0]).toBeTypeOf('string')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('[AC-31] fórmulas: el texto de terceros que empieza con = + - @ lleva apóstrofo', () => {
    const csv = buildCsv(EVENT_CSV_COLUMNS, [ev({ title: '=HYPERLINK("http://x","clic")' })])
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`)
    for (const bad of ['+1', '-1', '@x', '\tx', '\rx']) {
      expect(buildCsv(EVENT_CSV_COLUMNS, [ev({ venue_name: bad })])).toContain(`'${bad}`)
    }
  })

  it('[AC-31] ; comillas y saltos de línea van entre comillas con las comillas duplicadas', () => {
    const csv = buildCsv(EVENT_CSV_COLUMNS, [ev({ address: 'Calle; "Uno"\nDos' })])
    expect(csv).toContain('"Calle; ""Uno""\nDos"')
  })

  it('[AC-31] números con coma decimal y sin apóstrofo; null vacío; listas con " | "', () => {
    const csv = buildCsv(EVENT_CSV_COLUMNS, [ev()])
    expect(csv).toContain(';-32,93415;')
    expect(csv).not.toContain("'-32")
    expect(csv).toContain('espectaculo | bailar')
    expect(csv).toContain('imagen | descripcion')
    // description es null → celda vacía
    const nulo = buildCsv(EVENT_CSV_COLUMNS, [ev({ lat: null, lon: null })])
    expect(nulo).toContain(';;;')
  })

  it('[AC-31] los lugares también salen: cocina, ofrece y faltantes', () => {
    const csv = buildCsv(PLACE_CSV_COLUMNS, [
      {
        id: 'p1',
        name: 'Bar',
        kind: 'bar',
        origin: 'osm',
        intents: [],
        offers: ['cena', 'baile'],
        cuisine: ['café', 'pizza'],
        address: null,
        lat: -32.9,
        lon: -60.6,
        has_opening_hours: false,
        hours_text: null,
        phone: null,
        website: null,
        instagram: null,
        outdoor: null,
        note: null,
        image_url: null,
        last_seen_at: '2026-10-20T10:00:00Z',
        missing: ['horario'],
      } as never,
    ])
    expect(csv).toContain('café | pizza')
    expect(csv).toContain('cena | baile')
    expect(csv).toContain('-32,9')
  })

  it('[AC-29] nombre del archivo con la fecha de Buenos Aires', () => {
    const d = new Date('2026-10-21T01:00:00Z') // 20 en Buenos Aires
    expect(csvFileName('eventos', d)).toBe('curacion-eventos-2026-10-20.csv')
    expect(csvFileName('lugares', d)).toBe('curacion-lugares-2026-10-20.csv')
  })
})

describe('noindex', () => {
  it('[AC-23] _headers marca /curacion/* con X-Robots-Tag noindex, nofollow', () => {
    const file = readFileSync(resolve(__dirname, '../../public/_headers'), 'utf8')
    expect(file).toMatch(/^\/curacion\/\*\s*\n\s+X-Robots-Tag:\s*noindex,\s*nofollow/m)
  })

  it('[AC-23] setRobotsMeta pone y quita <meta name="robots">', () => {
    setRobotsMeta(true)
    const meta = document.head.querySelector('meta[name="robots"]')
    expect(meta?.getAttribute('content')).toBe('noindex, nofollow')
    setRobotsMeta(true)
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
    setRobotsMeta(false)
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })
})
