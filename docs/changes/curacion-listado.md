# Curación · Listado de eventos y lugares (`/curacion/eventos`, `/curacion/lugares`)

Pedido del owner (2026-10-19): dos secciones ocultas que listan **todos** los eventos y **todos** los lugares cargados, sin intención ni ubicación, para chequear que la ingesta carga bien y corroborar el contenido con un equipo de voluntarios. Es **solo lectura** más exportación CSV; la edición manual es otro slice (hoy no hay curación manual: un reenvío de la ingesta pisa la fila).

Wireframe del owner: [`wireframes/curacion.html`](../../wireframes/curacion.html), aprobado el 2026-10-19 (`docs/DESIGN.md`, `wireframes/README.md`). Base de UI: dirección B · Ribera, perfil `personal`.

**Cambia el contrato de forma aditiva** (`docs/api-spec.yml`): `listEvents`, `listEventSources` y `listPlaces`, más los schemas `CurationEvent`, `CurationPlace`, `EventSourceCount`, `EventState`, `EventMissingField`, `PlaceMissingField` y los parámetros `CurationPage`/`CurationPerPage`. Sin migración: los datos ya existen. Un solo PR de implementación (API + web) porque la UI no se puede verificar sin los endpoints y cada mitad sola no tiene valor.

## Decisiones

✔ = confirmada por el owner el 2026-10-19 en `/enrich-us`.

| ID | Tema | Decisión |
|---|---|---|
| C-1 ✔ | Dónde vive | Rutas ocultas en `apps/web`: `/curacion/eventos` y `/curacion/lugares`. Sin login, sin enlace desde ninguna pantalla. |
| C-2 ✔ | Indexación | `noindex, nofollow` por dos vías: header `X-Robots-Tag` para `/curacion/*` en `apps/web/public/_headers` y `<meta name="robots">` desde el router. |
| C-3 ✔ | Alcance | Solo lectura + CSV. La edición queda como slice aparte. |
| C-4 ✔ | Eventos | Todos: vigentes, pasados y vencidos, estos marcados con su estado. |
| C-5 ✔ | Columnas | Datos + origen/fuente + campos faltantes. Eventos: fecha, hora, título, lugar, fuente (+vías), precio, estado, visto, faltan. Lugares: nombre, tipo, origen, dirección, coords, cocina/ofrece, visto, faltan. |
| C-6 ✔ | Filtros | Buscador + fuente/origen, estado/tipo y «Faltan». Todo en la URL. |
| C-7 ✔ | Contrato | Endpoints propios `listEvents` y `listPlaces` con forma propia (no reutilizan `SearchItem`), paginados en SQL (`LIMIT/OFFSET`) con `X-Total-Count`, `X-Page`, `X-Per-Page`. |
| C-8 ✔ | Orden | Eventos por fecha ascendente (pasados al final); lugares por nombre. |
| C-9 ✔ | CSV | Exporta todo lo que cumple los filtros activos, no solo la página. |
| C-10 ✔ | Entorno | Staging por ahora, con cartel del entorno. |
| C-11 | Fuentes del filtro | Tercer endpoint, `listEventSources` (`GET /events/sources`): una fila por fuente con su cantidad. Evita fijar en el cliente una lista de fuentes que cambia cuando se agrega un scraper, y la cantidad por fuente sirve para el propósito del listado (ver cuánto aporta cada una). Es una consulta `GROUP BY`. **Se agrega a lo confirmado («dos endpoints»); revertir si el owner prefiere la lista fija.** |
| C-12 | Pasado vs. vencido | Un evento tiene tres nociones de «viejo» (`end_date`, más de 7 días sin verse, `is_stale` de 36 h). El listado usa un `estado` de tres valores con precedencia: `sin_ver` > `pasado` > `vigente` (reglas en `listEvents`). `is_stale` (36 h) **no** se expone: es un aviso del detalle público. |
| C-13 | «Faltan» es unión | Con varios campos marcados, trae los que les falta **cualquiera** (no todos juntos). Cada fila trae `missing` completo. Supuesto — confirmar. |
| C-14 | Sin parámetro de orden | Orden fijo por endpoint (ver C-8). El wireframe sugería encabezados ordenables (supuesto 2 del README): no entra en este slice, queda como mejora. Supuesto — confirmar. |
| C-15 | «⚠ derivadas» descartado | El wireframe marcaba con ⚠ las coordenadas derivadas de lugares curados sin lat/lon manual. **No existe ese caso**: la ingesta descarta los curados sin `lat`/`lon` (`curated_place` en `ingestion/ingest_places.py`) y la API no guarda de dónde salió una coordenada. Esos lugares simplemente **no aparecen** en el listado (hoy 4). Se quita el aviso del diseño. Queda como gap: ver «Pendiente». |
| C-16 | Páginas y CSV | Por defecto 50 filas por página; máximo 100. El CSV recorre las páginas con `per_page=100` desde el cliente (sin endpoint de exportación): son cientos de eventos y pocos miles de lugares. Sin tope. Supuesto — confirmar. |
| C-17 | Formato CSV | UTF-8 con BOM, separador `;` (el Excel en español lo abre en columnas), `CRLF`, comillas dobles si la celda tiene `;`, comillas, salto de línea o empieza con espacio. Las listas se unen con ` \| `. Las celdas que empiezan con `=`, `+`, `-`, `@`, tab o `CR` se prefijan con `'` (inyección de fórmulas: el texto viene de scrapers de terceros y los voluntarios lo abren en Excel). Nombre `curacion-eventos-AAAA-MM-DD.csv` / `curacion-lugares-AAAA-MM-DD.csv`. Supuesto — confirmar. |
| C-18 | Cartel de entorno | El texto («staging» / «producción») sale de una variable de build `VITE_ENV_LABEL`; sin ella muestra «producción». Supuesto — confirmar. |

