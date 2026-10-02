import { describe, it, expect } from 'vitest'
import {
  buildSearchResults,
  paginate,
  toSearchPin,
  type EventRow,
  type PlaceRow,
  type SearchParams,
} from '../domain/search-pipeline'
import { resolveWindow } from '../domain/windows'
import { SearchItemSchema } from '@tript/shared'

const d = (s: string) => new Date(s)
// 2026-10-06 es martes
const NOW = d('2026-10-06T20:30:00-03:00')
const todos = (opens: string, closes: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens, closes }))

let n = 0
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

const ev = (o: Partial<EventRow> = {}): EventRow => ({
  id: uuid(),
  title: 'Evento',
  title_norm: 'evento',
  intents: ['espectaculo'],
  music_genres: [],
  start_date: '2026-10-06',
  end_date: '2026-10-06',
  start_time: '23:00',
  venue_name: 'Sala',
  venue_norm: 'sala',
  address: 'San Martin 100',
  address_norm: 'san martin 100',
  lat: null,
  lon: null,
  price_status: 'unknown',
  price_from_ars: null,
  image_url: null,
  ...o,
})
const pl = (o: Partial<PlaceRow> = {}): PlaceRow => ({
  id: uuid(),
  name: 'Lugar',
  name_norm: 'lugar',
  kind: 'bar',
  intents: ['tomar_algo'],
  opening_hours: todos('12:00', '23:59'),
  address: 'Corrientes 50',
  address_norm: 'corrientes 50',
  lat: -32.94,
  lon: -60.65,
  image_url: null,
  ...o,
})

const params = (o: Partial<SearchParams> = {}): SearchParams => ({
  intents: [],
  musica: [],
  gratis: false,
  window: resolveWindow('hoy', undefined, NOW),
  origin: null,
  q: null,
  ...o,
})
const run = (events: EventRow[], places: PlaceRow[], p: SearchParams = params()) =>
  buildSearchResults({ events, places }, p, NOW)

