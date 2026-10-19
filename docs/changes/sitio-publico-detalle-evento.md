# Sitio público · Slice 4a — Detalle de evento

Continúa [`sitio-publico-busqueda.md`](sitio-publico-busqueda.md) (S2-3, S2-8, S2-11, E-2, E-9, E-11, E-12, D-10) y [`sitio-publico-zona-mapa.md`](sitio-publico-zona-mapa.md) (S3-4, S3-7). **No cambia el contrato:** `getEvent` (`GET /api/events/{id}`) ya está en `docs/api-spec.yml` e implementado (AC-24..27 de `sitio-publico-busqueda.md`); `apps/web/src/services/api.ts` ya expone `getEvent(id, opts)`, pero **sin** `lat`/`lon`: hay que extenderlo (ver plan). Wireframe del owner: `wireframes/detalle.html` (dirección B · Ribera, aprobada el 2026-09-30 en `docs/DESIGN.md`).

El Detalle de **lugar** (`/l/:id`) es el slice 4b: espera su wireframe (S2-6, vía `/tript-wireframe-brief`).

## Decisiones

Confirmadas por el owner el 2026-10-19 (marcadas ✔ en la tabla): S4-1, S4-2, S4-3, S4-4 y, tras la revisión, S4-5 (scroll). Las demás (sin ✔) son supuestos asumidos con la opción recomendada en `/enrich-us`; el owner puede objetarlas antes de `/apply`.

