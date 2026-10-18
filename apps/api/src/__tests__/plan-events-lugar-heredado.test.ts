import { describe, it, expect } from 'vitest'
import type { IngestEvent, IngestPlace } from '@tript/shared'
import { planEvents } from '../ingest/plan-events'
import { planPlaces } from '../ingest/plan-places'
import type { BatchSource } from '../ingest/types'
import { FakeCatalog } from './helpers/fake-catalog'

let ids = 0
const newId = () => `id-${++ids}`
let clock = 0
const nextNow = () => `2026-10-06T00:00:${String(++clock).padStart(2, '0')}.000Z`

const CURADO: BatchSource = { name: 'Curado', tier: 'curated' }
const OFICIAL: BatchSource = { name: 'Municipalidad', tier: 'official' }
const AGREGADOR: BatchSource = { name: 'Agregador', tier: 'aggregator' }

function ev(o: Partial<IngestEvent> & Pick<IngestEvent, 'source_key'>): IngestEvent {
  return {
    title: 'Show de Jazz',
    intents: ['espectaculo'],
    start_date: '2026-10-10',
    end_date: '2026-10-10',
    start_time: '21:00',
    price_status: 'unknown',
    source_url: `https://fuente.test/${o.source_key}`,
    venue_name: 'Sala Uno',
    ...o,
  }
}
function pl(o: Partial<IngestPlace> & Pick<IngestPlace, 'source_key'>): IngestPlace {
  return {
    name: 'Sala Uno',
    kind: 'sala',
    origin: 'curated',
    intents: ['espectaculo'],
    lat: -32.94,
    lon: -60.65,
    ...o,
  }
}

/** Un lote completo contra el catálogo, con la lectura en dos fases de run-ingest (incluye las claves de las fuentes). */
function batch(cat: FakeCatalog, source: BatchSource, events: IngestEvent[], places: IngestPlace[] = []) {
  const now = nextNow()
  const estate = cat.eventState(events)
  const extra = [
    ...events.map((e) => e.place_source_key),
    ...estate.candidates.map((c) => c.fields.place_source_key),
    ...estate.candidates.flatMap((c) => c.sources.map((s) => s.place_source_key)),
  ].filter((k): k is string => !!k)
  const pplan = planPlaces(places, cat.placeState(places, extra), { now, newId })
  cat.applyPlaces(pplan, now)
  const plan = planEvents(events, source, estate, pplan.resolve, { now, newId })
  cat.applyEvents(plan, now)
  return plan
}

