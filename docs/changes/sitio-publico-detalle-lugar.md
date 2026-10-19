# Sitio público · Slice 4b-2 — Detalle de lugar (UI)

Segunda mitad del slice 4b; el contrato y la ingesta están en [`sitio-publico-detalle-lugar-api.md`](sitio-publico-detalle-lugar-api.md) (4b-1, que se despliega primero). Continúa [`sitio-publico-detalle-evento.md`](sitio-publico-detalle-evento.md) (S4-*: marco, estados, foco, título, origen en el `state`) y [`sitio-publico-busqueda.md`](sitio-publico-busqueda.md) (AC-28, S2-6). Wireframe del owner: `wireframes/detalle-lugar.html`, aprobado el 2026-10-19 (`docs/DESIGN.md`); decisiones y supuestos en `wireframes/README.md`.

`getPlace` (`GET /api/places/{id}`) ya existe; `apps/web/src/services/api.ts` lo expone pero **sin** `lat`/`lon`: hay que extenderlo igual que `getEvent`. Todo es `apps/web`.

## Decisiones

Confirmadas por el owner el 2026-10-19 (✔): L-1 a L-8, L-11. Las demás (sin ✔) son supuestos asumidos con la opción recomendada; el owner puede objetarlas antes de `/apply`.

| ID | Tema | Decisión |
|---|---|---|
| L-1 ✔ | Alcance | `/l/:id` carga la ficha (deja de ser 404) con `meta.tab = 'resultados'`, como el Detalle de evento. Se revierte S4-2: los lugares vuelven a ser enlace en la lista y la tarjeta del pin vuelve a ofrecer «Ver detalle». |
| L-2 ✔ | Origen | Igual que S4-3: la URL es `/l/:id` sin `lat`/`lon`; el origen viaja en el `state` del router y se reenvía a `getPlace` solo si es un par válido. Se propaga en Resultados → lugar, evento → lugar y lugar → evento. |
| L-3 ✔ | «Volver» desde un evento llegado desde un lugar (B4) | Si la entrada anterior del historial es `/l/:id`, «Volver» usa `router.back()` y se rotula «Volver al lugar». Amplía S4-5 (`backTarget`). En la ficha del lugar «Volver a resultados» conserva la regla de S4-5: solo `router.back()` si la entrada anterior es `/resultados`; si no, va a `/resultados` (también si se llegó desde un evento; **supuesto — confirmar**). |
| L-4 ✔ | Horario (B1 + wireframe) | Con `open_now` y `next_change_at` del servidor: abierto → «● Abierto ahora · cierra 23:00»; cerrado → «○ Cerrado ahora · abre hoy 22:30», «abre mañana 12:00» o «abre el jue 12:00» (solo hora si el cambio es dentro de las próximas 24 h al cerrar; con día si está más lejos). Abierto con `next_change_at` nulo → «Abierto las 24 h». Hora de Buenos Aires, formato «23:00». Sin horario estructurado (`open_now` nulo): si hay `hours_text`, «Según la fuente: …»; si no, «Horario no informado». |
| L-5 ✔ | Semana plegada (B5) | Botón «Ver horarios de la semana» (`aria-expanded`), solo si hay `opening_hours`. Siete filas lunes → domingo; varios tramos del día se unen con «y»; sin tramos, «Cerrado»; `opens == closes`, «24 h»; un cierre pasada la medianoche se muestra en el día en que abre («18:00–03:00»). Hoy (en Buenos Aires) con marca «(hoy)» y estilo, no solo color. |
| L-6 ✔ | Contacto (B6) | «Cómo llegar» (siempre: un lugar siempre tiene coordenadas) más los botones que existan. Teléfono: celular (empieza con `+54 9`) → «WhatsApp» con enlace `wa.me/<dígitos>`; otro número válido (fijo, ej. `+54 341…`) → «Llamar» con `tel:`; no parseable → sin botón. Sitio: solo `http(s)` (`safeSourceUrl`). Instagram: usuario validado (`[A-Za-z0-9._]{1,30}`) → `https://www.instagram.com/<usuario>/`. Todos los externos en pestaña nueva con `rel="noopener noreferrer"`. Un número con «15» local (`+54 341 15…`) se trata como fijo (**supuesto — confirmar**). |
| L-7 ✔ | Cabecera | Etiquetas: LUGAR, tipo (`placeKindLabel`; `otro` o desconocido sin rótulo), lo que ofrece (`offers`: música en vivo, cena, baile) y AIRE LIBRE si `outdoor` es `true` (nada si es `false` o `null`). Cocina en una línea aparte con prefijo «Cocina» y una etiqueta por valor, ya traducida por la ingesta (4b-1). Título como `h1`. No se muestran `intents`. |
| L-8 ✔ | Próximos eventos | Lista compacta: fecha («Vie 24 oct · 21:00», o rango con `formatWhen` usando `end_date`) y precio (`formatPrice`; si no se conoce, no se muestra) y título; cada fila enlaza a `/e/:id` con el origen en el `state`. Se ven 5 y «Ver más (N)» muestra todo lo recibido (hasta 20), con «Ver menos». Sin eventos, no hay bloque. |
| L-9 | Nota y atribución | `note` como cita destacada bajo la cabecera, solo texto (nunca HTML), saltos de línea preservados. Con `origin = osm`, pie «Datos de OpenStreetMap · contribuidores (ODbL)» enlazado a `https://www.openstreetmap.org/copyright`; los curados no lo llevan. |
| L-10 | Dónde y distancia | Fila «Dónde» con `address`, solo si existe; fila «Distancia» («850 m · 11 min a pie») solo si `distance_m` no es nulo (entrada directa: no hay). Sin `last_seen_at` ni «datos de ayer» (los lugares no vencen). |
| L-11 ✔ | Estados | Mismo marco, foco, título y scroll que S4-14, S4-15 y S4-16. Cargando: esqueleto. 404 o 400: «No encontramos este lugar» con «Ver resultados» y «Volver al inicio». Error de red o 5xx: mensaje con «Reintentar». Título «{nombre} · Rosario, qué hacer», restaurado al salir. |
| L-12 | Store | `place.store.ts` con `loading`, `error` y `notFound` obligatorios, igual que `detail.store` (cancela la request anterior, ignora respuestas tardías). La vista y el detalle de evento comparten lo que sea común (carga, foco, título, scroll) en un composable en `/apply` (REFACTOR). |
| L-13 | Evento → lugar (B7) | En el Detalle de evento, si hay `place`, su nombre enlaza a `/l/:id` (con el origen en el `state`); sin `place`, sigue siendo texto (cierra la nota de S4-9). |
| L-14 | Imagen | Mismo marco que el evento: `image_url` o, si falta o falla, placeholder beige tipográfico con el nombre y el mismo ratio. Sin mapa en la ficha. Imagen y chunk: igual que S4-17 (vista diferida, sin dependencias nuevas). |

