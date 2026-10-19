import type { Zone } from '@tript/shared'

export type GeoFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export class GeolocationError extends Error {
  constructor(public readonly reason: GeoFailure) {
    super(reason)
    this.name = 'GeolocationError'
  }
}

/** Posición actual (GPS). Solo se pide cuando el usuario toca el botón; nunca se guarda (D-9). */
export function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
      reject(new GeolocationError('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new GeolocationError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  })
}

const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

const MAX_SUGGESTIONS = 6

/** Sugerencias del autocomplete: sin tildes ni mayúsculas, primero los que empiezan con el texto. */
export function filterZones(zones: Zone[], text: string): Zone[] {
  const needle = fold(text)
  if (!needle) return []
  const starts: Zone[] = []
  const contains: Zone[] = []
  for (const z of zones) {
    const name = fold(z.name)
    if (name.startsWith(needle)) starts.push(z)
    else if (name.includes(needle)) contains.push(z)
  }
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
}
