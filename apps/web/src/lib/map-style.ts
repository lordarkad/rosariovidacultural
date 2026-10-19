/**
 * Estilo vectorial de MapTiler (S2-2). Sin clave no hay mapa: la pantalla sigue funcionando con la lista.
 * La clave viaja en el bundle, así que se restringe por origen en el panel de MapTiler.
 */
export function mapStyleUrl(dark: boolean, key: string | undefined): string | null {
  if (!key) return null
  const style = dark ? 'streets-v2-dark' : 'streets-v2'
  return `https://api.maptiler.com/maps/${style}/style.json?key=${encodeURIComponent(key)}`
}
