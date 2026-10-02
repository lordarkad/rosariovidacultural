# Sitio público de búsqueda — decisiones del enriquecimiento

- **Fecha:** 2026-09-30
- **Origen:** `/enrich-us` sobre `wireframes/*.html` (Figma Make `en5jOAjdZvfWxOggie0jUt`)
- **Estado:** decisiones de diseño (§B) resueltas por el tech lead; edge cases (§A) resueltos en E-1 a E-12; gaps de contrato (§D) resueltos. ADR 0002 aceptado el 2026-09-30. Slice 1 especificado por `/ff` (AC-1 a AC-39, al final de este archivo).

## Corte en slices

1. **Catálogo y búsqueda** — modelo de datos, endpoint de ingesta, `GET` de búsqueda y de detalle, zonas.
2. **Sitio público** — Home, Zona (3 modos), Resultados, Detalle y estados.
3. **Plan en secuencia** — slice aparte (ver B-4). Fuera de los dos primeros.

## Decisiones resueltas

| # | Decisión | Resolución |
|---|---|---|
| B-1 | Modelo de contenido | **Evento + Lugar** (estándar de la industria: schema.org `Event.location → Place`, Eventbrite/Songkick `Event + Venue`). Un solo concepto de lugar con tipo (restaurante, bar, café, heladería, sala…). «Sede de eventos» se **deduce** (tiene eventos asociados), no es un tipo. `offers` (música en vivo, cena, baile) es un atributo opcional del lugar. Curado a mano u OSM es un campo de **origen**, no una clase. El evento apunta opcionalmente a un lugar y conserva el texto de sede y la dirección cuando no se resuelve. |
| B-1b | Etiquetas en pantalla | Solo **EVENTO** y **LUGAR**. Se quita ESPACIO del wireframe y del preset (`type-espacio`). |
| B-2 | Lugares de OSM en Resultados | **Sí**, para las intenciones Comer y Tomar algo. Sin horario se muestra «horario no informado» (131 de 735 lo tienen). |
| B-3 | Mapeo de intenciones | **Reclasificar en la ingesta**: las intenciones son la taxonomía y la ingesta las asigna (`intents[]` por evento y por lugar), incluido el import de OSM. Implica reescribir el clasificador de los scrapers en Python. |
| B-4 | Plan en secuencia | Slice aparte. En los primeros slices el toggle queda fuera o deshabilitado. |
| B-5 | Dónde se busca | **Endpoint en el servidor** (Worker + D1): filtros, distancia (bounding box + Haversine) y paginación. |
| B-6 | Zonas | Lista fija de barrios y localidades con **centro y radio**. |
| B-7 | Mapa | **OpenStreetMap** con MapLibre o Leaflet. Atribución ODbL visible. Autocomplete de barrio desde la lista de zonas. |
| B-8 | Cómo llegar | Deep link a la app de mapas del dispositivo. Los «min a pie» son una estimación en línea recta a velocidad fija. |
| B-9 | Orden | Por franja horaria y, dentro de cada franja, por distancia. |
| B-10 | Bottom sheet | Componente propio en `@triptongo/ui`, con arrastre y alturas intermedias. |
| B-11 | Modo oscuro | **Claro y oscuro desde el inicio.** |
| B-12 | Cuenta y favoritos | Fuera. Se quitan «Entrar» y «Favoritos» del wireframe desktop. |
| D-2 | Dirección visual | **B · Ribera** (ver `docs/DESIGN.md`). |
| D-4 | Tab bar mobile | **Buscar, Zona, Resultados.** Detalle no es una tab: se abre desde un resultado y vuelve con «atrás». Se aplica de forma coherente en todas las pantallas. |

## Cambios aplicados en los wireframes (2026-09-30)

- Sin etiqueta ESPACIO: `LUGAR` y `EVENTO` solamente, en Resultados y Detalle.
- Tab bar de 3 tabs (Buscar, Zona, Resultados), consistente en todas las pantallas mobile, incluido Detalle.
- Sin «Entrar» ni «Favoritos» en el header desktop de Home.
- Home: el toggle «Plan en secuencia» queda deshabilitado.
- Atribución «© OpenStreetMap» en las pantallas con mapa.

## Edge cases: reglas resueltas (§A del enriquecimiento)

Aprobadas por el tech lead el 2026-09-30.

