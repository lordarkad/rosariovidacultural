/** Radio de búsqueda alrededor de un punto (docs/api-spec.yml, `radio_m`). */
export const RADIO_MIN = 500
export const RADIO_MAX = 10000
export const RADIO_DEFAULT = 2000

/** Centro de Rosario: donde arranca el mapa cuando no hay otro origen (S2-14). */
export const ROSARIO = { lat: -32.9468, lon: -60.6393 } as const

const EARTH_RADIUS_M = 6371008.8

export function clampRadius(m: number): number {
  if (!Number.isFinite(m)) return RADIO_DEFAULT
  return Math.min(RADIO_MAX, Math.max(RADIO_MIN, Math.round(m)))
}

/** «500 m», «2 km», «2,5 km». */
export function formatRadius(m: number): string {
  if (m < 1000) return `${m} m`
  return `${String(m / 1000).replace('.', ',')} km`
}

/** Anillo cerrado `[lon, lat]` que dibuja el radio sobre el mapa (aproximación esférica). */
export function circlePolygon(lat: number, lon: number, radiusM: number, steps = 64): [number, number][] {
  const rad = (d: number) => (d * Math.PI) / 180
  const deg = (r: number) => (r * 180) / Math.PI
  const angular = radiusM / EARTH_RADIUS_M
  const lat1 = rad(lat)
  const lon1 = rad(lon)
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const bearing = (2 * Math.PI * i) / steps
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing))
    const lon2 =
      lon1 +
      Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2))
    ring.push([deg(lon2), deg(lat2)])
  }
  ring.push(ring[0]!)
  return ring
}
