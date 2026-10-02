import { env } from 'cloudflare:workers'
import type { IngestEvent, IngestPlace, SourceTier } from '@tript/shared'
import { createApp } from '../../index'

export const T0 = new Date('2026-10-06T21:00:00-03:00') // martes 21:00 hora local

export interface TestBatch {
  source?: { name: string; tier: SourceTier }
  events?: Array<Partial<IngestEvent> & Pick<IngestEvent, 'source_key'>>
  places?: Array<Partial<IngestPlace> & Pick<IngestPlace, 'source_key'>>
}

export const event = (o: Partial<IngestEvent> & Pick<IngestEvent, 'source_key'>): IngestEvent => ({
  title: `Evento ${o.source_key}`,
  intents: ['espectaculo'],
  start_date: '2026-10-06',
  end_date: '2026-10-06',
  start_time: '23:00',
  price_status: 'unknown',
  source_url: `https://fuente.test/${o.source_key}`,
  venue_name: 'Sala',
  ...o,
})

export const place = (o: Partial<IngestPlace> & Pick<IngestPlace, 'source_key'>): IngestPlace => ({
  name: `Lugar ${o.source_key}`,
  kind: 'bar',
  origin: 'curated',
  intents: ['tomar_algo'],
  lat: -32.94,
  lon: -60.65,
  ...o,
})

export const app = (now: Date = T0, db = env.DB) => ({
  app: createApp({ now: () => now }),
  env: { ...env, DB: db },
})

/** Ingesta un lote por la API real, con el reloj fijado en `now`. */
export async function ingest(batch: TestBatch, now: Date = T0, db = env.DB) {
  const { app: a, env: e } = app(now, db)
  const body = {
    source: batch.source ?? { name: 'Fuente de prueba', tier: 'curated' },
    generated_at: now.toISOString(),
    events: batch.events?.map((x) => event(x)),
    places: batch.places?.map((x) => place(x)),
  }
  const res = await a.request(
    '/api/ingest',
    {
      method: 'POST',
      headers: { authorization: 'Bearer test-ingest-token', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    e,
  )
  return { res, json: (await res.json()) as { success: boolean; data?: any; error?: string } }
}

/** Vacía el catálogo: el pool de Workers aísla por archivo de test, no por test. */
export async function truncateCatalog(db = env.DB) {
  await db.batch(
    ['places', 'place_keys', 'place_id_redirects', 'events', 'event_sources', 'event_id_redirects'].map(
      (t) => db.prepare(`DELETE FROM ${t}`),
    ),
  )
}