| ID | Tema | Decisión |
|---|---|---|
| S4-1 ✔ | Alcance (B1) | 4a = `/e/:id`. 4b = `/l/:id`, después de aprobar el wireframe de lugar. |
| S4-2 ✔ | Lugar mientras tanto (B2) | `/l/:id` sigue cayendo en la pantalla 404. Se oculta «Ver detalle» de los lugares en la tarjeta del pin (Resultados) y el ítem de lugar de la lista deja de ser un enlace (se ve igual, sin navegación). Se revierte en 4b. |
| S4-3 ✔ | Ubicación de referencia (B3, E-11) | **La URL del detalle es siempre canónica: `/e/:id`, sin `lat`/`lon`** (el link compartido no lleva la posición de nadie ni muestra una distancia calculada desde otra persona). El origen viaja en el `state` de la navegación (`router.push({ path, state })`) desde Resultados y desde el mapa: coordenadas del pin o del GPS, o el centro de la zona (`Zone.lat/lon`, de `zones.store`; si las zonas no cargaron, sin origen). Se reenvía a `getEvent` solo si es un par válido (rango, 5 decimales). Entrada directa, recarga o link compartido: no hay origen y no se muestra distancia. Los enlaces «También en…» conservan el `state`. |
| S4-4 ✔ | Título de página (B11) | `document.title` = «{título del evento} · Rosario, qué hacer»; el título original se captura una sola vez al montar y se restaura al salir (aunque se haya pasado por varios eventos). Open Graph / previews: slice 5. |
| S4-5 ✔ | «Atrás» (B4, E-12) | «Volver a resultados» usa `router.back()` solo si `history.state.back` empieza con `/resultados`; en cualquier otro caso (link directo, venir de Home o de Zona) navega a `/resultados`. Los filtros se conservan porque viven en la URL; **la lista vuelve a la página 1 y no se restaura el scroll** (decidido el 2026-10-19; restaurarlo queda para el slice 5). «También en…» navega con `replace`, así «atrás» no pasa por otro evento. |
| S4-6 | Cómo llegar (S2-8, B5) | Enlace universal de Google Maps con destino por coordenadas, en pestaña nueva (`rel="noopener noreferrer"`). Sin `lat`/`lon` el botón no se muestra y la fila de dirección dice «ubicación no informada» (E-1). |
| S4-7 | Layout (B6) | Mobile: imagen 220 px de alto, contenido en una columna, tab bar de 3 con Resultados marcada visualmente (la ruta del Detalle declara `meta.tab = 'resultados'` y `TabBar` la lee; sin `aria-current="page"`, porque la página actual es el Detalle). Desktop (≥ md): dos columnas, imagen a la izquierda (560 px) y contenido con scroll a la derecha; el botón «Volver a resultados» arriba. |
| S4-8 | Cabecera | Etiquetas: EVENTO; el primer género de `music_genres` si hay (S2-19); GRATIS si `price_status` es `free`. Título como `h1` con estilo H2 display. Sin `image_url`, o si la imagen falla, placeholder beige tipográfico con el mismo ratio (sin salto de layout). |
| S4-9 | Metadata | Cuándo, Dónde, Precio, Distancia, cada una como fila. **Cuándo:** fecha única (`start_date === end_date`): «Sáb 25 oct · 21:00», o «Horario a confirmar» si `start_time` es desconocido (E-4); rango (`start_date !== end_date`): «Del 3 al 30 oct», sin hora, y entre meses o años incluye el mes o el año que cambia («Del 28 dic al 5 ene», «Del 28 dic 2026 al 5 ene 2027»). `date_text`, si existe, se muestra como nota secundaria bajo la fecha («Según la fuente: …»), nunca en su lugar. **Dónde:** `venue_name` + `address`; si hay `place`, el nombre no enlaza hasta 4b. **Precio:** GRATIS, «$ 12.000» o «precio no informado» (S2-11). **Distancia:** «850 m · 11 min a pie» solo si `distance_m` no es null; si es null, la fila no se muestra. |
| S4-10 | Descripción | Solo texto (nunca HTML), saltos de línea preservados. Más de 400 caracteres: truncada con «Ver más» / «Ver menos». Sin descripción, no hay bloque. |
| S4-11 | Fuentes (D-10, B7) | La primera de `sources` es la primaria: tarjeta con nombre y «↗ Fuente», siempre visible. Las demás, debajo, como «Vía {nombre}» con su enlace. Todos con `rel="noopener noreferrer"`; solo se aceptan `http(s)`. |
| S4-12 | Datos de ayer (E-9) | Con `is_stale: true` se muestra el aviso «Datos de ayer: la fuente no se actualizó hoy». Nunca con `false`. |
| S4-13 | También en… (E-2, B8) | Si `also_at` no está vacío, lista «También en» con `venue_name` (o `address`, o «Otra sede» si faltan ambos) de cada sede; cada una enlaza a `/e/:id` del hermano, conservando `lat`/`lon`. Un hermano que da 404 muestra el estado «ya no disponible». |
| S4-14 | Estados | **Cargando:** esqueleto con el layout final. **404 / 400** (vencido, inexistente o id inválido): «Este evento ya no está disponible» con salidas «Ver resultados» y «Volver al inicio». **Error de red / 5xx:** mensaje con «Reintentar» (S2-15). |
| S4-15 | Store (B9) | `detail.store.ts` con `loading` y `error` obligatorios. Pedir otro id cancela la request anterior; una respuesta tardía o abortada se ignora. Estado `notFound` separado de `error`. Como el router reutiliza el componente entre `/e/A` y `/e/B`, la vista observa `route.params.id`: recarga, mueve el foco al `h1` y lleva el scroll interno al inicio en cada carga. |
| S4-16 | Accesibilidad | En cada carga, el foco va al `h1`; las filas de metadata usan lista de definición; el aviso de datos de ayer es `role="status"`; contraste del amarillo en etiquetas queda para el slice 5. |
| S4-17 | Rendimiento (S2-20) | La vista es un chunk diferido; la imagen reserva su ratio (sin CLS) y no se pide hasta que hay datos. Sin dependencias nuevas. |

## Supuestos a confirmar (sin wireframe propio)

El wireframe `detalle.html` es genérico. Estos casos no están dibujados y se resuelven con las reglas de arriba; hay que mirarlos en navegador y, si el owner prefiere, ampliar el wireframe:

1. Bloque «También en…» (S4-13).
2. Rango de fechas, «Horario a confirmar», precio «no informado», evento sin ubicación (S4-6, S4-9).
3. Estados cargando, «ya no disponible» y error (S4-14).
4. Truncado de descripción con «Ver más» (S4-10).
5. Texto exacto de «Cómo llegar», «↗ Fuente», «Vía» y del aviso de datos de ayer.
6. No se muestran `intents` como etiquetas (solo EVENTO, género, GRATIS), como en el wireframe.

## Criterios de aceptación