| # | Caso | Regla |
|---|---|---|
| E-1 | Eventos sin coordenadas (83 de 363) | Se buscan por texto de sede o zona, sin distancia ni pin. Si hay lugar vinculado, hereda sus coordenadas. Van al final de su franja, con «ubicación no informada». |
| E-2 | Varias sedes | Se ingiere un evento por sede, con el mismo `source_url`. El Detalle los agrupa («También en…»). |
| E-3 | Rango largo (64) | Un evento aparece **siempre que su rango de fechas se superponga con la ventana buscada**. Si dura más de 7 días va en la franja «En cartel» (fuera de Ahora y Esta noche); si dura 7 días o menos, entra en la franja del horario del día consultado. |
| E-4 | Sin horario (147 de 363) | Aparecen solo en «Hoy» y «Finde», en la franja «Horario a confirmar» al final, con «horario no informado». Nunca en «Ahora». |
| E-5 | Medianoche y zona horaria | La base guarda UTC. Franjas, «Hoy», «Ahora» y «Finde» se calculan en `America/Argentina/Buenos_Aires` (UTC-3, sin horario de verano). Un evento a las 00:30 cuenta como la noche del día anterior; «Esta noche» llega hasta las 06:00. |
| E-6 | Precio | Tres estados: `free` (etiqueta GRATIS), `paid` (precio en ARS), `unknown` («precio no informado» en el Detalle, sin etiqueta). El filtro «Gratis» trae solo `free`. |
| E-7 | Intenciones parciales | Con varias intenciones activas, unión (cualquiera), ordenada primero por cantidad de coincidencias. Los subtipos de música filtran dentro de «Música en vivo». |
| E-8 | Radio máximo vs. localidades | El máximo de 10 km aplica a Cerca mío y Mapa. Las zonas (Funes, Roldán…) usan su propio radio fijo. |
| E-9 | Frescura | Cada ítem guarda `last_seen_at`. **Solo eventos:** más de 36 h, el Detalle avisa «datos de ayer»; más de 7 días, sale de los resultados. **Los lugares no vencen** (decisión del tech lead, 2026-09-30: son negocios de larga vida y se importan poco). |
| E-10 | Duplicados | Clave: título normalizado + fecha + lugar. (Operativa en F-11.) Fuente primaria, en orden: curado a mano, fuente oficial, agregador. En lugares, el curado pisa a OSM. |
| E-11 | Mapa sin GPS | Las distancias se miden desde el centro de la zona o el pin elegido, no desde «mi ubicación». |
| E-12 | URL y atrás | Filtros en query params (`?i=comer&cuando=hoy&z=pichincha`). El Detalle tiene URL propia (`/e/:id`, `/l/:id`). «Atrás» vuelve a Resultados con scroll y filtros intactos. |

**Trabajo real de la ingesta:** vincular eventos con lugares (hoy 5 de 363 eventos tienen `venue_id`) y evitar duplicados entre lugares curados y de OSM.

## Gaps del contrato: resueltos (§D)

Aprobados por el tech lead el 2026-09-30.

| # | Gap | Resolución |
|---|---|---|
| D-7 | Paginación | 20 ítems por página con «Ver más». Máximo 100 pins en el mapa; por encima se agrupan (cluster). |
| D-8 | Formato es-AR | Distancia «850 m» o «1,2 km» (coma decimal). Precio «$ 12.000» (punto de miles). Fecha «mié 1 oct», hora de 24 h («21:30»). |
| D-9 | Privacidad de la ubicación | No se guarda nada en el servidor. El GPS se usa solo en el navegador; las coordenadas viajan en la request y no se loguean. El aviso es una línea al pedir el permiso. |
| D-13 | Criterios de aceptación | (1) «¿Qué hay en Funes hoy?» muestra eventos y lugares de Funes. (2) Sin GPS, el modo mapa usa el pin y las distancias salen de ahí (E-11). (3) Un evento sin horario aparece solo en «Horario a confirmar» (E-4). (4) Una fuente con más de 36 h muestra «datos de ayer» (E-9). |

## Notas para el spec (no cambian el contrato de la API)

- D-1 Arquetipo de página (`docs/12-page-archetypes.md`): listado con filtros + detalle, con el mapa como variante.
- D-5 Copy de estados y avisos: a redactar al implementar la UI.
- D-6 Accesibilidad: objetivo WCAG 2.2 AA; definir foco del bottom sheet, equivalente no visual del mapa y `prefers-reduced-motion`.
- D-10 Atribución: «© OpenStreetMap» visible en cada mapa (ya está en los wireframes); link a la fuente original siempre visible en el Detalle.
- D-11 Presupuesto de rendimiento mobile (LCP, peso de página): fijar al implementar.
- D-12 SEO: el Detalle tiene URL propia (E-12).

## Fuera de este slice

