# Sitio público · Slice 3 — Zona y mapa

Continúa [`sitio-publico-busqueda.md`](sitio-publico-busqueda.md) (S2-2, S2-16, S2-17). No cambia el contrato: `lat`, `lon`, `radio_m`, `bbox` y `/search/pins` ya están en `docs/api-spec.yml`. Wireframes: `zona-cerca.html`, `zona-mapa.html`, `resultados.html`, `estado-sin-ubicacion.html`, `estado-permiso-denegado.html`.

## Decisiones

| ID | Tema | Decisión |
|---|---|---|
| S3-1 | Proveedor de teselas | **MapTiler** (decidido por el owner el 2026-10-19; cierra S2-2/B-7). Estilos vectoriales `streets-v2` y `streets-v2-dark` según `prefers-color-scheme`. La clave es pública (`VITE_MAPTILER_KEY`, secret de CI `MAPTILER_KEY`) y se restringe por origen en el panel de MapTiler. Atribución visible (compacta): © MapTiler © OpenStreetMap contributors, que la aporta el propio estilo. |
| S3-2 | Sin mapa | Sin clave, sin WebGL, sin red o con clave rechazada (401/403) no hay mapa: se avisa «El mapa no está disponible por ahora» y la lista sigue funcionando; la hoja arranca completa. |
| S3-3 | Carga diferida | MapLibre vive en su propio chunk y se descarga solo al montar un mapa (S2-20: el JS inicial sigue ≤ 200 KB gzip). |
| S3-4 | Origen en la URL | `lat`, `lon` y `radio_m` viajan en la URL (S2-3). `z` y `lat/lon` son excluyentes (E-8): si vienen los dos manda la zona. `radio_m` se acota a 500–10 000 m; sin radio vale el del servidor (2 000). Las coordenadas se redondean a 5 decimales. La frase dice «Cerca · 2 km»; tocarla lleva a Zona (S2-13). Home conserva el origen al volver a buscar. |
| S3-5 | GPS | Solo se pide al tocar «Usar mi ubicación», nunca al cargar la pantalla; no se guarda (D-9). Permiso denegado: el navegador no permite abrir los ajustes del sistema, así que el botón «Ir a configuración» del wireframe se reemplaza por una instrucción («Activalo desde los ajustes del sitio») más las salidas «Elegir en el mapa» y «Ver barrios». |
| S3-6 | Pins | `/search/pins` con los mismos filtros que la lista. Con más de 100 (`X-Truncated`) se avisa «Mostrando N de M» y al mover o hacer zoom se vuelve a pedir con `bbox` (D-7). El mapa se reencuadra solo con una búsqueda nueva, nunca al mover el mapa. Los eventos sin ubicación no tienen pin (E-1); siguen en la lista. |
| S3-7 | Pin ↔ lista | Elegir un barrio en el autocomplete mueve el pin pero no cambia el radio. Tocar un pin abre una tarjeta (EVENTO/LUGAR, título, «Ver detalle») y resalta el ítem en la lista, que se desplaza hasta él si está cargado. |
| S3-8 | Hoja inferior (S2-17) | Tres alturas (colapsada, media, completa). Arrastre con puntero; el asa es un botón: un toque recorre las alturas y ↑/↓ las cambian. Colapsada, la lista es `inert` (fuera del orden de Tab y de lectores). Desktop (≥ md): mapa + lista de 420 px, sin asa. |
| S3-9 | Accesibilidad del mapa | El mapa es una ayuda visual, no la única vía: todo lo que se hace con el pin arrastrable tiene alternativa por teclado (autocomplete de barrio, barrios, GPS) y todos los resultados están en la lista. |
| S3-10 | Zona | Tres modos como grupo de chips (S2-16): «Cerca mío» (GPS + radio), «En el mapa» (pin arrastrable o toque + autocomplete de barrio + radio), «Barrios». El modo inicial sigue a la búsqueda actual (barrio → Barrios, punto → En el mapa, nada → Cerca mío). Elegir un barrio de la lista usa `z` (radio propio de la zona); elegirlo en el autocomplete mueve el pin al barrio y busca por punto. |

## Criterios de aceptación

- **[AC-1]** `parseSearch`/`toRouteQuery` leen y escriben `lat`, `lon`, `radio_m` con las reglas de S3-4 (par completo, rango, redondeo, zona gana).
- **[AC-2]** La frase de búsqueda muestra «Cerca · {radio}» cuando hay origen por coordenadas.
- **[AC-3]** El radio se acota a 500–10 000 m y se formatea en m o km con coma decimal.
- **[AC-4]** El círculo del radio es un anillo cerrado cuyos puntos están a ≈ el radio del centro.
- **[AC-5]** `pins.store` cancela la consulta anterior, ignora respuestas tardías o abortadas, expone `loading`/`error` y reporta `truncated`; `version` solo sube con búsquedas completas (sin `bbox`).
- **[AC-6]** El autocomplete de barrio ignora tildes y mayúsculas, prioriza los que empiezan con el texto y limita a 6 sugerencias.
- **[AC-7]** `getPosition` mapea los errores del navegador a `denied`, `unavailable`, `timeout` o `unsupported`.
- **[AC-8]** Sin clave de MapTiler no hay URL de estilo (S3-2); con clave, el estilo claro y el oscuro son distintos.
- **Verificación en navegador** (no unitaria, ver Reglas de Testing): hoja con tres alturas, pins, tarjeta del pin, círculo de radio, pin arrastrable, autocomplete, modo oscuro.

## Pendiente de otros slices

- Tag MÚSICA (S2-19) sigue bloqueado: `SearchItem` no trae `music_genres`.
- Detalle (`/e/:id`, `/l/:id`): slice 4.
