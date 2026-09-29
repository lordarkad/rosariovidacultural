# Rosario, qué hacer

Agregador de planes en Rosario (cultura, gastronomía, recreación). Junta varias agendas en un solo
`events.json` y lo muestra en un sitio estático con filtros.

## Uso

```bash
pip install -r requirements.txt
python build.py                 # scrapea todas las fuentes -> site/events.json
python build.py --only cartel   # una sola fuente (conserva los datos de las otras)
python build_places.py          # directorio de lugares (OpenStreetMap) -> site/places.json
python -m http.server 8765 -d site   # abrir http://localhost:8765
python -m unittest discover -s tests
```

## Fuentes actuales

| Fuente | Cómo se lee |
|---|---|
| Agenda municipal (rosario.gob.ar) | Buscador por etiqueta (paginado) + página de detalle (sede, horario, gratis) |
| Rosario en Cartel | Listados HTML por categoría (`?cpage=N`) |
| Teatro La Comedia | Portada (plugin MEC); agrupa las funciones de cada obra |
| Teatro Broadway | Cartelera propia (`/cartelera/<id>`): fechas, horarios y precio desde |
| Showcase Rosario | API JSON de Voy al Cine (cine id 16): funciones por día |
| Cinemark Rosario | JSON-LD `ScreeningEvent` de la cartelera |

| Qué Hacemos (API) | `api.quehacemos.com.ar`: eventos de Rosario con coordenadas. Es un agregador, así que cada evento se atribuye a su **fuente primaria** (Passline, Ticketek, Alternativa Teatral…) y Qué Hacemos queda como segunda fuente ("vía") |
| Disfruta Rosario | API REST de WordPress (categoría `eventos-en-rosario`). Fecha, hora, precio y dirección salen del texto libre; si la nota enlaza a una ticketera, esa pasa a ser la fuente primaria |
| TurboEntrada | Ticketera (plataforma EntradaUno). Dos endpoints JSON públicos que usa su front: `EspectaculosCartel` (shows y próxima función) y `Establecimientos` (sede, domicilio y coordenadas del mapa embebido). Fuente primaria, link directo a la compra |
| 1000Tickets | Ticketera. Portada + una página por evento con fechas y horarios, lugar, dirección y mapa embebido (coordenadas). Sin precio en el HTML. Fuente primaria |
| Rosario Noticias | RSS oficial. No son eventos sino notas de prensa: van aparte a `site/news.json` (solo categorías Cultura y Turismo) |

Los cines se muestran como una entrada por película con sus días y horarios; si una película está
en ambos cines se unifica en una sola tarjeta (sin horarios, que son de cada cine).

### Espacios (venues curados)

Lugares que albergan eventos y tienen perfil propio: música en vivo, cena, baile. La lista es **a mano**
en `data/venues.json` (no sale de ningún scraper). En cada corrida `build.py`:

1. valida el archivo (un error corta el build, no se publica a medias),
2. vincula cada evento con su espacio por el nombre de la sede (`aliases`, sin tildes ni mayúsculas,
   por palabras completas) y le agrega `venue_id`,
3. resuelve las coordenadas: `lat`/`lon` cargadas → mediana de las de sus eventos → geocodificación,
4. escribe `site/venues.json` con los próximos eventos de cada espacio (fuente primaria primero).

Un espacio sin eventos igual aparece: es un lugar donde ir. La pestaña "Espacios" del sitio combina
las opciones (elegir *Música en vivo* + *Cena* muestra solo los que ofrecen ambas) y filtra por cercanía.

Para sumar uno: agregar un objeto en `data/venues.json` (`id`, `name`, `aliases`, `address`, `offers`,
`instagram` sin @, `website`, `note` en palabras propias, `info_sources` con de dónde salió el dato).
Opciones nuevas (p. ej. `karaoke`): agregarlas a `OFFERS` en `scrapers/venues.py`. Instagram no se
puede leer automáticamente (pide login): se enlaza, no se scrapea.

### Lugares (directorio, no eventos)

`build_places.py` consulta OpenStreetMap (Overpass) por mosaicos de la ciudad y genera
`site/places.json`: restaurantes, cafés, bares, heladerías y comida rápida con dirección, horario,
teléfono y web cuando OSM los tiene. Si un mosaico falla (el servidor público suele dar 504/429) se
conservan los lugares anteriores de esa zona. Datos © colaboradores de OpenStreetMap (ODbL): la
atribución se muestra en el sitio.

Descartadas: datos abiertos de turismo (solo PDFs de ediciones pasadas), cine de Rosario en Cartel
(sin fechas ni funciones), `rosario.tur.ar` (su agenda es la misma de rosario.gob.ar), X/Twitter
(`CulturaRosario`, `DisfrutaRos`: la API es paga y responde 402), Civitatis (son tours reservables sin
fechas; encaja mejor como directorio, tipo `places.json`, vía su API de afiliados).
Passline directo: no se scrapea. Su home está detrás de una sala de espera Queue-it (protección
anti-bots) y esquivarla no corresponde. Sus eventos de Rosario igual entran vía Qué Hacemos, con
Passline como fuente primaria; para cobertura completa habría que pedirles acceso a su API/feed.
Pendientes: Bandsintown es a su vez un agregador (ir a la sede o ticketera), otras salas, Instagram de
espacios, enriquecer favoritos con Google Places.

Atribución: cada evento guarda `sources[]` con la fuente primaria primero. Nunca se copia el texto
completo: solo título, fecha, sede, un extracto corto y el link al original.

## Agregar una fuente

Un módulo en `scrapers/` con `SOURCE` y `scrape(today)` que devuelva dicts con: `title`, `url`,
`date_text`, `spec` (`DateSpec`), `venue`, `description`, `image`, `category`, `all_categories`,
`plan`, `source`, `free`. Registrarlo en `SOURCES` de `build.py`.

## Publicación

`.github/workflows/scrape.yml` corre cada noche, actualiza `site/events.json` y hace commit. El
directorio `site/` es estático: sirve para Cloudflare Pages o GitHub Pages.

## Límites conocidos

- Las fechas de Cartel vienen como texto libre; el parser cubre los formatos vistos (ver
  `tests/test_dates.py`). Un evento con fecha ilegible se descarta y se cuenta en `sin_fecha`.
- Disfruta Rosario es sobre todo contenido permanente (guías, hoteles): solo unas pocas notas por
  semana son eventos con fecha. Toma la primera fecha futura de la nota; las notas con varias fechas
  ("fiestas electrónicas: fechas 2026") quedan con la primera, y las recurrentes ("cada fin de semana")
  solo con la próxima. Sin sede reconocible el evento no tiene pin en el mapa.
- Cartel no informa horario ni precio en el listado; "gratis" solo se marca con certeza en la
  agenda municipal y en la sección "Gratis" de Cartel.
- Respetar los sitios: pausa entre pedidos, User-Agent propio, se enlaza siempre al original.