- D-3 Wireframe del panel admin: no existe, va en otro slice.

---

# AC — Slice 1: Catálogo y búsqueda

- **Fecha:** 2026-09-30 · **Contrato:** `docs/api-spec.yml` v0.2.0 · **Operaciones:** `listZones`, `searchItems`, `searchPins`, `getEvent`, `getPlace`, `ingestBatch`
- Los tests referencian cada AC por nombre (`[AC-N]`). Reloj fijo en los tests de franjas (`America/Argentina/Buenos_Aires`).
- Las reglas de ventana, franja y orden viven en la descripción de `searchItems` del spec; los AC las prueban.

## Decisiones tomadas en este `/ff` (a confirmar al revisar el spec PR)

| # | Decisión | Por qué |
|---|---|---|
| F-1 | **Lote de ingesta parcial y solo-upsert** (cierra el pendiente del ADR 0002): estructura inválida = 400 entero; ítems inválidos = `rejected` y el resto se guarda; nunca borra por ausencia. Máx. 200 eventos y 200 lugares por lote, con `D1.batch()`. | Una fuente caída o un ítem roto no vacían ni frenan el catálogo. El tope evita superar el límite de consultas de D1 por invocación. |
| F-2 | Paginación: `data` es el array; el total va en headers `X-Total-Count`, `X-Page`, `X-Per-Page`. | El envelope no admite `meta` y el playbook no define otra convención. |
| F-3 | Pins en endpoint aparte (`/search/pins`), máx. 100, `bbox` opcional y `X-Truncated`; `X-Total-Count` cuenta dentro del `bbox`. Reinterpreta D-7: el cliente acota por viewport en vez de clusterizar en el servidor. | Evita un agrupador en el Worker. |
| F-4 | «Gratis» es el parámetro booleano `gratis`, no una intención del enum. | E-6 lo define como filtro de precio. |
| F-5 | Franjas (`band`): `ahora`, `hoy`, `esta_noche`, `manana`, `proximos`, `en_cartel`, `a_confirmar`, con límites definidos en el spec (día de 06:00 a 06:00, `esta_noche` desde las 20:00, `ahora` = empezó hace ≤2 h o empieza en ≤1 h). `hoy` y `proximos` son nuevas respecto de los wireframes. | Cubren `finde` y `fecha`, y evitan contar dos veces el evento de 00:30. |
| F-6 | La ingesta estructura el horario de OSM en `opening_hours`; el servidor calcula `open_now`. | Parsear `opening_hours` de OSM en el Worker es frágil. |
| F-7 | Sin `z` ni `lat`/`lon` la búsqueda es de toda la ciudad, sin distancia. | Soporta el primer uso sin ubicación. |
| F-8 | **Los lugares no vencen** (decisión del tech lead, 2026-09-30): E-9 aplica solo a eventos; sin `is_stale` en lugares. | Son negocios que suelen seguir abiertos; OSM y curados se importan poco. |
| F-9 | **Franja de lugares** (decisión del tech lead): abierto ahora → `ahora`; abre más tarde hoy → `hoy` o `esta_noche`; sin horario → `a_confirmar`; ya cerró por hoy → no aparece en `hoy`. | Mismo criterio que para eventos. |
| F-10 | Orden completo: franja → con ubicación primero → más intenciones coincidentes → distancia → hora de inicio → título/nombre normalizado → `id`. | B-9, E-1 y E-7 por separado eran ambiguas combinadas; el `id` hace estable la paginación. |
| F-11 | Dedupe de eventos por título normalizado + `start_date` + (lugar resuelto, o `venue_name`, o `address`); sin ninguno no se deduplica. Lugares curado/OSM equivalentes: mismo nombre normalizado a ≤50 m. | Hace operativa E-10 sin fusionar sedes distintas (E-2). |
| F-12 | `source_key` único globalmente con prefijo `<fuente>:`; en un lote se procesan primero los lugares; `place_source_key` se resuelve al leer. | Un evento de una fuente puede referenciar un lugar de otra. |
| F-13 | `IngestEvent` trae `source_url` (+ `via` opcional); nombre y prioridad de la fuente salen del lote. | Evita la fuente duplicada y contradictoria. |
| F-14 | Un rango de 2 a 7 días repite `start_time` cada día; `finde` arranca en `max(viernes 18:00, ahora)`; «hoy» es el día de negocio; `ahora` para un lugar es `open_now = true` y que la ventana incluya el momento actual. | Cierra los bordes que dejaba la definición de franjas. |
| F-15 | Al fusionar, la fila existente conserva su `id` y los absorbidos resuelven al vigente; un alias reenviado solo actualiza `last_seen_at`. Presupuesto de ≤10 llamadas a D1 por request. | Los links compartidos no se rompen y el curado no lo pisa OSM. |

