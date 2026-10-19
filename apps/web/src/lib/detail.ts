import type { SearchQuery } from '@/services/api'
import { round5n, validCoord } from '@/lib/coords'

// `type` y no `interface`: así encaja en `HistoryState` de vue-router (el `state` de la navegación).
export type Origin = { lat: number; lon: number }

const asOrigin = (lat: unknown, lon: unknown): Origin | null =>
  validCoord(lat, 90) && validCoord(lon, 180) ? { lat: round5n(lat), lon: round5n(lon) } : null

/**
 * Destino del enlace al Detalle (S4-2, S4-3). Los lugares no tienen Detalle todavía: `null`.
 * La URL es siempre canónica; el origen de la distancia viaja en el `state`, nunca en la URL.
 */
export function detailLink(
  kind: string,
  id: string,
  origin?: Partial<Origin> | null,
): { path: string; state: { origin?: Origin } } | null {
  if (kind !== 'event') return null
  const o = origin ? asOrigin(origin.lat, origin.lon) : null
  return { path: `/e/${id}`, state: o ? { origin: o } : {} }
}

/** Origen de referencia desde la búsqueda: el centro de la zona o las coordenadas (S4-3). */
export function searchOrigin(q: SearchQuery, zone?: { lat: number; lon: number } | null): Origin | null {
  if (q.z) return zone ? asOrigin(zone.lat, zone.lon) : null
  return asOrigin(q.lat, q.lon)
}

/** Lee el origen de `history.state`; lo que no es un par válido se descarta. */
export function originFromState(state: unknown): Origin | null {
  const o = (state as { origin?: { lat?: unknown; lon?: unknown } } | null)?.origin
  return o ? asOrigin(o.lat, o.lon) : null
}

/** «Volver»: `router.back()` solo si la entrada anterior es Resultados (S4-5); si no, va a Resultados. */
export function backTarget(historyState: { back?: string | null } | null): 'back' | '/resultados' {
  const back = historyState?.back
  return typeof back === 'string' && /^\/resultados(?:[?#]|$)/.test(back) ? 'back' : '/resultados'
}

export type TabId = 'buscar' | 'zona' | 'resultados'

/** Pestaña marcada: `meta.tab` si la ruta la declara (el Detalle), si no por path (S4-7). */
export function activeTab(route: { path: string; meta?: { tab?: unknown } }): TabId | null {
  const tab = route.meta?.tab
  if (tab === 'buscar' || tab === 'zona' || tab === 'resultados') return tab
  if (route.path === '/') return 'buscar'
  if (route.path.startsWith('/zona')) return 'zona'
  if (route.path.startsWith('/resultados')) return 'resultados'
  return null
}

/** Enlace universal de Google Maps con destino por coordenadas (S4-6); `null` sin ubicación. */
export function mapsUrl(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (!validCoord(lat, 90) || !validCoord(lon, 180)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`
}

/** Solo se enlazan fuentes `http(s)` (S4-11); cualquier otro esquema o texto: `null`. */
export function safeSourceUrl(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

export const DESCRIPTION_LIMIT = 400

/** Descripción truncada por encima de 400 caracteres (S4-10); `expanded` muestra todo. */
export function truncateDescription(text: string, expanded = false): { text: string; truncated: boolean } {
  if (text.length <= DESCRIPTION_LIMIT) return { text, truncated: false }
  return { text: expanded ? text : `${text.slice(0, DESCRIPTION_LIMIT).trimEnd()}…`, truncated: true }
}