## Supuestos del wireframe que se mantienen (siguen «confirmar»)

Visto = `last_seen_at` como «hoy / N d» en hora de Buenos Aires; «Fuente (+vías)» = primaria y contador de vías (`sources.length - 1`); evento sin lugar se rotula «— sin lugar» y la etiqueta `lugar` en Faltan sigue la regla de `listEvents`; estados de pantalla cargando / sin resultados (con «Limpiar filtros») / error (con «Reintentar») / catálogo vacío; **el tab bar del sitio se oculta en `/curacion/*`**; el enlace de la fila abre el detalle público en pestaña nueva y, en un evento `sin_ver`, ese detalle responde 404 (la etiqueta de estado lo anticipa).

## Criterios de aceptación

Reloj fijo en los tests; Buenos Aires es UTC−3 sin horario de verano. Los AC de API (`[AC-1]` a `[AC-20]`) usan D1 de test; `[AC-21]` los repite contra D1 real porque las queries hacen `JOIN` (`place_keys`, `places`, `event_sources`).

### listEvents

- **[AC-1]** Camino feliz y forma.
  - Given: 3 eventos en D1.
  - When: `GET /api/events`.
  - Then: 200, `{ success: true, data: [...] }` con los 3, cada uno válido contra `CurationEvent` con **todas** las claves presentes (los no informados en `null`), y los headers `X-Total-Count: 3`, `X-Page: 1`, `X-Per-Page: 50`.
- **[AC-2]** Incluye lo que el sitio oculta.
  - Given: un evento pasado (`end_date` ayer), otro con `last_seen_at` de hace 8 días y uno vigente; en `searchItems` y `getEvent` los dos primeros no salen.
  - When: `GET /api/events`.
  - Then: salen los tres; `getEvent` del tercero ya no es parte del criterio.
- **[AC-3]** Estado y precedencia.
  - Given: reloj mié 2026-10-21 03:00 local (el día de negocio todavía es martes).
  - Then: `end_date = 2026-10-20` → `vigente`; `end_date = 2026-10-19` → `pasado`; `end_date` de hoy o futuro → `vigente`; `last_seen_at` de exactamente 7 días antes → no es `sin_ver` (`>` 7 días, igual que el vencimiento de `getEvent`); un microsegundo más viejo → `sin_ver`; un evento pasado **y** de hace 8 días sin verse → `sin_ver` (precedencia).
