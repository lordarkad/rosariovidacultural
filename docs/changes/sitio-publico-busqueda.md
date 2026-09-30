# Sitio público de búsqueda — decisiones del enriquecimiento

- **Fecha:** 2026-09-30
- **Origen:** `/enrich-us` sobre `wireframes/*.html` (Figma Make `en5jOAjdZvfWxOggie0jUt`)
- **Estado:** decisiones de diseño (§B) resueltas por el tech lead; edge cases (§A) resueltos en E-1 a E-12; gaps de contrato (§D) resueltos. ADR 0002 aceptado el 2026-09-30. Listo para `/ff`.

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
| E-9 | Frescura | Cada ítem guarda `last_seen_at`. Más de 36 h: el Detalle avisa «datos de ayer». Más de 7 días: sale de los resultados. |
| E-10 | Duplicados | Clave: título normalizado + fecha + lugar. Fuente primaria, en orden: curado a mano, fuente oficial, agregador. En lugares, el curado pisa a OSM. |
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
