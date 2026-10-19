/** Coordenada válida: número finito dentro de ±`max` (90 para latitud, 180 para longitud). */
export const validCoord = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= max

/** Redondea a 5 decimales (~1 m): lo que viaja en la URL o en el `state`. */
export const round5n = (n: number): number => Math.round(n * 1e5) / 1e5
