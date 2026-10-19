<template>
  <div class="relative h-full w-full overflow-hidden bg-[var(--rq-map-land)]">
    <!-- MapLibre le pone `position: relative` al contenedor, así que el tamaño sale de este envoltorio absoluto. -->
    <div class="absolute inset-0">
      <div ref="container" class="h-full w-full" role="region" aria-label="Mapa de resultados" />
    </div>
    <p
      v-if="unavailable"
      class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted"
      role="status"
    >
      El mapa no está disponible por ahora. Podés seguir usando la lista.
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification, GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { SearchPin } from '@tript/shared'
import { ROSARIO, circlePolygon } from '@/lib/geo'
import { mapStyleUrl } from '@/lib/map-style'

const props = defineProps<{
  pins?: SearchPin[]
  center?: { lat: number; lon: number } | null
  radiusM?: number
  /** El punto de origen se arrastra, o se mueve tocando el mapa. */
  draggable?: boolean
  /** `kind:id` del pin resaltado. */
  selectedKey?: string | null
  /** Cada vez que cambia, el mapa se vuelve a encuadrar (búsqueda nueva, no mover el mapa). */
  fitKey?: string | number
  /** Margen del encuadre en px (p. ej. para no quedar bajo la hoja inferior). */
  padding?: { top: number; bottom: number; left: number; right: number }
}>()

const emit = defineEmits<{
  move: [point: { lat: number; lon: number }]
  select: [key: string]
  /** Recuadro visible tras mover o hacer zoom con el dedo/mouse: `min_lon,min_lat,max_lon,max_lat`. */
  bounds: [bbox: string]
}>()

const container = ref<HTMLElement | null>(null)
const unavailable = ref(false)

let map: MapLibreMap | null = null
let maplibre: typeof import('maplibre-gl') | null = null
let marker: Marker | null = null
let dark = false
let scheme: MediaQueryList | null = null

const PINS = 'pins'
const RADIUS = 'radius'

// Los colores salen de los tokens (tokens.css); acá no hay hex.
const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const pinKey = (p: SearchPin): string => `${p.kind}:${p.id}`

function pinsGeoJson(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (props.pins ?? []).map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { key: pinKey(p), kind: p.kind, title: p.title },
    })),
  }
}

function radiusGeoJson(): FeatureCollection {
  const c = props.center
  if (!c || !props.radiusM) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePolygon(c.lat, c.lon, props.radiusM)] }, properties: {} },
    ],
  }
}

