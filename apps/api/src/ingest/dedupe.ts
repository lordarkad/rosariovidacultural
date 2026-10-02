import type { SourceTier } from '@tript/shared'
import type { EventFields, ResolvedPlace, SourceEntry } from './types'

/** Prioridad de fuente (E-10): curado a mano > fuente oficial > agregador. */
export const TIER_RANK: Record<SourceTier, number> = { curated: 3, official: 2, aggregator: 1 }

/** Clave de la fuente primaria: mayor `tier`; a igual `tier`, la primera en llegar. */
export function pickPrimarySource(sources: SourceEntry[]): string {
  let best = sources[0]!
  for (const s of sources) {
    const better =
      TIER_RANK[s.tier] > TIER_RANK[best.tier] ||
      (TIER_RANK[s.tier] === TIER_RANK[best.tier] && s.arrival < best.arrival)
    if (better) best = s
  }
  return best.source_key
}

interface Sede {
  placeId: string | null
  placeName: string | null
  venue: string | null
  address: string | null
}

export function sedeOf(
  f: Pick<EventFields, 'place_source_key' | 'venue_norm' | 'address_norm'>,
  resolve: (key: string) => ResolvedPlace | null,
): Sede {
  const place = f.place_source_key ? resolve(f.place_source_key) : null
  return {
    placeId: place?.id ?? null,
    placeName: place?.name_norm ?? null,
    venue: f.venue_norm || null,
    address: f.address_norm || null,
  }
}

/**
 * Misma sede (F-11): el mismo lugar resuelto, o el `venue_name` normalizado de uno igual al `venue_name`
 * o al nombre del lugar resuelto del otro, o la misma dirección normalizada. Sin sede en ninguno, no.
 */
export function isSameSede(a: Sede, b: Sede): boolean {
  if (a.placeId && a.placeId === b.placeId) return true
  if (a.venue && (a.venue === b.venue || a.venue === b.placeName)) return true
  if (b.venue && b.venue === a.placeName) return true
  return !!a.address && a.address === b.address
}
