# Sitio público · Slice 4b-1 — Detalle de lugar: contrato, API e ingesta

Primera mitad del slice 4b; la UI es [`sitio-publico-detalle-lugar.md`](sitio-publico-detalle-lugar.md) (4b-2). Continúa [`sitio-publico-busqueda.md`](sitio-publico-busqueda.md) (AC-28 `getPlace`, F-6, F-9, AC-17) y [`sitio-publico-detalle-evento.md`](sitio-publico-detalle-evento.md) (S4-2). Wireframe del owner: `wireframes/detalle-lugar.html`, aprobado el 2026-10-19 (`docs/DESIGN.md`).

**Cambia el contrato de forma aditiva** (`docs/api-spec.yml`, `getPlace`): `PlaceDetail.next_change_at` y `UpcomingEvent.end_date`, ambos requeridos. También cambian los datos que publica la ingesta: la cocina de los lugares pasa a estar en español. Se parte en dos PRs de implementación porque este toca `apps/api` e `ingestion/` y se despliega primero; la UI se construye contra este contrato.

## Decisiones

Todas confirmadas por el owner el 2026-10-19 en `/enrich-us` (✔).

| ID | Tema | Decisión |
|---|---|---|
| L1-1 ✔ | Quién calcula el horario (B1) | El **servidor**: `PlaceDetail.next_change_at`. La UI lo formatea en hora de Buenos Aires («cierra 23:00», «abre mañana 12:00»); no recalcula intervalos. |
| L1-2 ✔ | Semántica de `next_change_at` | Primer instante posterior a «ahora» en que `open_now` cambia de valor: el cierre si está abierto, la próxima apertura si está cerrado. Fusiona los tramos contiguos o superpuestos (12:00–16:00 + 16:00–23:00 es un solo tramo abierto, así que a las 14:00 el cambio es 23:00; con varios días seguidos de 24 h el cambio es al terminar el último). Regla general: si no hay un cambio estrictamente antes de «ahora + 8 días», es `null`; eso cubre el 24/7 en cualquier representación (`00:00`–`00:00`, `06:00`–`06:00`, etc.) y `opening_hours` `null` (donde `open_now` también es `null`). Un período `opens == closes` es 24 h (F-9). |
| L1-3 ✔ | Eventos en curso (B2) | `UpcomingEvent.end_date` (requerido, aditivo). `start_date` sigue siendo el inicio del rango (hallazgo ya conocido de `detail.repo.ts`): la UI usa el rango en vez de mostrar una fecha pasada. Orden y tope (20) no cambian. |
| L1-4 ✔ | Cocina (B3) | Se **traduce en la ingesta** (`ingestion/`): diccionario inglés → español para los valores de OSM. Un valor sin traducción se **conserva crudo** y se registra en el log del run para ampliar el diccionario. El contrato no cambia de forma (`cuisine: string[]`), sí su descripción. Obliga a reingestar los lugares. |
| L1-5 | Diccionario inicial | Al menos los 12 valores vistos en staging el 2026-10-19: `coffee shop`→`café`, `pastry`→`pastelería`, `ice cream`→`helados`, `cake`→`tortas`, `breakfast`→`desayunos`, `brunch`→`brunch`, `bakery`→`panadería`, `sandwich`→`sándwiches`, `argentinian`→`argentina`, `italian pizza`→`pizza italiana`, `mediterranean`→`mediterránea`, `italian`→`italiana`. `/apply` lo completa con todos los valores distintos de `places.json` (unos 75; faltan, por ejemplo, `burger`, `pizza`, `regional`, `empanada`), incluidos los errores de tipeo frecuentes de OSM (`coffe shop`, `sandiwch`, `emapanada`, `hotdog`) y los propios valores ya traducidos (se mapean a sí mismos y no cuentan como «sin traducir»). Supuesto — confirmar la traducción de cada uno. |
| L1-6 | Lugares curados | No cambian: `cuisine` sigue como lo cargó el curado (hoy `[]`); la traducción solo aplica a lugares de origen OSM. |

## Criterios de aceptación

Reloj fijo en los tests; Buenos Aires es UTC−3 sin horario de verano. «Mié 21:00» = 2026-10-21T21:00-03:00 = 2026-10-22T00:00Z.

### getPlace: `next_change_at`

- **[AC-1]** Abierto → cierre.
  - Given: reloj mié 21:00; lugar que abre mié 12:00–23:00.
  - Then: `open_now: true`, `next_change_at` = 2026-10-22T02:00Z (23:00 local).
- **[AC-2]** Cerrado → próxima apertura.
  - Given: reloj mié 21:00; (a) lugar que abre mié 22:30–23:30; (b) lugar que abre mié y jue 12:00–20:00; (c) lugar que abre solo los mié 12:00–20:00.
  - Then: (a) `open_now: false`, `next_change_at` = 2026-10-22T01:30Z; (b) `open_now: false`, `next_change_at` = jue 12:00 local = 2026-10-22T15:00Z; (c) `open_now: false`, `next_change_at` = mié siguiente 12:00 local = 2026-10-28T15:00Z (salto de una semana, dentro del horizonte).
- **[AC-3]** Tramos contiguos fusionados.
  - Given: reloj mié 14:00; tramos mié 12:00–16:00 y 16:00–23:00.
  - Then: `open_now: true`, `next_change_at` = 23:00 local (no 16:00).