- **[AC-4]** Filtro `estado` (unión).
  - When: `estado=pasado,sin_ver`; `estado=vigente`.
  - Then: solo esos estados; el total de `X-Total-Count` es el filtrado. Sin el parámetro, todos.
- **[AC-5]** Filtros de fuente.
  - Given: eventos de dos fuentes, una `official` y otra `aggregator`.
  - When: `fuente=<una>`; `fuente=<a>,<b>`; `tier=official`.
  - Then: coincidencia exacta y unión; `tier` filtra por el tier de la fuente primaria. Una `fuente` inexistente da `[]` con `X-Total-Count: 0` (no 400).
- **[AC-6]** Campos efectivos desde el lugar vinculado.
  - Given: un evento sin `venue_name`, `address`, `lat` ni `lon` cuyo `place_source_key` resuelve a un lugar con esos datos; otro con datos propios y lugar distinto.
  - Then: el primero devuelve los del lugar y `place: {id, name, address}`; el segundo conserva los suyos (prioridad del evento). `faltan=direccion` y `faltan=coordenadas` **no** lo traen al primero.
- **[AC-7]** Filtro `faltan` y `missing`.
  - Given: un evento al que le falta cada campo por separado (imagen, hora, precio `unknown`, descripción nula **y** vacía, dirección, coordenadas, lugar) y uno completo.
  - Then: `faltan=<campo>` trae solo los que lo tienen faltante; `faltan=imagen,hora` es unión; `lugar` solo si no hay lugar vinculado **y** tampoco `venue_name`, dirección ni coordenadas efectivas (un evento con `venue_name` pero sin lugar vinculado **no** es `lugar`); el evento completo tiene `missing: []`; `missing` viene completo y en el orden de `EventMissingField` aunque no se filtre.
- **[AC-8]** Búsqueda `q`.
  - Given: títulos con tildes y mayúsculas, una sede, una dirección y una fuente distintas.
  - When: `q=ciclon` encuentra «Ciclón»; `q` por sede, por dirección y por nombre de fuente.
  - Then: coincidencia normalizada (sin tildes ni mayúsculas) sobre título, sede, dirección y fuente. `q=%` y `q=_` se tratan como texto literal (no como comodines) y no traen todo.
- **[AC-9]** Orden fijo y paginación estable.
  - Given: eventos mezclados (vigentes, pasados, `sin_ver`; con y sin hora; misma fecha y título).
  - Then: primero los `vigente`, después `pasado` y `sin_ver`; dentro de cada grupo `start_date`, `start_time` (sin hora al final), título normalizado, `id`. Con `per_page=2`, recorrer todas las páginas devuelve cada evento exactamente una vez y en el mismo orden que `per_page=100`.
- **[AC-10]** Paginación y límites.
  - When: `page=2&per_page=2` con 5 eventos; `page=99`; `per_page=100`; `per_page=101`; `per_page=0`; `page=0`; `page=abc`.
  - Then: página 2 trae la 3.ª y 4.ª fila con `X-Page: 2`, `X-Per-Page: 2`, `X-Total-Count: 5`; `page=99` es 200 con `data: []` y `X-Total-Count: 5`; `per_page=100` es válido; los otros cuatro son 400 con `{ success: false, error: <string> }`.
- **[AC-11]** Validación de filtros.
  - When: `estado=otro`, `faltan=foto`, `tier=x`, `q` de 101 caracteres, `fuente` con más de 20 valores, `estado=` vacío.
  - Then: 400 con envelope de error en los cinco primeros casos; `estado=` vacío (y un `faltan=` o `fuente=` vacío) equivale a no filtrar y es 200.