Nota: E-4 se mantiene literal (sin horario solo en `hoy` y `finde`); con `manana` o `fecha` esos eventos no aparecen. Si se prefiere mostrarlos también ahí, es un cambio de E-4.

## listZones: lista de zonas

**AC-1:** Camino feliz
- Given: zonas sembradas por migración (8 barrios y 5 localidades del wireframe)
- When: `GET /api/zones`
- Then: 200 `{ success: true, data: [...] }`; cada zona con `id` (slug), `name`, `kind`, `lat`, `lon`, `radius_m`; `funes` y `pichincha` presentes.

## searchItems: búsqueda

**AC-2:** Camino feliz por zona (criterio D-13 (1))
- Given: un evento y un lugar dentro del radio de `funes`, y otros fuera
- When: `GET /api/search?z=funes&cuando=hoy`
- Then: 200; `data` trae solo ítems de Funes con ubicación dentro del radio, de `kind` `event` y `place`; los `location_known: false` no aparecen; `X-Total-Count` coincide.

**AC-3:** Origen por coordenadas y distancias (E-11, criterio D-13 (2))
- When: `GET /api/search?lat=-32.94&lon=-60.65&radio_m=1000`, sin pasar por GPS (las coordenadas son las del pin)
- Then: 200; cada ítem con ubicación trae `distance_m` ≤ 1000 medido desde ese punto, y `walk_minutes` = `ceil(distance_m / 80)`. Con `z` y `radio_m` juntos, `radio_m` se ignora y vale el radio de la zona (E-8).

**AC-4:** Sin origen
- When: `GET /api/search?cuando=hoy`
- Then: 200; `distance_m` y `walk_minutes` son `null` en todos. Dentro de una franja, eventos y lugares se ordenan juntos por hora de inicio (evento: su primera ocurrencia; lugar: su primer momento abierto), los sin hora al final, y luego por título o nombre normalizado y por `id`. Ejemplo: un evento a las 22:00 y un lugar que abre a las 21:00, ambos `esta_noche`, salen primero el lugar y después el evento.

**AC-5:** Parámetros inválidos
- When: `?z=funes&lat=-32.9&lon=-60.6`, o `?lat=-32.9` sin `lon`, o `?cuando=fecha` sin `fecha`, o `radio_m=20000`, o `per_page=101`, o `cuando=fecha&fecha=<ayer>`
- Then: 400 `{ success: false, error: <string> }`.

**AC-6:** Zona inexistente
- When: `GET /api/search?z=no-existe`
- Then: 404 con envelope de error.

**AC-7:** Orden completo (F-10)
- Given: ítems en varias franjas; dentro de una franja, uno con 1 intención coincidente a 2 km, otro con 2 coincidentes a 3 km, dos a igual distancia con distinta hora de inicio, y dos con todo igual (misma hora y título); y en `en_cartel`, dos eventos de 30 días con `start_time` 10:00 y 22:00 más uno sin horario
- When: `?i=comer,bailar&lat=..&lon=..`
- Then: franjas en el orden `ahora`, `hoy`, `esta_noche`, `manana`, `proximos`, `en_cartel`, `a_confirmar`; dentro de cada una: más coincidencias primero, luego `distance_m` ascendente, luego hora de inicio, luego título normalizado, y el empate final por `id` ascendente. En `en_cartel` la hora de inicio es el `start_time` (10:00, 22:00, sin horario al final). El «con ubicación primero» se prueba en AC-14 (sin origen). Recorrer las páginas 1 y 2 no repite ni saltea ítems.

**AC-8:** Franjas de un evento con horario y límites de ventana
- Given: reloj fijo en un martes a las 21:00
- When: `cuando=hoy` para los de hoy, `cuando=manana` para el de mañana y `cuando=fecha&fecha=<martes+3>` para el último
- Then: uno que empezó a las 19:30 va en `ahora`; uno a las 21:30 en `ahora`; uno a las 23:00 en `esta_noche`; uno que empezó a las 18:00 no aparece; uno mañana 12:00 va en `manana`; uno dentro de 3 días va en `proximos`.

**AC-9:** Medianoche y zona horaria (E-5)
- Given: evento ingerido con `start_date` D+1 y `start_time` 00:30 (hora local); reloj en la noche del día D
- Then: con `cuando=hoy` aparece en `esta_noche`; con `cuando=manana` no aparece; con `cuando=fecha&fecha=D+1` tampoco. El instante se guarda en UTC (03:30Z) y se reconvierte a hora local.