- **[AC-4]** Cierre pasada la medianoche.
  - Given: reloj sáb 01:00; período vie 18:00–03:00.
  - Then: `open_now: true`, `next_change_at` = sáb 03:00 local = 2026-10-24T06:00Z.
- **[AC-5]** 24 h todos los días.
  - Given: siete períodos `00:00`–`00:00`; y, aparte, siete períodos `06:00`–`06:00`.
  - Then: en ambos, `open_now: true`, `next_change_at: null` (no hay cambio dentro de 8 días).
- **[AC-6]** 24 h solo un día.
  - Given: reloj lun 10:00; único período lun `00:00`–`00:00`.
  - Then: `open_now: true`, `next_change_at` = mar 00:00 local = 2026-10-20T03:00Z.
- **[AC-6b]** 24 h varios días seguidos y períodos superpuestos.
  - Given: reloj lun 10:00; (a) lun y mar `00:00`–`00:00`; (b) lun `00:00`–`00:00` y lun `20:00`–`02:00`.
  - Then: (a) `open_now: true`, `next_change_at` = mié 00:00 local = 2026-10-21T03:00Z (no mar 00:00); (b) `open_now: true`, `next_change_at` = mar 02:00 local = 2026-10-20T05:00Z.
- **[AC-7]** Sin horario estructurado.
  - Given: `opening_hours: null` (con o sin `hours_text`).
  - Then: `open_now: null`, `next_change_at: null`; `hours_text` se devuelve como antes.
- **[AC-8]** Todas las claves siempre.
  - When: `GET /api/places/{id}` en cualquiera de los casos anteriores.
  - Then: la respuesta valida contra `PlaceDetail` y `next_change_at` está presente (nunca ausente).

### getPlace: `upcoming_events[].end_date`

- **[AC-9]** Rango en curso y evento de un día.
  - Given: reloj mié; lugar con un evento del mar al vie (en curso) y otro solo el jue.
  - Then: ambos en `upcoming_events` con `end_date`; el de un día con `end_date == start_date`; el orden (próximo primero) y el tope de 20 no cambian.

### Ingesta: cocina en español

- **[AC-10]** Traducción de valores conocidos.
  - Given: un lugar OSM con `cuisine: ["coffee shop", "italian pizza"]`.
  - Then: `osm_place` devuelve `["café", "pizza italiana"]`.
- **[AC-11]** Valor desconocido.
  - Given: `cuisine: ["coffee shop", "peruvian"]`.
  - Then: `["café", "peruvian"]` (se conserva crudo). Un valor ya en español del diccionario (`café`) pasa sin contarse como desconocido. Al terminar el run se emite **un solo resumen** con los valores distintos sin traducir (por `print`/`::warning::`, como el resto de `publish.py`); la función que arma ese resumen devuelve la lista y se testea sin depender del mecanismo de salida.
- **[AC-12]** Normalización y duplicados.
  - Given: `["Coffee_Shop", " coffee shop "]` y `["coffee shop", "café"]`.
  - Then: `["café"]` en ambos (mayúsculas, guiones bajos y espacios se normalizan; dos valores que traducen igual se reducen a uno, conservando el orden).
- **[AC-13]** Curados y reenvío.
  - Then: los lugares curados no cambian (`cuisine` como lo cargó el curado); reenviar un lote ya publicado con la cocina traducida da `updated` y no crea filas duplicadas (idempotencia, AC-30 de `sitio-publico-busqueda.md`).
- **[AC-14]** **[Manual]** Reingesta.
  - Cubierto por la verificación posterior al deploy: tras correr la ingesta contra staging (y luego producción), `GET /api/places/{id}` de un lugar con cocina conocida devuelve las etiquetas en español.

## Plan de tareas (`/apply`)

1. **RED:** tests de `apps/api` (función pura `nextStateChange` con reloj inyectado, y la ruta `getPlace` con D1 de test), y de `ingestion/tests` (`cuisine`), citando `[AC-N]`. Actualizar los dos tests existentes que se rompen: `apps/api/src/__tests__/detail.d1.test.ts` (el `toEqual` de `upcoming_events[0]` suma `end_date`) y `ingestion/tests/test_ingest_places.py` (espera `["café"]` en vez de `["coffee shop"]`).
2. **GREEN API:** `nextStateChange(periods, now)` en `apps/api/src/domain/opening-hours.ts`, reutilizando `openIntervals`, fusionando intervalos contiguos o superpuestos y con horizonte de 8 días; `getPlaceDetail` (`apps/api/src/db/detail.repo.ts`) suma `next_change_at` y `end_date`. Sin migración (los datos ya existen).
3. **GREEN ingesta:** `ingestion/cuisine.py` con el diccionario y la función de normalización/traducción, usada en `ingest_places.osm_place`; los valores sin traducir se resumen una vez por run (ver AC-11).
4. `npm run generate:schemas` (regenera `schemas.ts` y `types.ts`; nunca a mano).
5. **Cierre:** `/verify`; smoke local contra `wrangler dev` de `getPlace` (la query hace `JOIN`, Paso 4.5 de `/verify`); `/code-review` estándar.
6. **Post-merge:** el deploy a staging es automático; correr la ingesta contra staging y comprobar un lugar con cocina conocida; producción es manual (`deploy-production.yml`) y se reingesta después.

## Pendiente de otros slices

- **4b-2** (UI) consume `next_change_at` y `end_date`; se puede construir contra este contrato con datos de prueba, pero se verifica en navegador cuando 4b-1 esté en staging.