describe('buildSearchResults', () => {
  describe('[AC-3] origen por coordenadas y distancias', () => {
    const origin = { lat: -32.94, lon: -60.65, radius_m: 1000 }
    it('solo entran ítems dentro del radio, con distance_m y walk_minutes = ceil(distance_m/80)', () => {
      const cerca = pl({ lat: -32.935, lon: -60.65 }) // ~556 m
      const lejos = pl({ lat: -32.92, lon: -60.65 }) // ~2,2 km
      const res = run([], [cerca, lejos], params({ origin }))
      expect(res.map((r) => r.id)).toEqual([cerca.id])
      const r = res[0]!
      expect(r.distance_m).toBeGreaterThan(500)
      expect(r.distance_m).toBeLessThanOrEqual(1000)
      expect(r.walk_minutes).toBe(Math.ceil(r.distance_m! / 80))
    })
  })

  describe('[AC-4] sin origen', () => {
    it('distance_m y walk_minutes son null; el lugar que abre 21:00 sale antes que el evento de 22:00', () => {
      const lugar = pl({ opening_hours: todos('21:00', '23:59'), name: 'Abre 21' })
      const evento = ev({ start_time: '22:00', title: 'Evento 22' })
      const res = run([evento], [lugar])
      expect(res.map((r) => r.id)).toEqual([lugar.id, evento.id])
      expect(res.every((r) => r.distance_m === null && r.walk_minutes === null)).toBe(true)
      expect(res.map((r) => r.band)).toEqual(['esta_noche', 'esta_noche'])
    })
  })

  describe('[AC-7] orden completo (F-10)', () => {
    const origin = { lat: -32.94, lon: -60.65, radius_m: 10000 }
    it('franja → coincidencias → distancia → hora → título normalizado → id', () => {
      // todos en esta_noche (23:00): 1 coincidencia a 2 km, 2 coincidencias a 3 km
      const uno = ev({ title: 'Uno', title_norm: 'uno', intents: ['comer'], lat: -32.922, lon: -60.65 })
      const dos = ev({
        title: 'Dos',
        title_norm: 'dos',
        intents: ['comer', 'bailar'],
        lat: -32.913,
        lon: -60.65,
      })
      // dos a igual distancia, distinta hora de inicio
      const tarde = ev({ title: 'A', title_norm: 'a', intents: ['comer'], start_time: '23:30', lat: -32.93, lon: -60.65 })
      const temprano = ev({ title: 'B', title_norm: 'b', intents: ['comer'], start_time: '22:30', lat: -32.93, lon: -60.65 })
      // dos con todo igual: desempata el id
      const idB = ev({ id: '00000000-0000-4000-8000-0000000000bb', intents: ['comer'], lat: -32.9, lon: -60.65 })
      const idA = ev({ id: '00000000-0000-4000-8000-0000000000aa', intents: ['comer'], lat: -32.9, lon: -60.65 })
      const manana_ev = ev({ title: 'Mañana', title_norm: 'manana', intents: ['comer'], start_date: '2026-10-07', end_date: '2026-10-07', lat: -32.94, lon: -60.65 })
      const res = run(
        [uno, manana_ev, idB, tarde, dos, temprano, idA],
        [],
        params({ intents: ['comer', 'bailar'], origin, window: resolveWindow('fecha', '2026-10-06', NOW) }),
      )
      // manana_ev no cae en la ventana `fecha=hoy`
      expect(res.map((r) => r.id)).toEqual([dos.id, temprano.id, tarde.id, uno.id, idA.id, idB.id])
    })

    it('la distancia se compara redondeada, como la ve el cliente: a igual distance_m decide la hora', () => {
      const origin2 = { lat: -32.94, lon: -60.65, radius_m: 10000 }
      // ~0,1 m más cerca en bruto, pero mismo distance_m: el de las 22:30 va primero
      const tarde = ev({ title: 'A', title_norm: 'a', intents: ['comer'], start_time: '23:30', lat: -32.930001, lon: -60.65 })
      const temprano = ev({ title: 'B', title_norm: 'b', intents: ['comer'], start_time: '22:30', lat: -32.93, lon: -60.65 })
      const res = run([tarde, temprano], [], params({ intents: ['comer'], origin: origin2 }))
      expect(res[0]!.distance_m).toBe(res[1]!.distance_m)
      expect(res.map((r) => r.id)).toEqual([temprano.id, tarde.id])
    })

    it('en_cartel ordena por start_time como hora del día y deja sin horario al final', () => {
      const a = ev({ title: 'a', title_norm: 'a', start_date: '2026-09-10', end_date: '2026-10-30', start_time: '22:00' })
      const b = ev({ title: 'b', title_norm: 'b', start_date: '2026-09-10', end_date: '2026-10-30', start_time: '10:00' })
      const c = ev({ title: 'c', title_norm: 'c', start_date: '2026-09-10', end_date: '2026-10-30', start_time: null })
      const res = run([a, c, b], [])
      expect(res.map((r) => r.id)).toEqual([b.id, a.id, c.id])
      expect(res.every((r) => r.band === 'en_cartel')).toBe(true)
    })

    it('las franjas salen en BAND_ORDER y paginar no repite ni saltea', () => {
      const items = [
        ev({ start_time: '21:00' }), // ahora
        ev({ start_time: '23:00' }), // esta_noche
        ev({ start_time: null }), // a_confirmar
        ev({ start_date: '2026-09-10', end_date: '2026-10-30' }), // en_cartel
      ]
      const res = run(items, [])
      expect(res.map((r) => r.band)).toEqual(['ahora', 'esta_noche', 'en_cartel', 'a_confirmar'])
      const p1 = paginate(res, 1, 3)
      const p2 = paginate(res, 2, 3)
      expect(p1.total).toBe(4)
      expect([...p1.items, ...p2.items].map((r) => r.id)).toEqual(res.map((r) => r.id))
    })
  })

  describe('[AC-14] sin ubicación (E-1)', () => {
    it('sin origen aparece con location_known false, al final de su franja y sin pin', () => {
      const sin = ev({ title: 'Sin ubicación', start_time: '23:00', lat: null, lon: null })
      const con = ev({ title: 'Con ubicación', start_time: '23:30', lat: -32.94, lon: -60.65 })
      const res = run([sin, con], [])
      expect(res.map((r) => r.id)).toEqual([con.id, sin.id])
      const s = res[1]!
      expect(s).toMatchObject({ location_known: false, distance_m: null, lat: null, lon: null })
      expect(toSearchPin(s)).toBeNull()
      expect(toSearchPin(res[0]!)).toMatchObject({ kind: 'event', id: con.id })
    })
    it('con origen no entra', () => {
      const sin = ev({ lat: null, lon: null })
      const res = run([sin], [], params({ origin: { lat: -32.94, lon: -60.65, radius_m: 5000 } }))
      expect(res).toEqual([])
    })
  })

  describe('[AC-15] precio (E-6)', () => {
    const free = ev({ price_status: 'free', title_norm: 'f' })
    const paid = ev({ price_status: 'paid', price_from_ars: 12000, title_norm: 'p' })
    const unk = ev({ price_status: 'unknown', title_norm: 'u' })
    it('devuelve los tres price_status tal cual', () => {
      const res = run([free, paid, unk], [pl()])
      const by = Object.fromEntries(res.map((r) => [r.id, r]))
      expect(by[free.id]!.price_status).toBe('free')
      expect(by[paid.id]).toMatchObject({ price_status: 'paid', price_from_ars: 12000 })
      expect(by[unk.id]!.price_status).toBe('unknown')
    })
    it('gratis=true trae solo free, nunca unknown ni lugares', () => {
      const res = run([free, paid, unk], [pl()], params({ gratis: true }))
      expect(res.map((r) => r.id)).toEqual([free.id])
    })
    it('los lugares siempre devuelven price_status unknown', () => {
      const res = run([], [pl()])
      expect(res[0]).toMatchObject({ price_status: 'unknown', price_from_ars: null })
    })
  })

  describe('[AC-16] intenciones y música (E-7, F-16)', () => {
    const cena = ev({ title_norm: 'cena', intents: ['comer'], music_genres: ['jazz'] })
    const rock = ev({ title_norm: 'rock', intents: ['musica_en_vivo'], music_genres: ['rock'] })
    const jazzVivo = ev({ title_norm: 'jazz vivo', intents: ['musica_en_vivo'], music_genres: ['jazz'] })
    const jazzBaile = ev({ title_norm: 'jazz baile', intents: ['bailar'], music_genres: ['jazz'] })
    const resto = pl({ intents: ['comer'], name_norm: 'resto' })

    it('i=comer,bailar es unión; los que cumplen ambas van antes', () => {
      const a = ev({ title_norm: 'a', intents: ['comer'] })
      const ab = ev({ title_norm: 'b', intents: ['comer', 'bailar'] })
      const x = ev({ title_norm: 'x', intents: ['espectaculo'] })
      const res = run([a, ab, x], [], params({ intents: ['comer', 'bailar'] }))
      expect(res.map((r) => r.id)).toEqual([ab.id, a.id])
    })

    it('musica sin musica_en_vivo en i se ignora', () => {
      const res = run([cena, rock], [], params({ intents: ['comer'], musica: ['jazz'] }))
      expect(res.map((r) => r.id)).toEqual([cena.id])
      const sinFiltro = run([cena, rock], [], params({ intents: [], musica: ['jazz'] }))
      expect(sinFiltro).toHaveLength(2)
    })

    it('i=comer,musica_en_vivo&musica=jazz: solo eventos de jazz que coinciden con alguna intención de i', () => {
      const res = run(
        [cena, rock, jazzVivo, jazzBaile],
        [resto],
        params({ intents: ['comer', 'musica_en_vivo'], musica: ['jazz'] }),
      )
      const ids = res.map((r) => r.id)
      expect(ids).toContain(cena.id) // basta el género (F-16)
      expect(ids).toContain(jazzVivo.id)
      expect(ids).not.toContain(resto.id) // lugares fuera
      expect(ids).not.toContain(rock.id) // otro género
      expect(ids).not.toContain(jazzBaile.id) // jazz pero sin intención de i
    })

    it('el género no cuenta como coincidencia de intención para el orden', () => {
      // cena: 1 coincidencia (comer). jazzComerVivo: 2 coincidencias (comer + musica_en_vivo)
      const cenaShow = ev({ title_norm: 'a cena', intents: ['comer'], music_genres: ['jazz'] })
      const doble = ev({ title_norm: 'z doble', intents: ['comer', 'musica_en_vivo'], music_genres: ['jazz'] })
      const res = run(
        [cenaShow, doble],
        [],
        params({ intents: ['comer', 'musica_en_vivo'], musica: ['jazz'] }),
      )
      expect(res.map((r) => r.id)).toEqual([doble.id, cenaShow.id])
    })

    it('i=musica_en_vivo&musica=jazz: la cena-show [jazz]/[comer] queda fuera', () => {
      const res = run(
        [cena, jazzVivo],
        [],
        params({ intents: ['musica_en_vivo'], musica: ['jazz'] }),
      )
      expect(res.map((r) => r.id)).toEqual([jazzVivo.id])
    })
  })

  describe('[AC-20] texto libre', () => {
    it('q sin distinguir mayúsculas ni tildes sobre título, sede y dirección', () => {
      const t = ev({ title: 'Teatro', title_norm: 'teatro' })
      const s = ev({ title_norm: 'otro', venue_norm: 'teatro el circulo' })
      const a = ev({ title_norm: 'otro 2', address_norm: 'calle del teatro 1' })
      const no = ev({ title_norm: 'recital' })
      const lugar = pl({ name_norm: 'bar teatro' })
      const res = run([t, s, a, no], [lugar], params({ q: 'teatro' }))
      expect(new Set(res.map((r) => r.id))).toEqual(new Set([t.id, s.id, a.id, lugar.id]))
    })
  })

  it('cada ítem cumple SearchItemSchema (todas las claves siempre presentes)', () => {
    const res = run([ev({ lat: -32.94, lon: -60.65, price_status: 'paid', price_from_ars: 5000 })], [pl()])
    for (const r of res) expect(SearchItemSchema.safeParse(r).success, JSON.stringify(r)).toBe(true)
  })
})