- **[AC-12]** Fuentes del evento.
  - Given: un evento con fuente primaria y dos alias en `event_sources`, uno con la misma URL que otro `via_json`.
  - Then: `sources[0]` es la primaria, `source_name`/`source_tier` coinciden con ella, las demás van después sin repetir URL; es la misma regla que `getEvent.sources` (una sola función compartida, no dos copias).
- **[AC-13]** Catálogo vacío.
  - Given: tablas vacías.
  - Then: 200, `data: []`, `X-Total-Count: 0`.
- **[AC-14]** Solo lectura y sin colisión de rutas.
  - Then: `GET /api/events/sources` responde `listEventSources` (no cae en `getEvent` con `id = "sources"` ni da 400 de UUID); `POST`, `PUT`, `PATCH` y `DELETE` sobre `/api/events` y `/api/places` no existen (404 con envelope).

### listEventSources

- **[AC-15]** Conteo por fuente.
  - Given: 5 eventos de la fuente A (uno pasado y uno `sin_ver`) y 2 de la fuente B.
  - Then: 200 con `[{name: A, tier, count: 5}, {name: B, tier, count: 2}]` ordenado por `name`; cuenta todos los estados; con tablas vacías, `[]`. `tier` es el de la fuente primaria de sus eventos (si una misma `source_name` aparece con dos tiers, una fila por par `name`+`tier`).

### listPlaces

- **[AC-16]** Camino feliz y forma.
  - Given: 3 lugares (uno OSM, dos curados).
  - When: `GET /api/places`.
  - Then: 200 con los 3, cada uno válido contra `CurationPlace` con todas las claves presentes, `has_opening_hours` booleano, y los tres headers de paginación. Un lugar sin visitas recientes (sin tope de vencimiento) sigue apareciendo.
- **[AC-17]** Filtros `origen` y `tipo`.
  - When: `origen=osm`; `origen=curated,osm`; `tipo=bar,cafe`; combinados.
  - Then: unión dentro de cada filtro, intersección entre filtros; `X-Total-Count` es el filtrado.
- **[AC-18]** Filtro `faltan` y `missing`.
  - Given: lugares a los que les falta cada campo por separado y uno completo; uno con `hours_text` pero sin `opening_hours`.
  - Then: `faltan=<campo>` trae solo los que lo tienen faltante; `horario` incluye al que solo tiene `hours_text`; `cocina` es `cuisine` vacío; unión entre varios; el completo tiene `missing: []`; `missing` viene completo y en el orden de `PlaceMissingField`.
- **[AC-19]** Búsqueda, orden y paginación.
  - Then: `q` normalizada sobre nombre y dirección (comodines literales, como en `[AC-8]`); orden por nombre normalizado e `id` de desempate; recorrer todas las páginas devuelve cada lugar una vez; mismos límites y 400 que `[AC-10]` y `[AC-11]` (valores inválidos de `origen`, `tipo`, `faltan`).
- **[AC-20]** Catálogo vacío.
  - Then: 200, `data: []`, `X-Total-Count: 0`.
- **[AC-21]** **[D1 real]** Las queries con `JOIN` corren contra D1 con las migraciones aplicadas (`@cloudflare/vitest-pool-workers`, como `detail.d1.test.ts`): `listEvents` con `place_keys`/`places` y `event_sources`, con y sin filtros, `q` con caracteres especiales, y `listPlaces` con todos los filtros a la vez. El resultado coincide con el de los tests de `[AC-1]`–`[AC-20]`.

### Web: rutas, indexación y estado

- **[AC-22]** Rutas.
  - Then: `/curacion/eventos` y `/curacion/lugares` existen, con carga diferida, **antes** del catch-all del router; `/curacion` redirige a `/curacion/eventos`. Ningún componente enlaza a ellas (ni home, ni `TabBar`, ni los resultados) y en estas rutas no se muestra el `TabBar`.
- **[AC-23]** No indexable.
  - Then: `apps/web/public/_headers` contiene la regla `/curacion/*` con `X-Robots-Tag: noindex, nofollow` (test que lee el archivo); el router pone `<meta name="robots" content="noindex, nofollow">` al entrar a una ruta `/curacion/*` y lo quita al salir a otra; el sitio público no lo tiene.