## Supuestos a confirmar (sin wireframe propio)

El wireframe cubre el caso feliz y las variantes del horario. Estos casos se resuelven con las reglas de arriba y hay que mirarlos en navegador:

1. Estados cargando, «no encontramos este lugar» y error (L-11).
2. «Cerrado ahora · abre …» con sus tres formas de día (L-4) y «Abierto las 24 h».
3. Texto exacto de «WhatsApp», «Llamar», «Sitio», «Instagram», «Ver más (N)» y «Ver horarios de la semana».
4. Lugar sin cocina, sin contacto o sin dirección (los bloques simplemente no aparecen).
5. Teléfono con prefijo local «15» y números no argentinos (L-6).
6. «Volver» de la ficha cuando se llegó desde un evento (L-3).

## Criterios de aceptación

- **[AC-1]** La ruta `/l/:id` carga la ficha de lugar (deja de ser 404) y declara `meta.tab = 'resultados'`.
- **[AC-2]** `detailLink` devuelve `{ path: '/l/:id', state }` para lugares y `{ path: '/e/:id', state }` para eventos (con origen validado como en S4-3); un `kind` desconocido sigue sin enlace. Los ítems de lugar de la lista y la tarjeta del pin de un lugar vuelven a enlazar (invierte [AC-2] del 4a).
- **[AC-3]** `getPlace(id, { lat, lon }?, opts?)` envía `lat`/`lon` solo cuando están ambos; sin ellos no hay fila de distancia, también en entrada directa.
- **[AC-4]** `place.store` cancela la request anterior al cambiar de id, ignora respuestas tardías o abortadas, expone `loading`/`error` y separa `notFound` (404/400) de `error` (red/5xx).
- **[AC-5]** `openStatus` (función pura, reloj inyectado, hora de Buenos Aires) cubre: abierto con cierre, abierto sin cambio (24 h), cerrado con apertura hoy / mañana / otro día, y sin horario con y sin `hours_text`.
- **[AC-6]** `weekSchedule` (función pura) devuelve siete filas lunes → domingo con varios tramos, «Cerrado», «24 h», cierre pasada la medianoche en el día de apertura y la marca de hoy.
- **[AC-7]** `phoneAction` clasifica celular (`+54 9…` → WhatsApp con `wa.me/<dígitos>`), fijo (→ `tel:`) y no parseable (→ ninguno); el sitio solo se enlaza si es `http(s)`; el usuario de Instagram solo se enlaza si pasa la validación.
- **[AC-8]** «Cómo llegar» reutiliza `mapsUrl` con las coordenadas del lugar.
- **[AC-9]** Las etiquetas de la cabecera salen de `kind`, `offers` y `outdoor` (AIRE LIBRE solo con `true`) y la cocina como una etiqueta por valor; no se muestran `intents`; un tipo `otro` o desconocido no se rotula.
- **[AC-10]** «Próximos eventos»: sin eventos no hay bloque; muestra 5 y «Ver más (N)» muestra todos; cada fila enlaza a `/e/:id` con el origen en el `state`, con rango de fechas cuando `end_date` difiere de `start_date` y sin precio si no se conoce.
- **[AC-11]** La atribución de OpenStreetMap aparece solo con `origin = osm`.
- **[AC-12]** La nota se renderiza como texto (sin interpretar HTML) y solo si existe.
- **[AC-13]** `document.title` refleja el nombre del lugar y se restaura al original al salir (también tras pasar por otro lugar o evento); en cada carga el foco va al `h1` y el scroll interno al inicio.
- **[AC-14]** `backTarget` distingue el origen: en un evento, `router.back()` y «Volver al lugar» si la entrada anterior es `/l/:id`; `router.back()` y «Volver a resultados» si es `/resultados`; en cualquier otro caso va a `/resultados`. En la ficha del lugar se mantiene la regla de S4-5 (invierte la parte «solo Resultados» de [AC-14] del 4a para el evento).
- **[AC-15]** En el Detalle de evento, con `place` el nombre del lugar enlaza a `/l/:id` con el origen en el `state`; sin `place` es texto.
- **[AC-16]** `TabBar` marca Resultados en `/l/:id` sin `aria-current="page"` en ninguna pestaña (igual que [AC-15] del 4a).
- **Verificación en navegador** (no unitaria; con capturas, contra staging cuando 4b-1 esté desplegado): mobile 390 y desktop, claro y oscuro; entrada directa; los tres estados; abierto, cerrado, 24 h, solo `hours_text` y sin dato; semana plegada con hoy marcado; botón WhatsApp con un celular y Llamar con un fijo; lugar con próximos eventos (5 y «Ver más», rango en curso) y sin ellos; evento → lugar → «Volver al lugar»; lugar → evento → «Volver a resultados»; la distancia se conserva en todos los saltos y en la recarga; atribución solo en origen OSM; ítem de lugar y pin enlazados; foco al `h1` y título de la pestaña.