- **[AC-1]** La ruta `/e/:id` carga el Detalle de evento; `/l/:id` sigue siendo 404 (S4-2).
- **[AC-2]** Una función pura `detailLink(kind, id, origin?)` (en `lib/`, reemplaza a las dos copias de `detailPath`) devuelve `null` para lugares y `{ path: '/e/:id', state }` para eventos; los ítems de lugar de la lista y la tarjeta del pin de un lugar no ofrecen enlace (S4-2).
- **[AC-3]** El origen del `state` se arma y se valida con las reglas de S4-3 reutilizando `coord` y `round5` de `lib/search-query.ts` (se exportan; no se copian): par completo, rango, 5 decimales, zona → centro de `zones.store`; la URL nunca lleva `lat`/`lon`.
- **[AC-4]** `getEvent(id, { lat, lon }?, opts?)` envía `lat`/`lon` solo cuando están ambos (con `toQueryString`); sin ellos, el Detalle no muestra la fila de distancia, también en entrada directa.
- **[AC-5]** `detail.store` cancela la request anterior al cambiar de id, ignora respuestas tardías o abortadas, expone `loading`/`error`, y separa `notFound` (404/400) de `error` (red/5xx).
- **[AC-6]** `formatWhen` (nueva, en `lib/format.ts`) cubre fecha única, «Horario a confirmar», rango dentro de un mes, entre meses y entre años, y la nota `date_text`, en hora de Buenos Aires.
- **[AC-7]** El precio reutiliza `formatPrice`, `formatDistance` y `formatWalk` de `lib/format.ts` (ya testeadas); la vista pone «precio no informado» cuando `formatPrice` da `null` (E-6, S2-11).
- **[AC-8]** «Cómo llegar» arma el enlace de Google Maps con las coordenadas; sin coordenadas no hay botón y la dirección dice «ubicación no informada» (S4-6).
- **[AC-9]** `is_stale: true` muestra «datos de ayer»; `false` no (E-9, D-13 (4)).
- **[AC-10]** La fuente primaria (`sources[0]`) siempre está visible; las otras salen como «Vía …»; solo se enlazan URLs `http(s)` (D-10).
- **[AC-11]** `also_at` vacío no muestra el bloque; con hermanos, cada uno enlaza a su `/e/:id` con `replace` y conservando el `state` de origen; un hermano sin `venue_name` ni `address` dice «Otra sede» (E-2).
- **[AC-12]** La descripción se renderiza como texto (sin interpretar HTML) y se trunca por encima de 400 caracteres con «Ver más».
- **[AC-13]** `document.title` refleja el título del evento y se restaura al original al salir, también tras ir de A a B y salir (S4-4).
- **[AC-14]** «Volver» usa `router.back()` solo si `history.state.back` empieza con `/resultados`; si no (link directo, Home, Zona), va a `/resultados`; tras pasar por «También en…» sigue llevando a Resultados (S4-5).
- **[AC-15]** En `/e/:id` la pestaña Resultados se ve marcada y ninguna lleva `aria-current="page"` (S4-7).
- **Verificación en navegador** (no unitaria, ver Reglas de Testing; con capturas): mobile 390 y desktop, claro y oscuro; entrada por link directo; los estados cargando, no disponible y error; «También en…» (con y sin nombre de sede); atrás tras pasar por un hermano; aviso de datos de ayer; imagen rota; foco al `h1`.

## Plan de tareas (`/apply`, todo en `apps/web`)

1. **RED**: tests de `lib` (`detailLink` y origen, `formatWhen` —extiende `lib/format.ts`, sin retestear lo existente—, enlace de Maps, validación de URLs de fuente, truncado), de `api.test.ts` (`getEvent` con y sin `lat`/`lon`) y de `detail.store` (cancelación, tardías, `notFound` vs `error`), citando `[AC-N]`.
2. **GREEN**: `lib/` con las funciones puras (exportar `coord`/`round5` de `search-query.ts`); `services/api.ts`: `getEvent(id, { lat, lon }?, opts?)`; `stores/detail.store.ts`; `views/EventoView.vue` y componentes chicos (metadata, tarjeta de fuente, bloque «También en»); ruta `/e/:id` en el router.
3. **Cambio en slices previos**: reemplazar las dos copias de `detailPath` (`ResultItem.vue`, `ResultadosView.vue`) por `detailLink`, que oculta el enlace de lugares (S4-2) y pasa el `state` de origen en los de evento (S4-3); `meta.tab` en la ruta y lectura en `TabBar.vue` (S4-7).
4. **Cierre**: `/verify`, QA visual con capturas vía subagente `qa-visual`, `/code-review` sobre el diff.

## Pendiente de otros slices

- **4b** Detalle de lugar: wireframe de lugar aprobado (`/tript-wireframe-brief`); revertir S4-2; decidir el hallazgo de `UpcomingEvent.start_date` (`detail.repo.ts:242`).
- **5** Pulido: Open Graph para links compartidos, contraste del amarillo, rendimiento, conectar producción.
