# DESIGN.md — Brief de diseño de UI

> Documento vivo. Cada feature de Nivel 1+ (`tracks/app/00-playbook.md` Fase 1A) agrega una entrada nueva al final — nunca se reescribe entero.
>
> Referencias del playbook: arquetipos de página (`docs/12-page-archetypes.md`), arquitectura de tokens (`docs/10-ui-design-architecture.md`), proceso y DoD visual (`docs/11-ui-design-process.md`), `@triptongo/ui` (ADR 0003), Figma Make (ADR 0004).

---

## Baseline — UI actual del agregador (`ingestion/site/index.html`) — 2026-09-29

- **PR / rama:** n/a (registro del diseño existente antes de migrarlo a Vue + PrimeVue)
- 🔹 **Nivel:** 2 (vistas nuevas en el dashboard; el diseño ya existe como prototipo HTML)
- 🔹 **Arquetipo (`docs/12-page-archetypes.md`):** por clasificar al correr `/enrich-us` (pantallas de listado con filtros + grilla de tarjetas; el panel admin todavía no tiene diseño)
- 🔹 **Qué cambia y por qué:** se exporta el diseño vigente a Figma como sistema de registro y superficie de revisión, antes de reimplementarlo con PrimeVue 4 + `@triptongo/ui`. No hay cambios de diseño en este paso.
- 🔹 **Estados asíncronos que toca:** todos, ya presentes en el prototipo:
  - loading: "Cargando agenda…", "Cargando espacios…", "Cargando lugares…"
  - empty: "No encontramos nada con esos filtros. Probá ampliar la fecha o sacar el tipo."
  - error: "No se pudo cargar la agenda." / "…la lista de espacios." / "…el directorio de lugares."
  - success: grilla de tarjetas + contador
  - extras: geolocalización denegada, y aviso de fuente caída en el footer (datos anteriores)
- **Componentes PrimeVue 4 / `@triptongo/ui` a usar:** pendiente (a definir en la entrada de cada vista). Equivalencias probables: Chip → `SelectButton`/`ToggleButton`, Tab → `Tabs`, Tag → `Tag`, buscador → `InputText` + `IconField`, tarjeta → `Card`.
- **Tokens / variables:** colección `Rosario / Color` (Light + Dark) con los 11 tokens del `:root` del prototipo (`bg`, `surface`, `ink`, `muted`, `line`, `accent`, `accent-ink`, `chip`, `chip-on`, `chip-on-ink`, `free`) y colección `Rosario / Radius` (10 / 14 / 6 / pill). Los valores hex se copiaron 1:1 del CSS actual; al pasar a PrimeVue se mapean al preset (`src/theme.ts`).
- **Layout intent:** contenedor de 1080 px centrado con 16 px de gutter; grilla `repeat(auto-fill, minmax(290px, 1fr))` → 3 columnas en desktop, 1 en mobile (≤ 520 px); barra de filtros con `position: sticky`.

### Prototipo y aprobación

- **Prototipo:** el HTML existente (`ingestion/site/index.html`). No hubo variantes ni Figma Make.
- **Export a Figma:** https://www.figma.com/design/MhP3nCCpTA4BEg6XHs7MFV — construido con el MCP de Figma (`use_figma`) a partir del HTML, no con el plugin `html.to.design`. Contenido:
  - `Tokens`: variables Light/Dark y tablero de swatches.
  - `Componentes`: `Chip`, `Tab`, `Tag` (component sets con propiedad `Label`) y `EventCard`, `VenueCard`, `PlaceCard`. Todo enlazado a variables y estilos de texto (cero hex literal).
  - `Pantallas`: Eventos, Espacios y Lugares en desktop Light; Eventos en Dark y en mobile 390; y un tablero con los estados asíncronos.
- **Desvíos respecto del playbook (a revisar):**
  1. Sin remapeo contra `Triptongo UI Seed v1.0` (DoD §5 de `docs/11`): la librería no figura entre las disponibles para esta cuenta/archivo. Pendiente agregarla y remapear estilos/variables antes de aprobar.
  2. Tipografías: el prototipo usa Georgia (títulos) y `system-ui` (cuerpo). En Figma se sustituyeron por **Noto Serif Bold** e **Inter**, que están disponibles en el archivo. El look final se define con el preset de PrimeVue.
  3. Las miniaturas de las tarjetas de evento son placeholders (rectángulo 16:9): las imágenes reales vienen de las fuentes y no se importan a Figma.
  4. Datos de ejemplo tomados de `events.json` / `venues.json` / `places.json` del 2026-09-29.
- **Aprobación:** _pendiente_ — nombre + fecha (bloqueante para Fase 3). Sin aprobación registrada no empieza la implementación de esta vista.
- **Gate de wireframe (Fase 1A):** este frame documenta lo que existe; **no reemplaza el wireframe del owner** para las pantallas nuevas (panel admin). Sigue pendiente lo que corresponda en `wireframes/`.

---

## Sitio público de búsqueda mobile-first — 2026-09-30

- **PR / rama:** pendiente (sin implementación todavía)
- 🔹 **Nivel:** 3 (flujo nuevo de varias pantallas: Home, Zona, Resultados, Detalle y estados)
- 🔹 **Arquetipo (`docs/12-page-archetypes.md`):** por confirmar (D-1 de `docs/changes/sitio-publico-busqueda.md`): listado con filtros más detalle, con mapa como variante.
- 🔹 **Qué cambia y por qué:** reemplaza al sitio estático legacy por el flujo «¿Qué querés hacer? → ¿Dónde? → Resultados → Detalle». Decisiones de producto y modelo en `docs/changes/sitio-publico-busqueda.md`.
- 🔹 **Estados asíncronos que toca:** sin ubicación (primer uso), permiso denegado, cargando, sin resultados y error de carga (incluye fuente desactualizada). Wireframes en `wireframes/estado-*.html`.
- **Wireframes del owner:** `wireframes/*.html`, convertidos del Figma Make `en5jOAjdZvfWxOggie0jUt` (Wireframes.tsx). Cambios pendientes derivados de las decisiones: ver esa misma nota de `docs/changes/`.
- **Componentes PrimeVue 4 / `@triptongo/ui` a usar:** `SelectButton` (intenciones, momento, modo de zona), `AutoComplete` (barrio), `Slider` (radio), `Tag`, `Message`, `Skeleton`. Bottom sheet: componente propio en `@triptongo/ui` (con arrastre y alturas intermedias; `Drawer` no alcanza).
- **Dirección visual:** **B · Ribera** (Set 1 del Figma Make): verde río como tinta, amarillo sábalo `#F2BE00` como único acento, serif Young Serif para títulos y Schibsted Grotesk para el cuerpo, radios de 12 a 24 px. Claro y oscuro desde el inicio.
- **Tokens / variables:** capas primitivos → semánticos (claro/oscuro) → por componente, tal como están en `src/rq/tokens.ts` del Make. **Ajuste:** se elimina `type-espacio`; el sitio tiene solo dos tipos de resultado (EVENTO y LUGAR).
- **Prototipo y aprobación:**
  - Prototipo: Figma Make `en5jOAjdZvfWxOggie0jUt` (6 direcciones, A–F).
  - **Aprobación:** Daniel King, 2026-09-30, dirección **B · Ribera**.
  - Pendiente: remapeo contra `Triptongo UI Seed v1.0` (DoD §5 de `docs/11`), como en la entrada anterior.