**AC-10:** Rango largo (E-3)
- Given: un evento de 30 días que incluye hoy, uno de 8 días inclusivos, uno de exactamente 7 días inclusivos, todos con horario
- Then: los de 30 y 8 días van en `en_cartel`, y no aparecen con `cuando=ahora`; el de 7 días va en la franja de su horario.

**AC-10b:** Rango de varios días con horario (el horario se repite cada día)
- Given: evento de 5 días con `start_time` 10:00; reloj en el día 2 a las 15:00
- Then: con `cuando=hoy` no aparece (la ocurrencia de hoy empezó hace 5 h); con `cuando=manana` aparece en `manana` (ocurrencia del día 3). Con el reloj en el último día a las 15:00 no aparece con `hoy`. Con el reloj en el día 2 a las 10:30 aparece en `ahora`.

**AC-11:** Sin horario (E-4)
- Given: evento con `start_time` null
- Then: con `cuando=hoy` y con `finde` aparece en `a_confirmar`, al final, con `start_time: null`; con `cuando=ahora`, `manana` o `fecha` no aparece.

**AC-12:** Precedencia entre E-3 y E-4
- Given: evento de 10 días sin horario que incluye hoy
- Then: va en `en_cartel` (no en `a_confirmar`), aparece con `hoy`, `manana` y `fecha` dentro de su rango, y no con `ahora`.

**AC-13:** Ventana `manana` y `fecha`
- When: `?cuando=manana` y `?cuando=fecha&fecha=2026-10-03`
- Then: solo eventos cuyo día de negocio (06:00 a 06:00) es ese. `fecha` igual a hoy se comporta como `hoy` (un evento que empezó hace más de 2 h no aparece); con `cuando` distinto de `fecha`, el parámetro `fecha` se ignora.
- Con `cuando=finde`: viernes 15:00, la ventana arranca a las 18:00; viernes 21:00, arranca a las 21:00 y un lugar que abre solo los viernes de 12:00 a 19:00 no aparece, mientras que uno que abre todos los días de 12:00 a 19:00 aparece en `manana` por su apertura del sábado; lunes 02:00 sigue siendo domingo y la ventana llega hasta las 06:00; el lunes a las 06:00 y el martes la ventana es la del viernes 18:00 próximo hasta el lunes 06:00 siguiente (200, con los eventos de ese fin de semana).

**AC-14:** Sin ubicación (E-1)
- Given: evento sin coordenadas y sin lugar vinculado, buscando sin origen (con origen no entra, AC-2)
- Then: aparece con `location_known: false`, `distance_m: null`, al final de su franja, y no aparece en `searchPins`.

**AC-15:** Precio (E-6)
- Then: los tres `price_status` se devuelven tal cual; `gratis=true` trae solo `free`, nunca `unknown`. Los lugares devuelven siempre `price_status: unknown`, así que `gratis=true` no trae ningún lugar.

**AC-16:** Intenciones y música (E-7)
- When: `?i=comer,bailar`
- Then: unión; los que cumplen ambas van antes que los que cumplen una (dentro de la franja). `?musica=jazz` sin `musica_en_vivo` se ignora; con ella, filtra solo a los que coinciden por `musica_en_vivo`: con `?i=comer,musica_en_vivo&musica=jazz`, un restaurante que coincide por `comer` sigue, un evento de rock no, y un lugar con `musica_en_vivo` (sin géneros) no cuenta como coincidencia de esa intención.

**AC-17:** Lugares: franja y `open_now` (F-9)
- Given: reloj fijo a las 21:00; lugar abierto hasta las 23:00, lugar que abre a las 21:30, lugar que abre a las 22:30, lugar que cerró a las 20:00, y lugar con `opening_hours: null`
- Then: el primero `ahora` con `open_now: true` y `place_kind` presente; el segundo y el tercero `esta_noche` con `open_now: false` (`ahora` solo si `open_now: true`, aunque abra dentro de la próxima hora); el cuarto no aparece con `cuando=hoy`; el quinto `a_confirmar` con `open_now: null`, y no aparece con `cuando=ahora`. Con `cuando=ahora` solo aparecen los lugares con `open_now: true`. Con `cuando=manana`, un lugar abierto ahora que también abre mañana va en `manana`, no en `ahora`. Un lugar con `opening_hours: []` se rechaza en la ingesta (`invalid_opening_hours`, ver AC-34). Un lugar con un período `opens == closes` (ej. `00:00`–`00:00`, OSM `24/7`) está abierto 24 h: `open_now: true` y `ahora` a cualquier hora.

