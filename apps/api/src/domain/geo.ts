const EARTH_RADIUS_M = 6_371_000
const WALK_M_PER_MIN = 80 // B-8: estimación en línea recta a velocidad fija
const rad = (deg: number): number => (deg * Math.PI) / 180

/** [min_lon, min_lat, max_lon, max_lat] */
export type Bbox = [number, number, number, number]

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Minutos a pie sobre la distancia ya redondeada que ve el cliente. */
export const walkMinutes = (distanceM: number): number => Math.ceil(distanceM / WALK_M_PER_MIN)

/** Distancia al origen: `distance` sin redondear (filtro de radio) y los campos redondeados que ve el cliente. */
export function distanceInfo(
  origin: { lat: number; lon: number } | null,
  lat: number | null,
  lon: number | null,
): { distance: number | null; distance_m: number | null; walk_minutes: number | null } {
  if (!origin || lat === null || lon === null) return { distance: null, distance_m: null, walk_minutes: null }
  const distance = haversineM(origin.lat, origin.lon, lat, lon)
  const distance_m = Math.round(distance)
  return { distance, distance_m, walk_minutes: walkMinutes(distance_m) }
}

/** Recuadro que contiene el círculo de radio `radiusM` (algo holgado: prefiltro, no filtro final). */
export function bboxAround(lat: number, lon: number, radiusM: number): Bbox {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI) * 1.01
  const dLon = dLat / Math.max(Math.cos(rad(lat)), 0.01)
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}

/** `min_lon,min_lat,max_lon,max_lat`. Lanza si está mal formado o si algún mínimo supera a su máximo. */
export function parseBbox(raw: string): Bbox {
  const parts = raw.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error('bbox debe ser min_lon,min_lat,max_lon,max_lat')
  }
  const [minLon, minLat, maxLon, maxLat] = parts as Bbox
  if (minLon > maxLon || minLat > maxLat) throw new Error('bbox: el mínimo no puede superar al máximo')
  return [minLon, minLat, maxLon, maxLat]
}

export const pointInBbox = (lat: number, lon: number, b: Bbox): boolean =>
  lon >= b[0] && lat >= b[1] && lon <= b[2] && lat <= b[3]
