Bocetos del owner (input externo, ver `tracks/app/00-playbook.md` §Fase 1A).
No generar contenido acá — es donde el owner deposita lo que ya trae armado.

---

## Detalle de lugar (`detalle-lugar.html`) — generado con `/tript-wireframe-brief`, 2026-10-19

**Estado: aprobado por el owner (Daniel King, 2026-10-19).** Cuenta como wireframe del owner para el gate de `/enrich-us` y `/ff` del slice 4b; los supuestos de abajo siguen sin confirmar. Entrevista ligera (8 decisiones). Base de UI: dirección B · Ribera ya aprobada (`docs/DESIGN.md`); este archivo es solo estructura, en grises.

### Decisiones del owner (entrevista)

| # | Tema | Decisión |
|---|---|---|
| 1 | Horario | Estado «Abierto ahora · cierra 23:00» + semana plegada («Ver horarios de la semana ▾»). |
| 2 | Contacto | «Cómo llegar» principal + fila de botones Llamar / Sitio / Instagram (solo los que existen). |
| 3 | Próximos eventos | Lista compacta fecha · título · precio, cada fila a `/e/:id`; 5 visibles y «Ver más». |
| 4 | Qué ofrece | Etiquetas bajo el título (música en vivo, cena, baile, aire libre); cocina en una línea de etiquetas. |
| 5 | Sin horario estructurado | `hours_text` de la fuente como «Según la fuente: …»; sin nada, «Horario no informado». |
| 6 | Sin próximos eventos | Se oculta el bloque. |
| 7 | Atribución OSM | Línea al pie «Datos de OpenStreetMap · contribuidores (ODbL)», solo si `origin = osm`. |
| 8 | Nota curada (`note`) | Cita destacada bajo la cabecera, solo si existe. |

### Supuestos de Claude (supuesto — confirmar)

1. **Marco igual al Detalle de evento** — imagen/placeholder tipográfico, tab bar con Resultados marcada, «Volver», estados cargando / no disponible / error con las mismas reglas (S4-5, S4-7, S4-14). Supuesto — confirmar.
2. **Cerrado ahora:** «○ CERRADO AHORA · abre mañana 12:00» con la misma semana plegada. Supuesto — confirmar.
3. **Abierto 24 h:** solo cuando el lugar abre las 24 h todos los días (el servidor no informa cambio de estado): «● ABIERTO LAS 24 H». Un lugar con 24 h solo algunos días muestra el cierre normal («cierra a la medianoche…»). Supuesto — confirmar.
4. **Distancia** («850 m · 11 min a pie») como fila de la metadata, solo con origen; mismo manejo del origen por `state` que el evento. Supuesto — confirmar.
5. **Orden de bloques:** cabecera → cocina → nota → horario y dirección → acciones → próximos eventos → atribución. Supuesto — confirmar.
6. **Tipo de lugar** (`kind`) como etiqueta secundaria («BAR»); un tipo desconocido o `otro` no se rotula (como `placeKindLabel`). Supuesto — confirmar.
7. **Dirección sin enlace** propio; «Cómo llegar» abre Google Maps por coordenadas (igual que S4-6). Supuesto — confirmar.
8. **Sitio e Instagram** abren en pestaña nueva (`rel="noopener noreferrer"`), solo `http(s)`; Llamar usa `tel:`. Supuesto — confirmar.
9. **Datos de ayer / fuentes múltiples:** no aplican a lugares (`last_seen_at` es informativo). Supuesto — confirmar.
10. **Desktop:** dos columnas como el evento (imagen 560 px a la izquierda, contenido con scroll a la derecha). Supuesto — confirmar.
11. **Lugar con `upcoming_events`** (máx. 20): el «Ver más» despliega en la misma página, sin paginar. Supuesto — confirmar.

---

## Curación — eventos y lugares (`curacion.html`) — generado con `/tript-wireframe-brief`, 2026-10-19

**Estado: aprobado por el owner (Daniel King, 2026-10-19).** Cuenta como wireframe del owner para el gate de `/enrich-us` y `/ff` de la curación; los supuestos de abajo siguen sin confirmar. Entrevista completa. Base de UI: dirección B · Ribera ya aprobada (`docs/DESIGN.md`); este archivo es solo estructura, en grises.

### Decisiones del owner (entrevista)

| # | Tema | Decisión |
|---|---|---|
| 1 | Dispositivo | Desktop primero; en móvil la tabla degrada a tarjetas apiladas con las mismas etiquetas y filtros en panel desplegable. |
| 2 | Eventos | Tabla densa: fecha, hora, título, lugar, fuente (+vías), precio, estado, visto, faltantes. |
| 3 | Lugares | Misma tabla y mismos controles: nombre, tipo, origen, dirección, coords, cocina/ofrece, visto, faltantes. Sin mapa. |
| 4 | Navegación | Encabezado «Curación» con pestañas Eventos / Lugares; cartel de entorno (staging) fijo arriba. |
| 5 | Fila | El título/nombre abre `/e/:id` o `/l/:id` en pestaña nueva; sin panel lateral. |
| 6 | Estado de evento | Columna «Estado» con Vigente / Pasado / Sin ver hace +7 d; filas pasadas atenuadas. |
| 7 | Filtros | Buscador + fuente/origen, estado/tipo y «Faltan»; todo en la URL (compartible, Atrás funciona). |
| 8 | CSV | Exporta todo lo que cumple los filtros activos, no solo la página visible. |
| 9 | Tono | Sobrio y funcional con la paleta Ribera, sin ilustración; no debe confundirse con el sitio público. |
| 10 | Contexto | Claro y oscuro como el sitio, WCAG 2.2 AA, teclado en tabla y filtros. |

### Supuestos de Claude (supuesto — confirmar)

1. **Paginación** de 50 filas por página, con total y salto a página (LIMIT/OFFSET). Supuesto — confirmar.
2. **Orden:** eventos por fecha ascendente (pasados al final), lugares por nombre; encabezados ordenables. Supuesto — confirmar.
3. **Columna «Visto»** muestra `last_seen_at` como «hoy / N d». Supuesto — confirmar.
4. **«Fuente (+vías)»:** fuente primaria y un contador de vías adicionales, sin lista completa. Supuesto — confirmar.
5. **Evento sin lugar:** «— sin lugar» y la etiqueta «lugar» en Faltan, si no hay sede, dirección ni coordenadas efectivas. Supuesto — confirmar.
6. **Aviso ⚠ «derivadas»** en lugares curados sin lat/lon manual. Supuesto — confirmar.
7. **Enlace de eventos vencidos:** abren un 404 en el detalle público; la fila lo indica con la etiqueta de estado. Supuesto — confirmar.
8. **Estados:** cargando (skeleton), sin resultados (con «Limpiar filtros»), error con «Reintentar» y catálogo vacío. Supuesto — confirmar.
9. **Tab bar del sitio oculto** en `/curacion/*` y sin enlace desde ninguna otra pantalla. Supuesto — confirmar.
10. **Filtro «Faltan» multi-selección** por entidad (eventos: imagen, lugar, hora, precio, descripción, dirección, coordenadas; lugares: imagen, horario, dirección, teléfono, web, cocina, nota). Supuesto — confirmar.
11. **Recuento en el botón CSV** refleja el total filtrado; sin tope definido. Supuesto — confirmar.