**AC-18:** Paginación (D-7)
- When: `?per_page=20&page=2` con 45 resultados
- Then: 20 ítems; `X-Total-Count: 45`, `X-Page: 2`, `X-Per-Page: 20`.

**AC-19:** Vencimiento de eventos (E-9)
- Given: un evento sin verse hace más de 7 días, y un lugar sin verse hace 60 días
- Then: el evento no aparece; el lugar sí (los lugares no vencen, F-8).

**AC-20:** Texto libre
- When: `?q=teatro` (máx. 100 caracteres)
- Then: solo ítems cuyo título, lugar o dirección contienen «teatro» (sin distinguir mayúsculas ni tildes). `q` de 101 caracteres es 400.

**AC-21:** Sin resultados
- Then: 200 con `data: []` y `X-Total-Count: 0` (nunca 404).

## searchPins: pins del mapa

**AC-22:** Camino feliz y tope
- Given: 130 ítems con coordenadas en la búsqueda
- Then: 200; `data` con 100 pins, en el mismo orden que la lista; `X-Total-Count: 130`, `X-Truncated: true`.

**AC-23:** `bbox`
- When: se agrega un `bbox` que contiene 12 de los 130
- Then: 12 pins, `X-Total-Count: 12`, `X-Truncated: false`. Un `bbox` mal formado o con min mayor que max es 400.

## getEvent / getPlace: detalle

**AC-24:** Detalle de evento
- When: `GET /api/events/{id}`
- Then: 200; trae `sources` (la primera es la primaria, siempre presente), `place` (o `null`) y `is_stale`. `also_at` no incluye hermanos vencidos (E-9).

**AC-25:** Datos viejos (E-9, criterio D-13 (4))
- Given: `last_seen_at` de un evento de hace 40 h
- Then: `is_stale: true`; con 10 h, `false`.

**AC-26:** Inexistente, vencido o inválido
- When: `id` UUID que no existe, o evento con más de 7 días sin verse
- Then: 404 con envelope de error. Un `id` que no es UUID, o `lat` sin `lon`, es 400. Un lugar con 60 días sin verse sigue respondiendo 200.

**AC-27:** Distancia en el detalle
- When: `GET /api/events/{id}?lat=..&lon=..`
- Then: `distance_m` y `walk_minutes` calculados; sin `lat`/`lon` son `null`.

**AC-28:** Detalle de lugar
- When: `GET /api/places/{id}`
- Then: 200; `location_known: true`, `opening_hours`/`hours_text`/`open_now` según los datos, sin `is_stale`, y `upcoming_events` (máx. 20, próximos primero, sin los que ya pasaron ni los vencidos, así ningún link da 404).

## ingestBatch: ingesta

**AC-29:** Camino feliz
- Given: token válido; lote con 2 eventos y 1 lugar válidos
- When: `POST /api/ingest`
- Then: 200; `events.created: 2`, `places.created: 1`, `rejected: []`; los ítems quedan con `last_seen_at` = ahora y se ven en `searchItems`.

**AC-30:** Idempotencia
- When: se reenvía el mismo lote
- Then: 200; `created: 0`, `updated` igual al total; no hay filas duplicadas.

**AC-31:** Sin token o token inválido
- When: sin `Authorization`, o con un token distinto de `INGEST_TOKEN`
- Then: 401 con envelope de error; no se guarda nada.

**AC-32:** Estructura inválida o lote excedido
- When: falta `source`, o `events` tiene 201 ítems, o el JSON no es un objeto
- Then: 400; no se guarda nada.

**AC-33:** Lote en el límite y presupuesto de consultas
- Given: 200 eventos y 200 lugares válidos, con un wrapper instrumentado de `D1Database` que cuenta las llamadas (`batch`, `run`, `all`)
- Then: 200; se guardan los 400 ítems y la request hizo como máximo 10 llamadas a D1, igual que con un lote de 1 ítem. (Miniflare no aplica el límite real de D1: lo que se prueba es el presupuesto declarado en el spec.) Pendiente de verificar antes de `/apply`, contra la documentación de límites de D1: si cada sentencia dentro de un `D1.batch()` cuenta contra el límite de queries por invocación del Worker; si cuenta, el tope del lote se expresa también en sentencias.