## Plan de tareas (`/apply`, todo en `apps/web`)

1. **RED:** tests de `lib` (`detailLink` con lugares y `backTarget` ampliados, `openStatus`, `weekSchedule`, `phoneAction`, etiquetas de cabecera), de `api.test.ts` (`getPlace` con y sin `lat`/`lon`), de `place.store` (cancelación, tardías, `notFound` vs `error`) y de vista (`PlaceView`: próximos eventos, atribución, título, foco, enlace desde `EventoView`), citando `[AC-N]`. Actualizar los tests del 4a que fijaban «los lugares no tienen enlace» y la regla de «Volver».
2. **GREEN:** funciones puras en `lib/`; `services/api.ts`: `getPlace(id, { lat, lon }?, opts?)`; `stores/place.store.ts`; `views/LugarView.vue` y componentes chicos (horario con semana plegada, acciones de contacto, próximos eventos); ruta `/l/:id` con `meta.tab`.
3. **Cambios en slices previos:** `detailLink` ya sin el caso nulo de lugares; `ResultItem.vue` y `ResultadosView.vue` ofrecen el enlace de lugares; `EventoView.vue` enlaza el nombre del lugar y usa el `backTarget` ampliado con su etiqueta.
4. **REFACTOR:** composable compartido entre `EventoView` y `LugarView` (carga, foco, título, scroll).
5. **Cierre:** `/verify`, QA visual con capturas vía subagente `qa-visual` (con 4b-1 en staging), `/code-review` sobre el diff.

## Pendiente de otros slices

- **4b-1** (contrato, API e ingesta) debe estar mergeado y desplegado antes de verificar en navegador.
- **5** Pulido: Open Graph para links compartidos (también `/l/:id`), contraste del amarillo, rendimiento, conectar producción.
