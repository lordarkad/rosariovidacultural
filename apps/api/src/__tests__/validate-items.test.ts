import { describe, it, expect } from 'vitest'
import { validateBatchItems } from '../ingest/validate-items'

const evento = (o: Record<string, unknown> = {}) => ({
  source_key: 'f:1',
  title: 'Show',
  intents: ['espectaculo'],
  start_date: '2026-10-10',
  end_date: '2026-10-10',
  price_status: 'unknown',
  source_url: 'https://fuente.test/1',
  ...o,
})
const lugar = (o: Record<string, unknown> = {}) => ({
  source_key: 'osm:1',
  name: 'Bar',
  kind: 'bar',
  origin: 'osm',
  intents: ['tomar_algo'],
  lat: -32.94,
  lon: -60.65,
  ...o,
})

describe('validateBatchItems', () => {
  it('[AC-34] un evento con start_date mal formada se rechaza y el resto se guarda', () => {
    const r = validateBatchItems({
      events: [evento({ source_key: 'f:1' }), evento({ source_key: 'f:2', start_date: 'mañana' }), evento({ source_key: 'f:3' })],
    })
    expect(r.events.map((e) => e.index)).toEqual([0, 2])
    expect(r.rejected).toHaveLength(1)
    expect(r.rejected[0]).toMatchObject({ kind: 'event', index: 1, source_key: 'f:2' })
    expect(r.rejected[0]!.reason).toMatch(/^invalid_item/)
  })

  it('[AC-34] source_key repetido: se guarda el primero y el repetido es duplicate_source_key', () => {
    const r = validateBatchItems({ events: [evento(), evento({ title: 'Repetido' })] })
    expect(r.events).toHaveLength(1)
    expect(r.rejected).toEqual([
      { kind: 'event', index: 1, source_key: 'f:1', reason: 'duplicate_source_key' },
    ])
  })

  it('un primer ítem inválido no cuenta como primera aparición del source_key', () => {
    const r = validateBatchItems({ events: [evento({ title: '' }), evento()] })
    expect(r.events.map((e) => e.index)).toEqual([1])
    expect(r.rejected).toHaveLength(1)
  })

  it('[AC-34] end_date anterior a start_date: invalid_date_range', () => {
    const r = validateBatchItems({ events: [evento({ start_date: '2026-10-10', end_date: '2026-10-09' })] })
    expect(r.rejected).toEqual([{ kind: 'event', index: 0, source_key: 'f:1', reason: 'invalid_date_range' }])
  })

  it('[AC-34] lugar con opening_hours [] : invalid_opening_hours', () => {
    const r = validateBatchItems({ places: [lugar({ opening_hours: [] })] })
    expect(r.places).toHaveLength(0)
    expect(r.rejected).toEqual([{ kind: 'place', index: 0, source_key: 'osm:1', reason: 'invalid_opening_hours' }])
  })

  it('un período con hora mal formada también es invalid_opening_hours', () => {
    const r = validateBatchItems({
      places: [lugar({ opening_hours: [{ day: 9, opens: '25:00', closes: '10:00' }] })],
    })
    expect(r.rejected[0]!.reason).toBe('invalid_opening_hours')
  })

  it('source_key null cuando el ítem no trae clave utilizable', () => {
    const r = validateBatchItems({ events: [{ title: 'sin clave' }] })
    expect(r.rejected[0]).toMatchObject({ kind: 'event', index: 0, source_key: null })
  })

  it('separa eventos y lugares y conserva el índice original', () => {
    const r = validateBatchItems({
      events: [evento()],
      places: [lugar({ source_key: 'osm:9', name: '' }), lugar({ source_key: 'osm:2' })],
    })
    expect(r.events).toHaveLength(1)
    expect(r.places.map((p) => p.index)).toEqual([1])
    expect(r.rejected).toEqual([
      expect.objectContaining({ kind: 'place', index: 0, source_key: 'osm:9' }),
    ])
  })

  it('sin events ni places devuelve vacío', () => {
    expect(validateBatchItems({})).toEqual({ events: [], places: [], rejected: [] })
  })
})