describe('[AC-40] lugar heredado de un alias (E-10, F-18)', () => {
  const P1 = pl({ source_key: 'casa:p1', name: 'La Casa del Tango' })
  const P2 = pl({ source_key: 'casa:p2', name: 'Otra Sala', lat: -32.95 })
  const seeded = () => {
    const cat = new FakeCatalog()
    batch(cat, CURADO, [], [P1, P2])
    return cat
  }
  const rowOf = (cat: FakeCatalog, key: string) => cat.events.get(cat.eventIdOf(key)!)!

  it('[AC-40] caso A: la canónica sin lugar hereda el del alias, y al reenviarlo no cambia nada más', () => {
    const cat = seeded()
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a' })])
    const id = cat.eventIdOf('ofi:a')!
    const plan = batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    expect(plan).toMatchObject({ created: 0, updated: 1 })
    expect(rowOf(cat, 'ofi:a')).toMatchObject({ canonical: 'ofi:a', id })
    expect(rowOf(cat, 'ofi:a').fields.place_source_key).toBe('casa:p1')
    const again = batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    expect(again).toMatchObject({ created: 0, updated: 1 })
    expect(cat.events.size).toBe(1)
    expect(rowOf(cat, 'ofi:a').fields.place_source_key).toBe('casa:p1')
    expect(cat.eventIdOf('ofi:a')).toBe(id)
  })

  it('[AC-40] caso A (variante): primero el alias con lugar y después la canónica sin lugar', () => {
    const cat = seeded()
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    const id = cat.eventIdOf('agg:a')!
    const plan = batch(cat, OFICIAL, [ev({ source_key: 'ofi:a' })])
    expect(plan).toMatchObject({ created: 0, updated: 1 })
    expect(cat.events.size).toBe(1)
    expect(rowOf(cat, 'agg:a')).toMatchObject({ canonical: 'ofi:a', id })
    expect(rowOf(cat, 'agg:a').fields.place_source_key).toBe('casa:p1')
  })

  it('[AC-40] caso B: gana la canónica, también si su lugar todavía no está cargado', () => {
    const cat = seeded()
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a', place_source_key: 'casa:p2' })])
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    expect(rowOf(cat, 'ofi:a').fields.place_source_key).toBe('casa:p2')

    const sin = new FakeCatalog() // casa:p2 no existe: no se usa casa:p1 mientras tanto
    batch(sin, CURADO, [], [P1])
    batch(sin, OFICIAL, [ev({ source_key: 'ofi:a', place_source_key: 'casa:p2' })])
    batch(sin, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    expect(rowOf(sin, 'ofi:a').fields.place_source_key).toBe('casa:p2')
  })

  it('[AC-40] caso C: fila ya fusionada sin lugar (previa a F-18) completa el lugar al reenviar el alias', () => {
    const cat = seeded()
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a', description: 'oficial' })])
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a' })])
    const id = cat.eventIdOf('ofi:a')!
    const plan = batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    expect(plan).toMatchObject({ created: 0, updated: 1 })
    const row = rowOf(cat, 'ofi:a')
    expect(row.id).toBe(id)
    expect(row.fields.place_source_key).toBe('casa:p1')
    expect(row.fields.description).toBe('oficial')
  })

  it('[AC-40] caso D: la canónica que reenvía con otro lugar lo pisa, y sin lugar vuelve a heredar', () => {
    const cat = seeded()
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a' })])
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a', place_source_key: 'casa:p2' })])
    expect(rowOf(cat, 'ofi:a').fields.place_source_key).toBe('casa:p2')
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a' })])
    expect(rowOf(cat, 'ofi:a').fields.place_source_key).toBe('casa:p1')
  })

  it('[AC-40] caso E: el alias que deja de aportar deja la fila sin lugar, salvo que otro alias lo traiga', () => {
    const cat = seeded()
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a' })])
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a' })])
    expect(rowOf(cat, 'ofi:a').fields.place_source_key).toBeNull()
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:b', place_source_key: 'casa:p2' })])
    expect(rowOf(cat, 'ofi:a').fields.place_source_key).toBe('casa:p2')
  })

  it('[AC-40] caso F: entre varios alias gana el de mayor tier, no el que llegó antes', () => {
    const cat = seeded()
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p2' })])
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a', place_source_key: 'casa:p1' })])
    batch(cat, CURADO, [ev({ source_key: 'cur:a' })])
    expect(rowOf(cat, 'cur:a').canonical).toBe('cur:a')
    expect(rowOf(cat, 'cur:a').fields.place_source_key).toBe('casa:p1')
  })

  it('[AC-40] caso F (igual tier): gana el que llegó primero, también si venían de filas absorbidas', () => {
    const cat = seeded()
    batch(cat, AGREGADOR, [ev({ source_key: 's:1', venue_name: 'Sala A', address: null, place_source_key: 'casa:p2' })])
    batch(cat, AGREGADOR, [ev({ source_key: 's:2', venue_name: 'Sala B', address: 'Calle 1 200', place_source_key: 'casa:p1' })])
    expect(cat.events.size).toBe(2)
    batch(cat, CURADO, [ev({ source_key: 'cur:3', venue_name: 'Sala A', address: 'Calle 1 200' })])
    expect(cat.events.size).toBe(1)
    expect(rowOf(cat, 'cur:3').fields.place_source_key).toBe('casa:p2')
  })

  it('[AC-40] caso F (reenvío): si el alias ganador reenvía sin lugar, la fila pasa al siguiente alias', () => {
    const cat = seeded()
    batch(cat, AGREGADOR, [ev({ source_key: 's:1', place_source_key: 'casa:p2' })])
    batch(cat, AGREGADOR, [ev({ source_key: 's:2', place_source_key: 'casa:p1' })])
    batch(cat, CURADO, [ev({ source_key: 'cur:3' })])
    expect(rowOf(cat, 'cur:3').fields.place_source_key).toBe('casa:p2')
    batch(cat, AGREGADOR, [ev({ source_key: 's:1' })])
    expect(rowOf(cat, 'cur:3').fields.place_source_key).toBe('casa:p1')
  })

  it('[AC-40] caso G: al promoverse otra canónica sin lugar, el alias sigue aportándolo', () => {
    const cat = seeded()
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a' })])
    expect(rowOf(cat, 'agg:a')).toMatchObject({ canonical: 'ofi:a' })
    expect(rowOf(cat, 'agg:a').fields.place_source_key).toBe('casa:p1')
    batch(cat, CURADO, [ev({ source_key: 'cur:a', place_source_key: 'casa:p2' })])
    expect(rowOf(cat, 'agg:a').fields.place_source_key).toBe('casa:p2')
  })

  it('[AC-40] caso H: la herencia no fusiona filas que ya estaban separadas', () => {
    const cat = seeded()
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:c', venue_name: 'Sala A', place_source_key: 'casa:p1' })])
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:b', venue_name: 'Sala B' })])
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:b', venue_name: 'Sala B' })])
    expect(cat.events.size).toBe(2)
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:b', venue_name: 'Sala B', place_source_key: 'casa:p1' })])
    expect(cat.events.size).toBe(2)
    expect(rowOf(cat, 'ofi:b').fields.place_source_key).toBe('casa:p1')
  })

  it('[AC-40] caso I: la clave heredada cuenta como sede para un ítem nuevo del mismo lote', () => {
    const cat = seeded()
    batch(cat, OFICIAL, [ev({ source_key: 'ofi:a', place_source_key: 'casa:p2' })])
    batch(cat, AGREGADOR, [ev({ source_key: 'agg:a', place_source_key: 'casa:p1' })])
    // ofi:a reenviado sin lugar hereda casa:p1; ofi:b (sede = nombre de ese lugar) debe fusionarse con la fila
    const plan = batch(cat, OFICIAL, [
      ev({ source_key: 'ofi:a' }),
      ev({ source_key: 'ofi:b', venue_name: 'La Casa del Tango' }),
    ])
    expect(plan.created).toBe(0)
    expect(cat.events.size).toBe(1)
    expect(cat.eventIdOf('ofi:b')).toBe(cat.eventIdOf('ofi:a'))
  })
})