**AC-34:** Ítem inválido y clave repetida (F-1)
- Given: lote con 3 eventos, uno con `start_date` mal formada; otro lote con dos eventos con el mismo `source_key`; y un evento con `end_date` anterior a `start_date`
- Then: 200; en el primero `events: { received: 3, created: 2, updated: 0, rejected: 1 }` y `rejected[0]` con `kind`, `index`, `source_key` y `reason`; en el segundo se guarda el primero y el repetido se rechaza con `reason: duplicate_source_key`; el tercero se rechaza con `reason: invalid_date_range`; un lugar con `opening_hours: []` se rechaza con `reason: invalid_opening_hours`. El lote con un ítem mal formado no da 400: el schema del lote solo exige objetos y cada ítem se valida por separado.

**AC-35:** Solo upsert
- Given: catálogo con el evento A de la fuente X
- When: llega un lote de X sin A
- Then: A sigue en el catálogo, con su `last_seen_at` anterior.

**AC-36:** Duplicados de eventos (E-10, F-11)
- Given: mismo título normalizado, `start_date` y `venue_name` desde una fuente `aggregator` y otra `curated`; y un evento nuevo que coincide por sede con dos existentes que no coinciden entre sí (uno por `venue_name`, otro por `address`)
- Then: queda un solo evento, con la fuente `curated` como primaria y la otra en `sources`; el conteo de la fusión es `updated`. Si al día siguiente el agregador reenvía el mismo `source_key`, la fila primaria no cambia (solo `last_seen_at` y `sources`) y no se crea un evento nuevo. Si el curado reenvía su `source_key` con `start_time` cambiado, se aplica (es la clave canónica); si llega después otra fuente de mayor `tier`, pasa a ser la canónica.
- Dos eventos del mismo lote con distinto `source_key`, mismo título normalizado, fecha y `venue_name`: queda una sola fila (`created: 1, updated: 1`).
- También se fusionan cuando una fuente trae el lugar resuelto y la otra solo `venue_name` igual (normalizado) al nombre de ese lugar. Con dos candidatos, se fusionan los tres en el insertado primero (orden de inserción, no el `id` ni el reloj) y el otro `id` resuelve a él. A igual `tier`, queda primaria la que llegó primero. Si el curado llega después del agregador, el evento conserva el `id` original y el `id` absorbido sigue resolviendo (no da 404).

**AC-37:** No fusionar sedes distintas (E-2)
- Given: dos ítems con el mismo título, fecha y `source_url`, sin lugar resuelto y con distinto `venue_name`; otros dos sin lugar, sin `venue_name` y sin `address`; y dos películas distintas de la misma sede con el mismo `source_url` genérico (la cartelera)
- Then: los primeros son dos eventos y cada `getEvent` lista al otro en `also_at`; los segundos tampoco se fusionan; las dos películas no se listan entre sí en `also_at` (distinto título).

**AC-38:** Duplicados de lugares
- Given (cada caso con su propio juego de fixtures y sus propios `source_key`, que son únicos; los casos B, E y H referencian explícitamente fixtures de otro caso donde lo dicen):
  - **Caso A:** un `osm` (`osm:a1`) y un curado, mismo nombre normalizado, a 30 m, en cualquier orden de llegada (el `id` que sobrevive es el de la fila existente). El `osm` trae `opening_hours` y `website`; el curado no.
  - **Caso B:** un `osm` (`osm:b1`) a 200 m del curado del caso A, con el mismo nombre.
  - **Caso C:** dos `osm` (`osm:n1` y después `osm:w1`, cargados en lotes distintos) con el mismo nombre, a 20 m entre sí y a 30 m de un curado que llega después.
  - **Caso D:** un curado ya existente y, en un lote posterior, `osm:n2` y `osm:w2` juntos, con el mismo nombre y a 30 m del curado.
  - **Caso E:** un curado y un `osm` (`osm:x1`) a 40 m con otro nombre, ya cargados como filas aparte.
  - **Caso F:** dos curados de fuentes distintas, mismo nombre normalizado, a 10 m entre sí (filas aparte): el curado 1 se carga en un lote anterior al curado 2, con el reloj avanzado entre ambos; luego llega un `osm` nuevo (`osm:f1`) con ese nombre a 20 m de ambos.
  - **Caso G:** dos `osm` (`osm:g1`, `osm:g2`) con el mismo nombre a 20 m entre sí y sin curado, en el mismo lote y, en otra corrida, en lotes distintos.
  - **Caso H:** la fixture del caso A en el orden `osm`→curado (ya fusionados); luego un lote posterior de OSM reenvía `osm:a1` con `name` y `phone` distintos.
