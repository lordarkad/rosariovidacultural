/** Columna TEXT con JSON → valor tipado; `null` en la base cae al valor por defecto. */
export const parse = <T>(s: string | null, fallback: T): T => (s === null ? fallback : (JSON.parse(s) as T))
