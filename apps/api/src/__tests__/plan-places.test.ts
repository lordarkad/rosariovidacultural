import { describe, it, expect } from 'vitest'
import type { IngestPlace } from '@tript/shared'
import { planPlaces } from '../ingest/plan-places'
import { FakeCatalog } from './helpers/fake-catalog'

// ~0,00009° de latitud ≈ 10 m
const LAT = -32.94
const LON = -60.65
const m = (meters: number) => (meters / 10) * 0.00009

let ids = 0
const newId = () => `id-${++ids}`
let clock = 0
const nextNow = () => `2026-10-06T00:00:${String(++clock).padStart(2, '0')}.000Z`

function place(o: Partial<IngestPlace> & Pick<IngestPlace, 'source_key' | 'origin'>): IngestPlace {
  return { name: 'La Esquina', kind: 'bar', intents: ['tomar_algo'], lat: LAT, lon: LON, ...o }
}

/** Un lote contra el catálogo: planifica, aplica y devuelve el plan. */
function ingest(cat: FakeCatalog, items: IngestPlace[]) {
  const now = nextNow()
  const plan = planPlaces(items, cat.placeState(items), { now, newId })
  cat.applyPlaces(plan, now)
  return plan
}

describe('planPlaces', () => {
  it('lugar nuevo: se crea con id y la clave queda registrada', () => {
    const cat = new FakeCatalog()
    const plan = ingest(cat, [place({ source_key: 'curado:1', origin: 'curated' })])
    expect(plan).toMatchObject({ created: 1, updated: 0 })
    expect(cat.places.size).toBe(1)
    expect(cat.placeIdOf('curado:1')).toBeDefined()
  })

  it('[AC-30] reenviar el mismo lote: created 0, updated igual al total, sin duplicados', () => {
    const cat = new FakeCatalog()
    const items = [
      place({ source_key: 'osm:1', origin: 'osm', name: 'Uno' }),
      place({ source_key: 'curado:2', origin: 'curated', name: 'Dos', lat: LAT + 1 }),
    ]
    ingest(cat, items)
    const again = ingest(cat, items)
    expect(again).toMatchObject({ created: 0, updated: 2 })
    expect(cat.places.size).toBe(2)
  })

  describe('[AC-38] duplicados de lugares', () => {
    it('Caso A: osm → curado a 30 m: el curado absorbe, conserva el id, reemplaza campos y no hereda del osm', () => {
      const cat = new FakeCatalog()
      ingest(cat, [
        place({
          source_key: 'osm:a1',
          origin: 'osm',
          opening_hours: [{ day: 0, opens: '10:00', closes: '20:00' }],
          website: 'https://osm.example/',
        }),
      ])
      const osmId = cat.placeIdOf('osm:a1')!
      const plan = ingest(cat, [
        place({ source_key: 'curado:a', origin: 'curated', lat: LAT + m(30), phone: '111' }),
      ])
      expect(plan).toMatchObject({ created: 0, updated: 1 })
      expect(cat.places.size).toBe(1)
      const row = cat.places.get(osmId)!
      expect(row.source_key).toBe('curado:a')
      expect(row.fields).toMatchObject({
        origin: 'curated',
        phone: '111',
        opening_hours: null,
        website: null,
      })
      expect(cat.placeIdOf('osm:a1')).toBe(osmId)
      expect(cat.placeIdOf('curado:a')).toBe(osmId)
      // el curado reenvía con un campo cambiado: se aplica a la fila sobreviviente
      ingest(cat, [place({ source_key: 'curado:a', origin: 'curated', lat: LAT + m(30), phone: '222' })])
      expect(cat.places.get(osmId)!.fields.phone).toBe('222')
    })

    it('Caso A: curado → osm: el osm pasa a alias y no pisa nada', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'curado:a', origin: 'curated', phone: '111' })])
      const id = cat.placeIdOf('curado:a')!
      const plan = ingest(cat, [
        place({ source_key: 'osm:a1', origin: 'osm', lat: LAT + m(30), phone: '999' }),
      ])
      expect(plan).toMatchObject({ created: 0, updated: 1 })
      expect(cat.places.size).toBe(1)
      expect(cat.places.get(id)!.fields.phone).toBe('111')
      expect(cat.placeIdOf('osm:a1')).toBe(id)
    })

    it('Caso B: un osm a 200 m queda como lugar aparte', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'curado:a', origin: 'curated' })])
      ingest(cat, [place({ source_key: 'osm:b1', origin: 'osm', lat: LAT + m(200) })])
      expect(cat.places.size).toBe(2)
    })

    it('Caso C: curado llega con dos osm de lotes distintos: se fusionan los tres en el osm insertado primero', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'osm:n1', origin: 'osm', lat: LAT + m(20) })])
      ingest(cat, [place({ source_key: 'osm:w1', origin: 'osm', lat: LAT + m(20) })])
      const n1 = cat.placeIdOf('osm:n1')!
      const w1 = cat.placeIdOf('osm:w1')!
      expect(cat.places.size).toBe(2)
      const plan = ingest(cat, [place({ source_key: 'curado:c', origin: 'curated', phone: '5' })])
      expect(plan).toMatchObject({ created: 0, updated: 1 })
      expect(cat.places.size).toBe(1)
      const row = cat.places.get(n1)!
      expect(row.source_key).toBe('curado:c')
      expect(row.fields.origin).toBe('curated')
      expect(cat.placeIdOf('osm:w1')).toBe(n1)
      expect(cat.placeRedirects.get(w1)).toBe(n1) // /l/<w1> no da 404
    })

    it('Caso D: curado existente y osm:n2 + osm:w2 juntos: ambos pasan a alias (updated 2)', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'curado:d', origin: 'curated' })])
      const plan = ingest(cat, [
        place({ source_key: 'osm:n2', origin: 'osm', lat: LAT + m(30) }),
        place({ source_key: 'osm:w2', origin: 'osm', lat: LAT + m(30) }),
      ])
      expect(plan).toMatchObject({ created: 0, updated: 2 })
      expect(cat.places.size).toBe(1)
      expect(cat.placeIdOf('osm:n2')).toBe(cat.placeIdOf('curado:d'))
    })

    it('Caso E: el dedupe solo corre con un source_key nuevo: reenviar con el nombre del osm no fusiona', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'curado:e', origin: 'curated', name: 'Alfa' })])
      ingest(cat, [place({ source_key: 'osm:x1', origin: 'osm', name: 'Beta', lat: LAT + m(40) })])
      expect(cat.places.size).toBe(2)
      ingest(cat, [place({ source_key: 'curado:e', origin: 'curated', name: 'Beta' })])
      expect(cat.places.size).toBe(2)
    })

    it('Caso E: un reenvío del curado con lat/lon a 50 m o menos de otro osm tampoco fusiona', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'curado:a', origin: 'curated' })])
      ingest(cat, [place({ source_key: 'osm:b1', origin: 'osm', lat: LAT + m(200) })])
      ingest(cat, [place({ source_key: 'curado:a', origin: 'curated', lat: LAT + m(160) })])
      expect(cat.places.size).toBe(2)
    })

    it('Caso F: dos curados nunca se fusionan; el osm nuevo es alias del curado insertado primero', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'curado:f1', origin: 'curated', lat: LAT })])
      ingest(cat, [place({ source_key: 'curado:f2', origin: 'curated', lat: LAT + m(10) })])
      expect(cat.places.size).toBe(2)
      const plan = ingest(cat, [place({ source_key: 'osm:f1', origin: 'osm', lat: LAT + m(20) })])
      expect(plan).toMatchObject({ created: 0, updated: 1 })
      expect(cat.places.size).toBe(2)
      expect(cat.placeIdOf('osm:f1')).toBe(cat.placeIdOf('curado:f1'))
      expect(cat.placeIdOf('osm:f1')).not.toBe(cat.placeIdOf('curado:f2'))
    })

    it('Caso G: sin curado no hay dedupe entre osm (mismo lote y lotes distintos)', () => {
      const same = new FakeCatalog()
      ingest(same, [
        place({ source_key: 'osm:g1', origin: 'osm' }),
        place({ source_key: 'osm:g2', origin: 'osm', lat: LAT + m(20) }),
      ])
      expect(same.places.size).toBe(2)
      const split = new FakeCatalog()
      ingest(split, [place({ source_key: 'osm:g1', origin: 'osm' })])
      ingest(split, [place({ source_key: 'osm:g2', origin: 'osm', lat: LAT + m(20) })])
      expect(split.places.size).toBe(2)
    })

    it('Caso H: reenviar el source_key absorbido solo actualiza last_seen_at', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'osm:a1', origin: 'osm', phone: '1' })])
      ingest(cat, [place({ source_key: 'curado:a', origin: 'curated', phone: '2', lat: LAT + m(30) })])
      const id = cat.placeIdOf('curado:a')!
      const before = { ...cat.places.get(id)!.fields }
      const plan = ingest(cat, [
        place({ source_key: 'osm:a1', origin: 'osm', name: 'Otro Nombre', phone: '3' }),
      ])
      expect(plan).toMatchObject({ created: 0, updated: 1 })
      expect(cat.places.size).toBe(1)
      expect(cat.places.get(id)!.fields).toEqual(before)
      expect(cat.places.get(id)!.last_seen_at).toBe(`2026-10-06T00:00:${String(clock).padStart(2, '0')}.000Z`)
    })

    it('mismo lote: curado después del osm del mismo lote cuenta como fila existente', () => {
      const cat = new FakeCatalog()
      const plan = ingest(cat, [
        place({ source_key: 'osm:z1', origin: 'osm' }),
        place({ source_key: 'curado:z', origin: 'curated', lat: LAT + m(30) }),
      ])
      expect(plan).toMatchObject({ created: 1, updated: 1 })
      expect(cat.places.size).toBe(1)
      expect([...cat.places.values()][0]!.source_key).toBe('curado:z')
    })
  })

  describe('[AC-39] resolución de claves para eventos del lote', () => {
    it('resolve devuelve el lugar vigente de una clave, incluida una absorbida', () => {
      const cat = new FakeCatalog()
      ingest(cat, [place({ source_key: 'osm:a1', origin: 'osm', name: 'La Esquina' })])
      const now = nextNow()
      const items = [place({ source_key: 'curado:a', origin: 'curated', lat: LAT + m(30) })]
      const plan = planPlaces(items, cat.placeState(items, ['osm:a1']), { now, newId })
      const viaOsm = plan.resolve('osm:a1')
      const viaCurado = plan.resolve('curado:a')
      expect(viaOsm).toEqual(viaCurado)
      expect(viaCurado?.name_norm).toBe('la esquina')
      expect(plan.resolve('nunca:visto')).toBeNull()
    })
  })
})
