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

/** Un lote completo contra el catálogo: lugares primero, después eventos (F-12). */
function batch(
  cat: FakeCatalog,
  source: BatchSource,
  events: IngestEvent[],
  places: IngestPlace[] = [],
) {
  const now = nextNow()
  // Lectura en dos fases (igual que run-ingest): primero los eventos y sus candidatos, después los
  // lugares de todas las claves que haga falta resolver, incluidas las de los candidatos.
  const estate = cat.eventState(events)
  const extra = [
    ...events.map((e) => e.place_source_key),
    ...estate.candidates.map((c) => c.fields.place_source_key),
  ].filter((k): k is string => !!k)
  const pplan = planPlaces(places, cat.placeState(places, extra), { now, newId })
  cat.applyPlaces(pplan, now)
  const plan = planEvents(events, source, estate, pplan.resolve, { now, newId })
  cat.applyEvents(plan, now)
  return plan
}

describe('planEvents', () => {
  it('evento nuevo: se crea con su fuente primaria y starts_at_utc', () => {
    const cat = new FakeCatalog()
    const plan = batch(cat, AGREGADOR, [ev({ source_key: 'agg:1' })])
    expect(plan).toMatchObject({ created: 1, updated: 0 })
    const id = cat.eventIdOf('agg:1')!
    const row = cat.events.get(id)!
    expect(row.canonical).toBe('agg:1')
    expect(row.fields.starts_at_utc).toBe('2026-10-11T00:00:00.000Z')
    expect(cat.eventSources.get('agg:1')).toMatchObject({ name: 'Agregador', tier: 'aggregator' })
  })

  it('[AC-9] 00:30 locales de D+1 se guardan como 03:30Z', () => {
    const cat = new FakeCatalog()
    batch(cat, CURADO, [ev({ source_key: 'c:1', start_date: '2026-10-07', end_date: '2026-10-07', start_time: '00:30' })])
    expect([...cat.events.values()][0]!.fields.starts_at_utc).toBe('2026-10-07T03:30:00.000Z')
  })

  it('sin start_time no hay instante', () => {
    const cat = new FakeCatalog()
    batch(cat, CURADO, [ev({ source_key: 'c:1', start_time: null })])
    expect([...cat.events.values()][0]!.fields.starts_at_utc).toBeNull()
  })

  it('un evento con solo lat o solo lon se guarda sin coordenadas', () => {
    const cat = new FakeCatalog()
    batch(cat, CURADO, [ev({ source_key: 'c:1', lat: -32.9, lon: null })])
    expect([...cat.events.values()][0]!.fields).toMatchObject({ lat: null, lon: null })
  })

  it('[AC-30] reenviar el mismo lote: created 0, updated igual al total', () => {
    const cat = new FakeCatalog()
    const items = [ev({ source_key: 'a:1' }), ev({ source_key: 'a:2', title: 'Otro', venue_name: 'Otra sede' })]
    batch(cat, AGREGADOR, items)
    const again = batch(cat, AGREGADOR, items)
    expect(again).toMatchObject({ created: 0, updated: 2 })
    expect(cat.events.size).toBe(2)
  })

  describe('[AC-36] duplicados de eventos (E-10, F-11)', () => {
    it('agregador y curado con misma sede: queda una fila, el curado es la primaria y el id original sobrevive', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1', description: 'del agregador' })])
      const id = cat.eventIdOf('agg:1')!
      const plan = batch(cat, CURADO, [ev({ source_key: 'cur:1', description: 'del curado' })])
      expect(plan).toMatchObject({ created: 0, updated: 1 })
      expect(cat.events.size).toBe(1)
      const row = cat.events.get(id)!
      expect(row.canonical).toBe('cur:1')
      expect(row.fields.description).toBe('del curado')
      expect(cat.eventIdOf('cur:1')).toBe(id)
      expect(cat.eventIdOf('agg:1')).toBe(id)
    })

    it('el agregador reenvía su source_key: la fila primaria no cambia y no hay evento nuevo', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1' })])
      batch(cat, CURADO, [ev({ source_key: 'cur:1', description: 'del curado' })])
      const id = cat.eventIdOf('cur:1')!
      const before = { ...cat.events.get(id)!.fields }
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1', description: 'cambió el agregador', start_time: '23:00' })])
      expect(cat.events.size).toBe(1)
      expect(cat.events.get(id)!.fields).toEqual(before)
    })

    it('el curado reenvía con start_time cambiado: se aplica (es la clave canónica)', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1' })])
      batch(cat, CURADO, [ev({ source_key: 'cur:1' })])
      batch(cat, CURADO, [ev({ source_key: 'cur:1', start_time: '22:30' })])
      const row = cat.events.get(cat.eventIdOf('cur:1')!)!
      expect(row.fields.start_time).toBe('22:30')
    })

    it('si llega después una fuente de mayor tier, pasa a ser la canónica', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1' })])
      batch(cat, OFICIAL, [ev({ source_key: 'ofi:1' })])
      expect(cat.events.get(cat.eventIdOf('agg:1')!)!.canonical).toBe('ofi:1')
      batch(cat, CURADO, [ev({ source_key: 'cur:1' })])
      expect(cat.events.get(cat.eventIdOf('agg:1')!)!.canonical).toBe('cur:1')
      expect(cat.events.size).toBe(1)
    })

    it('a igual tier queda primaria la que llegó primero', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1', description: 'primero' })])
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:2', description: 'segundo' })])
      const row = cat.events.get(cat.eventIdOf('agg:1')!)!
      expect(row.canonical).toBe('agg:1')
      expect(row.fields.description).toBe('primero')
      expect(cat.eventIdOf('agg:2')).toBe(cat.eventIdOf('agg:1'))
    })

    it('dos eventos del mismo lote, distinto source_key y misma sede: una fila (created 1, updated 1)', () => {
      const cat = new FakeCatalog()
      const plan = batch(cat, AGREGADOR, [ev({ source_key: 'agg:1' }), ev({ source_key: 'agg:2' })])
      expect(plan).toMatchObject({ created: 1, updated: 1 })
      expect(cat.events.size).toBe(1)
    })

    it('un evento nuevo que coincide con dos existentes (por venue_name y por address) los fusiona en el insertado primero', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 's:1', venue_name: 'Sala A', address: null })])
      batch(cat, AGREGADOR, [ev({ source_key: 's:2', venue_name: 'Sala B', address: 'Calle 1 200' })])
      expect(cat.events.size).toBe(2)
      const e1 = cat.eventIdOf('s:1')!
      const e2 = cat.eventIdOf('s:2')!
      const plan = batch(cat, AGREGADOR, [ev({ source_key: 's:3', venue_name: 'Sala A', address: 'Calle 1 200' })])
      expect(plan).toMatchObject({ created: 0, updated: 1 })
      expect(cat.events.size).toBe(1)
      expect(cat.eventIdOf('s:3')).toBe(e1)
      expect(cat.eventIdOf('s:2')).toBe(e1)
      expect(cat.eventRedirects.get(e2)).toBe(e1)
    })

    it('se fusionan si una trae el lugar resuelto y la otra solo venue_name igual al nombre de ese lugar', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1', venue_name: 'Sala Uno' })])
      batch(
        cat,
        CURADO,
        [ev({ source_key: 'cur:1', venue_name: null, address: null, place_source_key: 'lug:1' })],
        [pl({ source_key: 'lug:1', name: 'Sala Uno' })],
      )
      expect(cat.events.size).toBe(1)
    })

    it('se fusionan con el mismo lugar resuelto aunque venue_name difiera', () => {
      const cat = new FakeCatalog()
      const lugar = [pl({ source_key: 'lug:1', name: 'Teatro Mayor' })]
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1', venue_name: 'El Mayor', place_source_key: 'lug:1' })], lugar)
      batch(cat, CURADO, [ev({ source_key: 'cur:1', venue_name: 'Teatro', place_source_key: 'lug:1' })], lugar)
      expect(cat.events.size).toBe(1)
    })
  })

  describe('[AC-37] no fusionar sedes distintas (E-2)', () => {
    it('mismo título, fecha y source_url, sin lugar y con distinto venue_name: dos eventos', () => {
      const cat = new FakeCatalog()
      const url = 'https://fuente.test/show'
      const plan = batch(cat, AGREGADOR, [
        ev({ source_key: 'a:1', venue_name: 'Sede 1', source_url: url }),
        ev({ source_key: 'a:2', venue_name: 'Sede 2', source_url: url }),
      ])
      expect(plan).toMatchObject({ created: 2, updated: 0 })
      expect(cat.events.size).toBe(2)
    })

    it('sin lugar, sin venue_name y sin address no se deduplica', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [
        ev({ source_key: 'a:1', venue_name: null, address: null }),
        ev({ source_key: 'a:2', venue_name: null, address: null }),
      ])
      expect(cat.events.size).toBe(2)
    })

    it('dos películas distintas de la misma sede con el mismo source_url genérico no se fusionan', () => {
      const cat = new FakeCatalog()
      const url = 'https://cine.test/cartelera'
      batch(cat, AGREGADOR, [
        ev({ source_key: 'c:1', title: 'Película A', source_url: url }),
        ev({ source_key: 'c:2', title: 'Película B', source_url: url }),
      ])
      expect(cat.events.size).toBe(2)
    })
  })

  describe('[AC-39] vínculo evento-lugar (F-12)', () => {
    it('el evento guarda place_source_key aunque el lugar todavía no exista', () => {
      const cat = new FakeCatalog()
      batch(cat, CURADO, [ev({ source_key: 'c:1', place_source_key: 'osm:futuro' })])
      expect([...cat.events.values()][0]!.fields.place_source_key).toBe('osm:futuro')
    })

    it('alias de lugar absorbido: dos eventos con la misma sede resuelta por claves distintas se fusionan', () => {
      const cat = new FakeCatalog()
      batch(cat, AGREGADOR, [ev({ source_key: 'agg:1', venue_name: null, place_source_key: 'osm:a1' })], [
        pl({ source_key: 'osm:a1', origin: 'osm', name: 'Sala Uno' }),
      ])
      batch(cat, CURADO, [ev({ source_key: 'cur:1', venue_name: null, place_source_key: 'lug:cur' })], [
        pl({ source_key: 'lug:cur', origin: 'curated', name: 'Sala Uno' }),
      ])
      expect(cat.events.size).toBe(1)
    })
  })
})