/** Las fuentes y capas viven en el estilo: hay que volver a ponerlas cada vez que cambia (claro/oscuro). */
function addLayers(m: MapLibreMap): void {
  m.addSource(RADIUS, { type: 'geojson', data: radiusGeoJson() })
  m.addLayer({ id: 'radius-fill', type: 'fill', source: RADIUS, paint: { 'fill-color': cssVar('--rq-primary'), 'fill-opacity': 0.18 } })
  m.addLayer({ id: 'radius-line', type: 'line', source: RADIUS, paint: { 'line-color': cssVar('--rq-primary'), 'line-width': 2 } })

  m.addSource(PINS, { type: 'geojson', data: pinsGeoJson() })
  const color: ExpressionSpecification = [
    'match', ['get', 'kind'], 'event', cssVar('--rq-type-evento'), 'place', cssVar('--rq-type-lugar'), cssVar('--rq-text-muted'),
  ]
  m.addLayer({
    id: 'pins',
    type: 'circle',
    source: PINS,
    paint: { 'circle-radius': 7, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--rq-surface-card') },
  })
  m.addLayer({
    id: 'pins-selected',
    type: 'circle',
    source: PINS,
    filter: ['==', ['get', 'key'], props.selectedKey ?? ''],
    paint: { 'circle-radius': 11, 'circle-color': color, 'circle-stroke-width': 3, 'circle-stroke-color': cssVar('--rq-border-strong') },
  })
}

function syncMarker(): void {
  if (!map || !maplibre) return
  const c = props.center
  if (!c) {
    marker?.remove()
    marker = null
    return
  }
  if (!marker) {
    marker = new maplibre.Marker({ draggable: Boolean(props.draggable), color: cssVar('--rq-primary') })
      .setLngLat([c.lon, c.lat])
      .addTo(map)
    marker.on('dragend', () => {
      const { lat, lng } = marker!.getLngLat()
      emit('move', { lat, lon: lng })
    })
  } else {
    marker.setLngLat([c.lon, c.lat])
  }
}

function syncData(): void {
  // `isStyleLoaded()` es falso mientras el mapa base baja teselas: se mira si las fuentes existen (si no,
  // `addLayers` ya toma los datos actuales al crearlas).
  if (!map) return
  ;(map.getSource(PINS) as GeoJSONSource | undefined)?.setData(pinsGeoJson())
  ;(map.getSource(RADIUS) as GeoJSONSource | undefined)?.setData(radiusGeoJson())
  if (map.getLayer('pins-selected')) map.setFilter('pins-selected', ['==', ['get', 'key'], props.selectedKey ?? ''])
}

/** Encuadra el círculo de búsqueda, o los pins, o Rosario. */
function fit(): void {
  if (!map || !maplibre) return
  const duration = reducedMotion() ? 0 : 400
  const { clientWidth: w, clientHeight: h } = map.getContainer()
  // Sin tamaño todavía (layout en curso): se reintenta apenas el mapa se mide.
  if (!w || !h) {
    map.once('resize', fit)
    return
  }
  const c = props.center
  const points: [number, number][] =
    c && props.radiusM
      ? circlePolygon(c.lat, c.lon, props.radiusM, 16)
      : (props.pins ?? []).map((p) => [p.lon, p.lat] as [number, number])
  if (c && !props.radiusM) points.push([c.lon, c.lat])
  if (points.length === 0) {
    map.easeTo({ center: [ROSARIO.lon, ROSARIO.lat], zoom: 12, duration })
    return
  }
  const b = new maplibre.LngLatBounds(points[0]!, points[0]!)
  for (const p of points) b.extend(p)
  map.fitBounds(b as LngLatBoundsLike, { padding: fitPadding(w, h), maxZoom: 16, duration })
}

/** El margen pedido no puede comerse el lienzo: si no entra, se reduce en proporción (MapLibre avisa y no encuadra). */
function fitPadding(w: number, h: number): { top: number; bottom: number; left: number; right: number } {
  const p = props.padding ?? { top: 48, bottom: 48, left: 48, right: 48 }
  const scale = (a: number, b: number, size: number): [number, number] => {
    const max = size * 0.7
    return a + b > max ? [(a / (a + b)) * max, (b / (a + b)) * max] : [a, b]
  }
  const [top, bottom] = scale(p.top, p.bottom, h)
  const [left, right] = scale(p.left, p.right, w)
  return { top, bottom, left, right }
}

function apply(): void {
  syncData()
  syncMarker()
}

onMounted(async () => {
  const wanted = window.matchMedia('(prefers-color-scheme: dark)')
  scheme = wanted
  dark = wanted.matches
  const style = mapStyleUrl(dark, import.meta.env.VITE_MAPTILER_KEY)
  if (!style || !container.value) {
    unavailable.value = true
    return
  }
  try {
    // MapLibre pesa más que el resto del sitio junto: se carga recién acá (S2-20).
    const [mod] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
    maplibre = mod
    if (!container.value) return
    const c = props.center ?? ROSARIO
    map = new mod.Map({
      container: container.value,
      style,
      center: [c.lon, c.lat],
      zoom: 12,
      attributionControl: { compact: true },
    })
  } catch {
    unavailable.value = true
    return
  }

  const m = map
  m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
  m.on('error', (e) => {
    // Clave inválida o sin red: se muestra el aviso en vez de un mapa gris.
    const status = (e.error as { status?: number } | undefined)?.status
    if (status === 401 || status === 403) unavailable.value = true
  })
  // El estilo pide algún ícono de sprite sin nombre que no existe: se registra uno transparente en vez de avisar.
  m.on('styleimagemissing', (e) => {
    if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) })
  })
  m.on('style.load', () => {
    addLayers(m)
    apply()
  })
  m.on('load', () => {
    apply()
    fit()
  })
  m.on('click', 'pins', (e) => {
    const key = e.features?.[0]?.properties?.key
    if (typeof key === 'string') emit('select', key)
  })
  m.on('mouseenter', 'pins', () => (m.getCanvas().style.cursor = 'pointer'))
  m.on('mouseleave', 'pins', () => (m.getCanvas().style.cursor = ''))
  m.on('click', (e) => {
    if (!props.draggable) return
    emit('move', { lat: e.lngLat.lat, lon: e.lngLat.lng })
  })
  // Solo los movimientos del usuario (tienen `originalEvent`): el encuadre automático no dispara búsquedas.
  m.on('moveend', (e) => {
    if (!('originalEvent' in e) || !e.originalEvent) return
    const b = m.getBounds()
    const r = (n: number) => Math.round(n * 1e5) / 1e5
    emit('bounds', `${r(b.getWest())},${r(b.getSouth())},${r(b.getEast())},${r(b.getNorth())}`)
  })

  wanted.addEventListener('change', onScheme)
})

function onScheme(e: MediaQueryListEvent): void {
  dark = e.matches
  const style = mapStyleUrl(dark, import.meta.env.VITE_MAPTILER_KEY)
  if (map && style) map.setStyle(style)
}

onBeforeUnmount(() => {
  scheme?.removeEventListener('change', onScheme)
  marker?.remove()
  map?.remove()
  map = null
  marker = null
})

watch(() => [props.pins, props.selectedKey], apply)
watch(() => props.center, () => {
  apply()
  // Al mover el punto el mapa lo sigue, salvo que lo haya movido el propio usuario sobre el mapa.
  if (!props.draggable) fit()
})
watch(() => props.radiusM, () => {
  apply()
  fit()
})
watch(() => props.fitKey, fit)
</script>