- **[AC-24]** Filtros en la URL.
  - Given: `/curacion/eventos?fuente=muni&estado=pasado&faltan=imagen,hora&q=tango&page=3`.
  - Then: al cargar, los controles reflejan esos valores y el request al API lleva los mismos parámetros; cambiar cualquier filtro o `q` vuelve a `page=1`; cada cambio es una entrada del historial (Atrás restaura); el botón Atrás no deja la lista a medio cargar. Un valor inválido en la URL se ignora (no rompe la pantalla).
- **[AC-25]** Pinia: `loading`, `error` y carreras.
  - Then: el store de curación (uno por entidad o uno con dos listas) tiene `loading` y `error` siempre; una respuesta tardía de una consulta anterior no pisa a la nueva (AbortController, como `search.store.ts`); un fallo deja `error` con un texto legible y conserva la última página buena; «Reintentar» repite la consulta.
- **[AC-26]** Estados de pantalla.
  - Then: cargando (esqueleto); sin resultados con filtros activos (mensaje y «Limpiar filtros» que deja la URL sin filtros); error con «Reintentar»; catálogo vacío (total 0 **sin** filtros) con mensaje distinto. Cada estado se anuncia a lector de pantalla (`aria-live`).
- **[AC-27]** Filas y columnas.
  - Then: eventos y lugares muestran las columnas de C-5; el título/nombre abre `/e/:id` o `/l/:id` en pestaña nueva (`target="_blank"`, `rel="noopener"`); los `pasado` y `sin_ver` van atenuados **y** con etiqueta de estado (no solo color, AA); «Visto» = «hoy» o «N d» según `last_seen_at` en hora de Buenos Aires; «Fuente» = primaria + «+N vías» si `sources.length > 1`; «Faltan» muestra una etiqueta por cada `missing`; un evento sin lugar efectivo muestra «— sin lugar».
- **[AC-28]** Cartel de entorno.
  - Then: fijo arriba en las dos pestañas, con el texto de `VITE_ENV_LABEL` («staging» en el build de staging); sin la variable dice «producción».

### Web: exportación CSV

- **[AC-29]** Alcance y conteo.
  - Given: un filtro activo con 312 resultados y `per_page=100`.
  - When: «Exportar CSV (312)».
  - Then: el botón muestra `X-Total-Count`; el export pide las páginas 1 a 4 con **los mismos filtros** y `per_page=100`, y escribe 312 filas más la cabecera, no solo la página visible; mientras corre muestra progreso y se puede cancelar; descarga con el nombre de C-17.
- **[AC-30]** Fallo a mitad de camino.
  - Given: la página 3 falla.
  - Then: no se descarga un archivo parcial; se muestra el error con «Reintentar»; la lista visible no cambia.
- **[AC-31]** Formato y seguridad del CSV.
  - Then: UTF-8 con BOM, separador `;`, `CRLF`; las celdas con `;`, comillas, saltos de línea o espacios al inicio van entre comillas dobles con las comillas duplicadas; las listas (intenciones, géneros, ofrece, cocina, faltantes, vías) se unen con ` | `; una celda que empieza con `=`, `+`, `-`, `@`, tab o `CR` sale prefijada con `'` (por ejemplo un título `=HYPERLINK("http://x","clic")`); los `null` salen vacíos. La cabecera lleva los nombres de columna de la pantalla.

### Manual

- **[AC-32]** **[Manual]** Con el slice en staging: abrir las dos rutas en escritorio y móvil (tarjetas), probar cada filtro, la URL compartida, el CSV abierto en Excel (acentos y columnas) y confirmar que `curl -I` a `/curacion/eventos` trae `x-robots-tag: noindex, nofollow`. QA visual con capturas vía el subagente `qa-visual`, claro y oscuro.

## No hace este slice

Edición o curación manual (es otro slice: hoy un reenvío de la ingesta pisa cualquier cambio); login o roles; ordenar por encabezado; el aviso ⚠ de coordenadas derivadas; detalle en panel lateral; limitar por IP o rate limit (la API no tiene hoy, ver abajo).

