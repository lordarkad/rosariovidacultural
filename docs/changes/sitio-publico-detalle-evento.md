# Sitio público · Slice 4a — Detalle de evento

Continúa [`sitio-publico-busqueda.md`](sitio-publico-busqueda.md) (S2-3, S2-8, S2-11, E-2, E-9, E-11, E-12, D-10) y [`sitio-publico-zona-mapa.md`](sitio-publico-zona-mapa.md) (S3-4, S3-7). **No cambia el contrato:** `getEvent` (`GET /api/events/{id}`) ya está en `docs/api-spec.yml` e implementado (AC-24..27 de `sitio-publico-busqueda.md`); `apps/web/src/services/api.ts` ya lo expone. Wireframe del owner: `wireframes/detalle.html` (dirección B · Ribera, aprobada el 2026-09-30 en `docs/DESIGN.md`).

El Detalle de **lugar** (`/l/:id`) es el slice 4b: espera su wireframe (S2-6, vía `/tript-wireframe-brief`).

## Decisiones

Confirmadas por el owner el 2026-10-19: S4-1, S4-2, S4-3, S4-4. Las demás son supuestos asumidos con la opción recomendada en `/enrich-us`; el owner puede objetarlas antes de `/apply`.

| ID | Tema | Decisión |
|---|---|---|
| S4-1 | Alcance (B1) | 4a = `/e/:id`. 4b = `/l/:id`, después de aprobar el wireframe de lugar. |
| S4-2 | Lugar mientras tanto (B2) | `/l/:id` sigue cayendo en la pantalla 404. Se oculta «Ver detalle» de los lugares en la tarjeta del pin (Resultados) y el ítem de lugar de la lista deja de ser un enlace (se ve igual, sin navegación). Se revierte en 4b. |
| S4-3 | Ubicación de referencia (B3, E-11) | La URL del detalle lleva `lat` y `lon` (par completo, 5 decimales) cuando la búsqueda tiene origen; se reenvían a `getEvent`. Si el origen es una zona (`z`), se usa el centro de la zona. Sin origen, la URL no los lleva y no se muestra distancia. Un par incompleto o fuera de rango se ignora. |
| S4-4 | Título de página (B11) | `document.title` = «{título del evento} · Rosario, qué hacer»; se restaura al salir. Open Graph / previews: slice 5. |
| S4-5 | «Atrás» (B4, E-12) | «Volver a resultados» usa `router.back()` si hay historial interno de la app; si se entró por link directo, va a `/resultados` (sin filtros). Resultados restaura el scroll y los filtros porque estos viven en la URL. |
| S4-6 | Cómo llegar (S2-8, B5) | Enlace universal de Google Maps con destino por coordenadas, en pestaña nueva (`rel="noopener noreferrer"`). Sin `lat`/`lon` el botón no se muestra y la fila de dirección dice «ubicación no informada» (E-1). |
| S4-7 | Layout (B6) | Mobile: imagen 220 px de alto, contenido en una columna, tab bar de 3 con Resultados activa. Desktop (≥ md): dos columnas, imagen a la izquierda (560 px) y contenido con scroll a la derecha; el botón «Volver a resultados» arriba. |
| S4-8 | Cabecera | Etiquetas: EVENTO; el primer género de `music_genres` si hay (S2-19); GRATIS si `price_status` es `free`. Título como H2 display. Sin `image_url`, o si la imagen falla, placeholder beige tipográfico con el mismo ratio (sin salto de layout). |
| S4-9 | Metadata | Cuándo, Dónde, Precio, Distancia, cada una como fila. **Cuándo:** fecha única («Sáb 25 oct · 21:00»), rango («Del 3 al 30 oct») o `date_text` si el parseo no alcanza; sin horario, «Horario a confirmar» (E-4). **Dónde:** `venue_name` + `address`; si hay `place`, el nombre no enlaza hasta 4b. **Precio:** GRATIS, «$ 12.000» o «precio no informado» (S2-11). **Distancia:** «850 m · 11 min a pie» solo si `distance_m` no es null; si es null, la fila no se muestra. |
| S4-10 | Descripción | Solo texto (nunca HTML), saltos de línea preservados. Más de 400 caracteres: truncada con «Ver más» / «Ver menos». Sin descripción, no hay bloque. |
| S4-11 | Fuentes (D-10, B7) | La primera de `sources` es la primaria: tarjeta con nombre y «↗ Fuente», siempre visible. Las demás, debajo, como «Vía {nombre}» con su enlace. Todos con `rel="noopener noreferrer"`; solo se aceptan `http(s)`. |
| S4-12 | Datos de ayer (E-9) | Con `is_stale: true` se muestra el aviso «Datos de ayer: la fuente no se actualizó hoy». Nunca con `false`. |
| S4-13 | También en… (E-2, B8) | Si `also_at` no está vacío, lista «También en» con `venue_name` (o `address`) de cada sede; cada una enlaza a `/e/:id` del hermano, conservando `lat`/`lon`. Un hermano que da 404 muestra el estado «ya no disponible». |
| S4-14 | Estados | **Cargando:** esqueleto con el layout final. **404 / 400** (vencido, inexistente o id inválido): «Este evento ya no está disponible» con salidas «Ver resultados» y «Volver al inicio». **Error de red / 5xx:** mensaje con «Reintentar» (S2-15). |
| S4-15 | Store (B9) | `detail.store.ts` con `loading` y `error` obligatorios. Pedir otro id cancela la request anterior; una respuesta tardía o abortada se ignora. Estado `notFound` separado de `error`. |
| S4-16 | Accesibilidad | Al cargar, el foco va al `h1`; las filas de metadata usan lista de definición; el aviso de datos de ayer es `role="status"`; contraste del amarillo en etiquetas queda para el slice 5. |
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
- **[AC-2]** Los ítems de lugar de la lista y la tarjeta del pin de un lugar no ofrecen enlace al detalle; los de evento sí (S4-2).
- **[AC-3]** `detailQuery` / la URL del detalle escribe y lee `lat`/`lon` con las reglas de S4-3 (par completo, rango, 5 decimales, zona → centro); sin origen no hay parámetros.
- **[AC-4]** `getEvent` recibe `lat`/`lon` solo cuando están ambos; sin ellos, el Detalle no muestra la fila de distancia.
- **[AC-5]** `detail.store` cancela la request anterior al cambiar de id, ignora respuestas tardías o abortadas, expone `loading`/`error`, y separa `notFound` (404/400) de `error` (red/5xx).
- **[AC-6]** El formateo de «Cuándo» cubre fecha única, rango, `date_text` y «Horario a confirmar» en hora de Buenos Aires.
- **[AC-7]** El precio se muestra como GRATIS, «$ N» en es-AR o «precio no informado» (E-6, S2-11).
- **[AC-8]** «Cómo llegar» arma el enlace de Google Maps con las coordenadas; sin coordenadas no hay botón y la dirección dice «ubicación no informada» (S4-6).
- **[AC-9]** `is_stale: true` muestra «datos de ayer»; `false` no (E-9, D-13 (4)).
- **[AC-10]** La fuente primaria (`sources[0]`) siempre está visible; las otras salen como «Vía …»; solo se enlazan URLs `http(s)` (D-10).
- **[AC-11]** `also_at` vacío no muestra el bloque; con hermanos, cada uno enlaza a su `/e/:id` conservando `lat`/`lon` (E-2).
- **[AC-12]** La descripción se renderiza como texto (sin interpretar HTML) y se trunca por encima de 400 caracteres con «Ver más».
- **[AC-13]** `document.title` refleja el título del evento y se restaura al salir (S4-4).
- **[AC-14]** «Volver» usa el historial si lo hay y, si no, va a `/resultados` (S4-5).
- **Verificación en navegador** (no unitaria, ver Reglas de Testing; con capturas): mobile 390 y desktop, claro y oscuro; entrada por link directo; los estados cargando, no disponible y error; «También en…»; aviso de datos de ayer; imagen rota; foco al `h1`.

## Plan de tareas (`/apply`, todo en `apps/web`)

1. **RED**: tests de `lib` (URL del detalle con `lat`/`lon`, formateo de «Cuándo» y precio, enlace de Maps, validación de URLs de fuente, truncado) y de `detail.store` (cancelación, tardías, `notFound` vs `error`), citando `[AC-N]`.
2. **GREEN**: `lib/` con las funciones puras; `stores/detail.store.ts`; `views/EventoView.vue` y componentes chicos (metadata, tarjeta de fuente, bloque «También en»); ruta `/e/:id` en el router.
3. **Cambio en slices previos**: ocultar el enlace de lugares en `ResultItem.vue` y `ResultadosView.vue` (S4-2); agregar `lat`/`lon` a los enlaces de evento (S4-3).
4. **Cierre**: `/verify`, QA visual con capturas vía subagente `qa-visual`, `/code-review` sobre el diff.

## Pendiente de otros slices

- **4b** Detalle de lugar: wireframe de lugar aprobado (`/tript-wireframe-brief`); revertir S4-2; decidir el hallazgo de `UpcomingEvent.start_date` (`detail.repo.ts:242`).
- **5** Pulido: Open Graph para links compartidos, contraste del amarillo, rendimiento, conectar producción.
