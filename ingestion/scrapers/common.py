"""Utilidades compartidas: HTTP educado, fechas en español, modelo de evento."""
from __future__ import annotations

import calendar
import codecs
import json
import re
import time
import unicodedata
from urllib.parse import urlparse
import urllib.request
from dataclasses import dataclass, field
from datetime import date, timedelta

USER_AGENT = "rosariovidacultural/0.1 (agregador personal de agenda; sin fines de lucro)"
REQUEST_DELAY = 0.6  # segundos entre pedidos al mismo sitio
MAX_DISCRETE_DATES = 60

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}
DIAS = {"lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3, "viernes": 4, "sabado": 5, "domingo": 6}

_last_request = 0.0


def fetch(url: str, timeout: int = 30, payload: dict | None = None) -> str:
    """GET con User-Agent propio y pausa entre pedidos (POST de JSON si hay `payload`). Solo http(s)."""
    global _last_request
    if not url.startswith(("https://", "http://")):
        raise ValueError(f"URL no permitida: {url}")
    wait = REQUEST_DELAY - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    headers = {"User-Agent": USER_AGENT}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec - esquema validado arriba
        raw = resp.read()
    _last_request = time.monotonic()
    return decode(raw)


def _cp1252_fallback(err: UnicodeError) -> tuple[str, int]:
    return err.object[err.start:err.end].decode("cp1252", errors="replace"), err.end


codecs.register_error("cp1252_fallback", _cp1252_fallback)


def decode(raw: bytes) -> str:
    """UTF-8, y cada byte que no lo sea se lee como cp1252.

    Sirve para páginas UTF-8 con algún byte latin-1 suelto (1000tickets: 'MONTA\\xd1A') sin arruinar las
    tildes del resto, y a la vez para páginas enteras en cp1252 (sus acentos son bytes inválidos en UTF-8).
    """
    return raw.decode("utf-8", errors="cp1252_fallback")


def norm(text: str) -> str:
    """Minúsculas, sin acentos ni signos: para comparar títulos y parsear."""
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", text)).strip()


def http_url(raw: object) -> str:
    """La URL recortada si es http(s) con host; si no, vacío. Nunca lanza: `urlparse` falla con corchetes sueltos."""
    url = raw.strip() if isinstance(raw, str) else ""
    try:
        parts = urlparse(url)
    except ValueError:
        return ""
    return url if parts.scheme in ("http", "https") and parts.netloc else ""


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def _year_for(month: int, day: int, today: date) -> int:
    """Año más razonable: la fecha no puede quedar más de ~90 días en el pasado."""
    try:
        cand = date(today.year, month, day)
    except ValueError:
        return today.year
    return today.year + 1 if cand < today - timedelta(days=90) else today.year


def _mk(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


@dataclass
class DateSpec:
    start: date | None = None
    end: date | None = None
    dates: list[date] = field(default_factory=list)  # fechas puntuales
    ranged: bool = False  # True: el evento ocurre todos los días entre start y end

    def covers(self, day: date) -> bool:
        if self.ranged:
            return bool(self.start and self.end and self.start <= day <= self.end)
        return day in self.dates


def _finish(dates: list[date]) -> DateSpec:
    dates = sorted(set(dates))
    if not dates:
        return DateSpec()
    return DateSpec(start=dates[0], end=dates[-1], dates=dates[:MAX_DISCRETE_DATES])


def parse_range_ddmm(text: str, today: date) -> DateSpec:
    """Formato municipal: '30.09 al 11.10' o '02.10'. Rango continuo."""
    found = re.findall(r"(\d{1,2})\.(\d{1,2})", text)
    if not found:
        return DateSpec()
    (d1, m1), (d2, m2) = found[0], found[-1]
    y1 = _year_for(int(m1), int(d1), today)
    start = _mk(y1, int(m1), int(d1))
    end = _mk(y1, int(m2), int(d2))
    if start and end and end < start:
        end = _mk(y1 + 1, int(m2), int(d2))
    if not start or not end:
        return DateSpec()
    if start == end:
        return DateSpec(start=start, end=end, dates=[start])
    return DateSpec(start=start, end=end, ranged=True)


def parse_spanish_dates(text: str, today: date) -> DateSpec:
    """Texto libre de Rosario en Cartel.

    Casos: 'Viernes 2 de octubre', 'Viernes 2 y sábado 3 de octubre',
    '23, 24 y 25 de octubre', '31 de octubre y 1 de noviembre',
    'Sábados de octubre', 'Del 2 al 15 de octubre'.
    """
    t = norm(text)
    tokens = re.findall(r"\d{1,2}|[a-z]+", t)
    # Semana recurrente: "sabados de octubre" / "viernes y sabados de octubre"
    plural_days = [DIAS[w[:-1]] for w in tokens if w.endswith("s") and w[:-1] in DIAS]
    months_only = [MESES[w] for w in tokens if w in MESES]
    has_numbers = any(w.isdigit() for w in tokens)
    if plural_days and months_only and not has_numbers:
        out: list[date] = []
        for month in months_only:
            year = _year_for(month, 1, today)
            for d in range(1, calendar.monthrange(year, month)[1] + 1):
                cur = date(year, month, d)
                if cur.weekday() in plural_days:
                    out.append(cur)
        return _finish(out)

    # Números con su mes (el mes se hereda del siguiente mes nombrado)
    items: list[tuple[int, int | None]] = []  # (dia, mes|None)
    is_range = False
    pending: list[int] = []
    for i, w in enumerate(tokens):
        if w.isdigit() and int(w) <= 31:
            pending.append(len(items))
            items.append((int(w), None))
        elif w in MESES:
            for idx in pending:
                items[idx] = (items[idx][0], MESES[w])
            pending = []
        elif w in ("al", "a") and items and i + 1 < len(tokens) and tokens[i + 1].isdigit():
            is_range = True
    if not items:
        return DateSpec()
    # Sin mes en el texto: no se puede fechar
    known = [m for _, m in items if m]
    if not known:
        return DateSpec()
    items = [(d, m or known[-1]) for d, m in items]

    resolved: list[date] = []
    year = _year_for(items[0][1], items[0][0], today)
    prev_month = items[0][1]
    for d, m in items:
        if m < prev_month:
            year += 1
        prev_month = m
        cur = _mk(year, m, d)
        if cur:
            resolved.append(cur)
    if not resolved:
        return DateSpec()
    if is_range and len(resolved) >= 2:
        return DateSpec(start=resolved[0], end=resolved[-1], ranged=True)
    return _finish(resolved)


CATEGORIES = ["musica", "teatro", "cine", "danza", "arte", "muestras", "chicos", "deporte", "eventos", "otros"]

_PLAN_KEYWORDS = {
    "gastronomia": ["gastronom", "feria de", "food", "cerveza", "vino", "degustacion", "cata ", "chef",
                    "cocina", "mercado", "brunch", "cafe", "coctel"],
    "recreacion": ["aire libre", "recreativ", "caminata", "bicicleta", "ciclismo", "yoga", "kayak",
                   "parque", "picnic", "juegos", "carrera", "maraton", "torneo"],
}


def guess_plan(title: str, category: str, description: str = "") -> str:
    """Plan a grandes rasgos: cultura | gastronomia | recreacion. Por palabras clave."""
    if category == "deporte":
        return "recreacion"
    blob = f" {norm(title)} {norm(description)} "
    for plan, words in _PLAN_KEYWORDS.items():
        if any(w in blob for w in words):
            return plan
    return "cultura"


_CATEGORY_WORDS = [
    ("cine", ["cine", "pelicula", "cortometraje"]),
    ("danza", ["danza", "ballet", "baile", "tango"]),
    ("teatro", ["obra", "teatro", "humor", "stand up", "comedia", "chungo", "espectaculo teatral"]),
    ("musica", ["recital", "concierto", "musica", "banda", "orquesta", "dj ", "festival", "cantante", "gira",
                "tour", "en vivo"]),
    ("muestras", ["muestra", "exposicion", "museo", "feria", "salon"]),
    ("chicos", ["ninos", "infantil", "chicos", "familia"]),
    ("deporte", ["carrera", "maraton", "torneo", "partido", "ciclismo", "gran premio", "campeonato"]),
]


def guess_category(title: str, default: str = "eventos") -> str:
    """Categoría por palabras del título. Solo el título: el cuerpo nombra de todo ('banda', 'obra')."""
    blob = f" {norm(title)} "
    for cat, words in _CATEGORY_WORDS:
        if any(w in blob for w in words):
            return cat
    return default


# Subgéneros de música (MusicGenre del spec, F-17). Palabras ya normalizadas (sin tildes).
MUSIC_GENRES = ("jazz", "rock", "folklore", "electronica", "tango", "cumbia", "clasica", "chamame",
                "pop", "urbano", "reggae", "cuarteto", "metal")
_GENRE_WORDS = {
    "tango": ["tango", "tangos", "tanguera", "tangueras", "tanguero", "tangueros", "milonga", "milongas", "bandoneon",
              "tanguista", "tanguistas", "fueye", "fueyes", "arrabal"],
    "folklore": ["folklore", "folclore", "folklorico", "folclorico", "folklorica", "folclorica", "zamba", "zambas",
                 "chacarera", "chacareras", "cosquin", "folk", "folclorista", "folcloristas", "folkloristas",
                 "payada", "payadas", "payador", "payadores", "malambo", "carnavalito", "vidala", "vidalas"],
    "cumbia": ["cumbia", "cumbias"],
    "chamame": ["chamame", "chamames"],
    "clasica": ["clasica", "sinfonica", "sinfonico", "opera", "cantata", "filarmonica", "camerata"],
    "jazz": ["jazz"],
    "rock": ["rock", "rockero", "rockera", "rockeros", "rockeras", "punk"],
    "electronica": ["electronica", "techno", "house"],
    # F-19. `metal` no es alias de `rock`. «arte urbano» es de la calle, no un género: `urbano` solo entra por trap/hip hop/reggaetón.
    "metal": ["metal", "metalero", "metalera", "metaleros", "metaleras"],
    "pop": ["pop"],
    "urbano": ["trap", "hip hop", "hiphop", "reggaeton", "regueton"],
    "reggae": ["reggae"],
    "cuarteto": ["cuarteto", "cuartetos"],
}
# Frases que contienen la palabra del género pero no son el género («pop up», «cuarteto de cuerdas»): se sacan del texto antes de buscar.
_GENRE_EXCLUDE = {
    "pop": ["pop up", "pop art"],
    "cuarteto": ["cuarteto de cuerdas", "cuarteto de vientos", "cuarteto de saxos", "cuarteto de camara"],
    "reggae": ["reggaeton"],  # en «Género:» la búsqueda es por subcadena y «reggaeton» contiene «reggae»
}
# En el campo «Género:» la búsqueda es por subcadena (las ticketeras lo pegan con el campo siguiente). Para las palabras
# cortas que chocan con otras («popular», «trapecio») se usa un patrón propio.
_GENRE_FIELD_PATTERN = {
    "pop": re.compile(r"\bpop(?!ul)"),
    "urbano": re.compile(r"\b(trap(?!e)|hip hop|hiphop|reggaeton|regueton)"),
}


_PENA = re.compile(r"(?:^|\b(?:la|las|gran|una)\s+)peñas?\b")  # no «Gustavo Peña»


def guess_genres(title: str, description: str = "", forced: list[str] | None = None) -> list[str]:
    """Subgéneros de música por el título (palabra completa), por el campo «Género:» de la descripción
    (ticketeras) y por los que fuerza el espacio. El cuerpo libre de la descripción no cuenta: nombra de todo,
    igual que en guess_category. El campo «Género:» sí admite subcadena: las ticketeras lo pegan con el campo
    siguiente («FolcloreDestinatarios») y su contenido es un nombre de género, no texto libre."""
    words_in_title = f" {norm(title)} "
    m = re.search(r"genero:?\s*([a-z ]{1,25})", norm(description))
    genre_field = m.group(1) if m else ""
    found = set(forced or [])
    for genre, words in _GENRE_WORDS.items():
        in_title, field = words_in_title, f" {genre_field} "
        for phrase in _GENRE_EXCLUDE.get(genre, []):
            in_title, field = in_title.replace(f" {phrase} ", " "), field.replace(phrase, " ")
        if genre in _GENRE_FIELD_PATTERN:
            in_field = bool(_GENRE_FIELD_PATTERN[genre].search(field))
        else:
            in_field = any(w in field for w in words)
        if any(f" {w} " in in_title for w in words) or in_field:
            found.add(genre)
    # «peña» sola es folklore, pero cede ante cualquier otro género (una peña en la Casa del Tango es de tango) y
    # solo cuenta al inicio del título o tras «la/las/gran/una»: «Gustavo Peña» es un apellido.
    # Va aparte: norm() la vuelve «pena» (tristeza), así que se busca con la ñ en el título original.
    if not found and _PENA.search(unicodedata.normalize("NFC", title).lower()):
        found.add("folklore")
    return sorted(found)


# Intenciones del spec (Intent, B-3), en el orden del enum. Se asignan por categoría y palabras del título.
INTENTS = ("comer", "tomar_algo", "espectaculo", "musica_en_vivo", "bailar", "con_chicos")
_DANCE_WORDS = ["milonga", "milongas", "tertulia", "tertulias", "baile", "bailes", "bailanta", "bailantas",
                "bailable", "bailables", "bachata", "kizomba"]
_DRINK_WORDS = ["vino", "vinos", "cerveza", "cervezas", "cafe", "cafes", "coctel", "cocteles", "cata", "catas",
                "trago", "tragos"]


_FOOD_WORDS = ["chef", "chefs", "brunch", "brunchs", "cocina", "cocinas", "food", "almuerzo", "almuerzos",
              "cena", "cenas"]


def guess_intents(title: str, description: str, categories: list[str], plan: str) -> list[str]:
    """Intenciones del evento. Conservador: ante la duda, ninguna. `bailar` solo por palabras del título
    (el cuerpo nombra de todo); `tango` a secas no alcanza, es ambiguo. Muestras, arte, deporte y eventos sin
    señal no responden a ninguna intención."""
    cats = set(categories)
    words = f" {norm(title)} "
    dance_words = words.replace(" la tertulia ", " ")  # «La Tertulia» es un espacio, no una actividad
    found: set[str] = set()
    if "musica" in cats:
        found.add("musica_en_vivo")
    if any(f" {w} " in dance_words for w in _DANCE_WORDS):
        found.add("bailar")
    elif "danza" in cats:
        found.add("espectaculo")
    if cats & {"teatro", "cine"}:
        found.add("espectaculo")
    if "chicos" in cats:
        found.add("con_chicos")
    if plan == "gastronomia":
        blob = f" {norm(title)} {norm(description)} "
        drinks = any(f" {w} " in blob for w in _DRINK_WORDS)
        eats = "gastronom" in blob or any(f" {w} " in blob for w in _FOOD_WORDS)
        if drinks:
            found.add("tomar_algo")
        if eats:
            found.add("comer")
    return [i for i in INTENTS if i in found]


def feed_of(record: dict) -> str:
    """Scraper que trajo el evento. Con fuentes agregadoras la primera fuente citada ya no lo identifica."""
    return record.get("feed") or record["sources"][0]["name"]


def split_venues(venue: str) -> list[str]:
    """Sedes de un evento: `A · B` son dos sedes. Sin sede, una lista con '' para que haya siempre al menos una."""
    return [v.strip() for v in venue.split(" · ")] if venue else [""]


def coords_from_embed(html_text: str) -> tuple[float, float] | None:
    """(lat, lon) del iframe de Google Maps embebido ('...!2d<lon>!3d<lat>...'), o None."""
    m = re.search(r"!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)", html_text or "")
    if not m:
        return None
    lon, lat = float(m.group(1)), float(m.group(2))
    return round(lat, 5), round(lon, 5)


def in_rosario_bbox(lat: float, lon: float) -> bool:
    return -33.05 <= lat <= -32.85 and -60.85 <= lon <= -60.55


def extract_time(text: str) -> str:
    """Primer horario 'HH:MM' del texto, o ''."""
    m = re.search(r"\b(\d{1,2}):(\d{2})\b", text or "")
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else ""


def strip_time(text: str) -> str:
    """Saca 'a las 21:00 Hs.' para que las horas no se lean como días."""
    return re.sub(r"\s*(a las\s*)?\d{1,2}:\d{2}.*$", "", text or "", flags=re.I).strip()


_MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def format_dates(dates: list[date]) -> str:
    """'3 oct, 4 oct, 10 oct' para mostrar fechas puntuales."""
    return ", ".join(f"{d.day} {_MES_CORTO[d.month - 1]}" for d in sorted(dates))