## Plan de tareas (`/apply`)

1. `npm run generate:schemas` (regenera `schemas.ts` y `types.ts`; nunca a mano). Sin migración: los campos ya existen.
2. **RED API:** tests de `apps/api` con D1 de test (`[AC-1]`–`[AC-20]`) y un test contra D1 real (`[AC-21]`), citando `[AC-N]`. Nuevo archivo de query params en `lib/query-schemas.ts` (`csv` ya existe), con las reglas de `[AC-10]`/`[AC-11]`.
3. **GREEN API:** `db/curation.repo.ts` (`listEvents`, `listEventSources`, `listPlaces`; paginación `LIMIT/OFFSET` en SQL, estado y faltantes calculados en SQL para poder filtrar y paginar, y los campos `missing` armados por una función pura que comparte la definición con el SQL); `routes/curation.ts` o rutas en `events.ts`/`places.ts` (el `/sources` va **antes** de `/:id`); extraer a una función compartida el armado de `sources` de `getEventDetail` para que no haya dos copias (`[AC-12]`). Headers `X-Total-Count`/`X-Page`/`X-Per-Page` ya están expuestos en CORS.
4. **RED web:** tests de `lib` (`curacionQuery` ⇄ URL, `visto`, `csv` con fórmulas y escapes), del store (carreras, error, reintento), de `api.test.ts` (los tres endpoints) y de vista (estados, columnas, cartel), citando `[AC-N]`.
5. **GREEN web:** `apps/web/public/_headers` (nuevo); `router/index.ts` con las rutas antes del catch-all, `meta.noindex` y el manejo de `<meta name="robots">` en el `afterEach`; `services/api.ts` (`listEvents`, `listPlaces`, `listEventSources`); `stores/curation.store.ts`; `views/CuracionEventosView.vue`, `CuracionLugaresView.vue` y componentes chicos (cabecera con pestañas, filtros, tabla/tarjetas, estados); `App.vue` oculta `TabBar` con `meta.hideTabBar`.
6. **Cierre:** `/verify`; smoke local contra `wrangler dev` de los tres endpoints (las queries hacen `JOIN`, Paso 4.5 de `/verify`); `/code-review` estándar sobre el diff; `/qa-visual` con capturas contra staging.
7. **Post-merge:** el deploy a staging es automático (el filtro de paths incluye `apps/web/public/`); verificar `_headers` con `curl -I`. Producción es manual (`deploy-production.yml`) y **no** se publica hasta que el owner confirme que las rutas pueden vivir ahí.

## Pendiente de otros slices

- **Edición de contenido** por los voluntarios: requiere identidad, una tabla de ediciones que no pise la ingesta y reglas de precedencia entre ingesta y curación. No empezar sin su propio `/enrich-us`.
- **Lugares curados sin coordenadas** (hoy 4 en `ingestion/data/venues.json`): no aparecen en el listado ni en el sitio. Si el equipo necesita verlos, hace falta que la ingesta los publique con una marca de «coordenadas pendientes», lo que cambia el contrato de `ingestBatch` y `PlaceDetail` (`lat`/`lon` son requeridos).
- **Rate limit y caché** de la API pública: no hay hoy. Estos endpoints son baratos (`LIMIT` ≤ 100, sin autenticación, datos ya públicos), pero un CSV recorre decenas de páginas; si se vuelve un problema, va a un slice de endurecimiento común a toda la API.
- **Producción:** depende del slice 5 (conectar producción) y de la decisión del owner sobre exponer estas rutas allí.
- **Documentación vieja:** `docs/data-model.md` (que `CLAUDE.md` menciona) no existe; `CLAUDE.md` dice «11 fuentes» y son 10 de eventos más noticias. `place_aliases` en `sitio-publico-busqueda.md` ya se corrigió a `place_keys` en este PR; lo de `CLAUDE.md` queda fuera de `docs/` (el `/ff` solo toca `docs/`).
