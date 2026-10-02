/** Minúsculas, sin tildes ni signos, espacios colapsados. Clave de comparación de títulos, sedes y direcciones. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