- Then:
  - **Caso A:** el curado absorbe al `osm` y el `source_key` del `osm` queda como alias. En el orden `osm`→curado, `getPlace` devuelve `origin: curated` y los campos del curado, con `opening_hours` y `website` en `null` (no se heredan del `osm`). Si después el curado reenvía su `source_key` con un campo cambiado (p. ej. `phone`), el cambio se aplica a la fila sobreviviente.
  - **Caso B:** queda como lugar aparte.
  - **Caso C:** se fusionan los tres en el `osm` insertado primero (el de `osm:n1`, que pasa a `origin: curated` con los campos del curado); el otro `id` y ambos `source_key` `osm` resuelven a él (`/l/:id` de ambos no da 404). Si el curado reenvía con un campo cambiado, el cambio se aplica a esa fila.
  - **Caso D:** `osm:n2` y `osm:w2` se fusionan en la fila del curado (`places: { created: 0, updated: 2 }`).
  - **Caso E:** si el curado reenvía su `source_key` con el `name` del `osm:x1`, no se fusionan (el dedupe solo corre con un `source_key` nuevo): siguen siendo dos filas. Lo mismo si el curado del caso A reenvía con `lat`/`lon` a 50 m o menos del `osm:b1` (caso B): `osm:b1` sigue como fila aparte.
  - **Caso F:** los dos curados siguen como filas aparte (no se fusionan entre sí) y no se crea fila para `osm:f1`: su `source_key` queda como alias del curado 1 (el insertado primero). Un evento con `place_source_key` = `osm:f1` devuelve en `getEvent` el `place.id` del curado 1, y `getPlace` de cada curado conserva sus propios campos. El lote cuenta `places: { created: 0, updated: 1 }`.
  - **Caso G:** sin curado no hay dedupe entre `osm`: terminan como dos filas, vengan en el mismo lote o en lotes distintos.
  - **Caso H:** el reenvío del `source_key` absorbido solo actualiza `last_seen_at`: los campos del lugar curado no cambian y no se crea un duplicado. El `id` del lugar que sobrevive no cambia.

**AC-39:** Vínculo evento-lugar (F-12)
- Given: evento con `place_source_key` de un lugar de otra fuente cargado antes, y otro cuyo lugar llega en un lote posterior; y un lote que trae lugares y eventos juntos
- Then: `getEvent` devuelve `place` y hereda sus coordenadas si el evento no las traía (E-1); el segundo queda con `place: null` hasta que llega el lugar y después se vincula solo; en el lote mixto los lugares se procesan primero. Un evento que referenciaba al lugar `osm` absorbido resuelve al curado.

## Plan de tareas para `/apply` (texto, sin código)

1. **Migración D1** `apps/api/migrations/0001_catalogo.sql`: tablas `zones`, `places`, `events`, `event_sources`, `place_aliases`, con índices por (`lat`,`lon`), `start_date`/`end_date`, `last_seen_at` y `source_key` único global. Siembra de `zones` (13 zonas: confirmar centros y radios). Cada tabla con su línea `-- verify:`.
2. **Schemas Zod:** `npm run generate:schemas` (openapi-to-zod, sin edición manual). El generador se agrega en la rama `chore/generate-schemas` (PR aparte, fuera de `docs/`), que debe estar mergeada antes de `/apply`. Cada ítem de `IngestBatch` se valida con `safeParse` de `IngestEvent`/`IngestPlace` sobre el objeto original (no sobre la salida del `anyOf`), para conservar `source_key` en `rejected`.
3. **Rutas Hono** en `apps/api/src/routes/`: `zones`, `search` (+ `/search/pins`), `events`, `places`, `ingest`. Lógica pura (ventanas y franjas, orden, distancia Haversine + bounding box, `open_now`, dedupe) en funciones testeables aparte, con reloj inyectado. Middleware de bearer para `/ingest` con `INGEST_TOKEN` (Wrangler Secret) y comparación en tiempo constante. La escritura del lote usa `D1.batch()`.
4. **Tests:** desde el root con `npm test`. Endpoints con mock y, para `searchItems`, `getPlace` e `ingestBatch` (JOIN y lote en el límite), cobertura contra D1 real con `@cloudflare/vitest-pool-workers`.
5. **`ingestion/` (Python), parte del slice:** clasificar `intents` (B-3), prefijar `source_key` con la fuente, estructurar `opening_hours` de OSM, vincular eventos con lugares (`place_source_key`), enviar `source_url`, y publicar a `/ingest` en lotes de hasta 200.
6. **Fuera de este slice:** stores y vistas del dashboard (Slice 2), Plan en secuencia (Slice 3).
