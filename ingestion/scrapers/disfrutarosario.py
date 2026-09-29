"""Disfruta Rosario (disfrutarosario.com): guía editorial en WordPress, leída por su API REST.

No tiene eventos estructurados: cada nota (categoría `eventos-en-rosario`) cuenta el evento en texto
libre. De ahí se extraen fecha, horario, precio y, si la nota enlaza a una ticketera, esa ticketera
pasa a ser la fuente primaria y Disfruta Rosario queda como segunda ("vía").
La sede sale de las categorías por lugar del sitio (hijas de `espectaculos`).
Las notas sin fecha futura reconocible (guías, carteleras permanentes) se descartan.
"""
from __future__ import annotations

import html
import json
import re
from datetime import date
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .common import DateSpec, clean, fetch, format_dates, guess_category, guess_plan, norm, parse_spanish_dates

HOST = "https://disfrutarosario.com"
API = f"{HOST}/wp-json/wp/v2"
SOURCE = "Disfruta Rosario"
CAT_EVENTOS = 248  # eventos-en-rosario
CAT_PADRE_LUGARES = 2  # espectaculos: sus hijas son las sedes (El Círculo, City Center...)
PER_PAGE = 100
MAX_PAGES = 3
HEAD_CHARS = 1500  # los datos del evento suelen ir al principio; más abajo hay historia y otras fechas
FAR_CHARS = 4000  # hasta acá se busca, pero pasado HEAD_CHARS la fecha necesita una palabra de cue
CUE_RE = re.compile(r"realiz|tendr[aá] lugar|se har[aá]|ser[aá]|el evento|funci[oó]n|fecha|comienza|inicia|"
                    r"arranca|llega|abre|desde|cuando|cuándo", re.I)

MONTHS = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre"
DAY = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo"
DATE_RE = re.compile(
    rf"(?:(?:{DAY})s?\s+)?\d{{1,2}}(?:\s*(?:,|y|al)\s*(?:(?:{DAY})s?\s+)?\d{{1,2}})*\s+de\s+(?:{MONTHS})"
    rf"(?:\s+y\s+\d{{1,2}}\s+de\s+(?:{MONTHS}))?(?:\s+de\s+(?P<year>\d{{4}}))?", re.I)
TIME_RE = re.compile(r"\b(?:a las|desde las|de)\s+(\d{1,2})(?::(\d{2}))?(?!\d)\s*(?:hs?\b\.?|horas)?", re.I)
MONTH_WORDS = set(MONTHS.split("|"))
_CAP = r"[A-ZÁÉÍÓÚÑ][\wáéíóúñ.]*"
ADDRESS_RE = re.compile(
    rf"(?:\ben|\bAv\.?|\bAvenida|\bBv\.?|\bBulevar|\bcalle|Direcci[oó]n:?|Lugar:?)\s+"
    rf"(?P<street>(?:{_CAP}\s+){{1,3}}\d{{3,4}})\b")
PRICE_RE = re.compile(r"\$\s?(\d[\d.]*)")
FREE_RE = re.compile(r"gratuit|entrada libre|gratis", re.I)
EVERGREEN = re.compile(r"^(cartelera|agenda)\b|\bagenda de\b|\bcartelera de\b|imperdibles", re.I)
TICKET_HOSTS = {
    "passline.com": "Passline", "ticketek.com.ar": "Ticketek", "alpogo.com": "Alpogo",
    "ticketsforlovers.com": "Tickets for Lovers", "plateanet.com": "Plateanet", "tuentrada.com": "TuEntrada",
    "livepass.com.ar": "Livepass", "allaccess.com.ar": "AllAccess", "ticketway.com.ar": "Ticketway",
    "entradaplay.com": "Entradaplay", "eventbrite.com.ar": "Eventbrite", "eventbrite.com": "Eventbrite",
    "bandsintown.com": "Bandsintown", "alternativateatral.com": "Alternativa Teatral",
    "articket.com.ar": "Articket", "etickets.com.ar": "Etickets",
}
def find_date(text: str, published: date, today: date) -> tuple[DateSpec, str] | None:
    """Primera fecha futura en el arranque del texto, con la ventana de texto que la sigue (para el horario).

    El texto casi nunca trae año: se resuelve respecto de la fecha de publicación de la nota, no de hoy.
    Si no, 'el 14 de octubre' de una nota de 2015 se leería como octubre de 2027.
    """
    head = text[:FAR_CHARS]
    for m in DATE_RE.finditer(head):
        year = m.group("year")
        if year and int(year) < today.year:
            continue  # 'fundado el 5 de mayo de 1900'
        if m.start() > HEAD_CHARS and not CUE_RE.search(head[max(0, m.start() - 90): m.start()]):
            continue  # lejos del arranque solo vale una fecha que la frase presenta como del evento
        spec = parse_spanish_dates(m.group(0), published)
        if spec.start and spec.end and spec.end >= today:
            return spec, head[m.start(): m.end() + 60]
    return None


def find_address(text: str) -> str:
    """Dirección con cue explícito ('en Warnes 1917', 'Av. Pellegrini 1500'); '' si no hay una clara.

    Conservador a propósito: un pin en el lugar equivocado es peor que ningún pin.
    """
    for m in ADDRESS_RE.finditer(text[:HEAD_CHARS]):
        name = m.group("street")
        if norm(name.split(" ")[0]) in MONTH_WORDS or 2020 <= int(name.split(" ")[-1]) <= 2035:
            continue  # 'en Octubre 2026', 'en Rosario 2026': es un año, no una numeración
        return clean(name)
    return ""


def find_time(window: str) -> str:
    m = TIME_RE.search(window)
    if not m or int(m.group(1)) > 23:
        return ""
    return f"{int(m.group(1)):02d}:{m.group(2) or '00'}"


def ticket_link(soup: BeautifulSoup) -> tuple[str, str] | None:
    """(nombre, url) de la primera ticketera enlazada en la nota."""
    for a in soup.find_all("a", href=True):
        host = urlparse(a["href"]).netloc.lower().removeprefix("www.")
        if host in TICKET_HOSTS and a["href"].startswith(("https://", "http://")):
            return TICKET_HOSTS[host], a["href"]
    return None


def parse_post(post: dict, venues: dict[int, str], today: date) -> dict | None:
    title = clean(html.unescape(post["title"]["rendered"]))
    if not title or EVERGREEN.search(title):
        return None
    if any(int(y) < today.year for y in re.findall(r"\b(20\d\d)\b", title)):
        return None  # 'Terror Aventura 2025': edición pasada
    soup = BeautifulSoup(post["content"]["rendered"], "html.parser")
    text = clean(soup.get_text(" "))
    try:
        published = date.fromisoformat(post["date"][:10])
    except (KeyError, ValueError):
        published = today
    found = find_date(text, published, today)
    if not found:
        return None
    spec, window = found
    prices = [int(p.replace(".", "")) for p in PRICE_RE.findall(text) if p.replace(".", "").isdigit()]
    prices = [p for p in prices if 1000 <= p < 10_000_000]
    img = soup.find("img", src=True)
    venue = next((venues[c] for c in post.get("categories", []) if c in venues), "")
    excerpt = clean(BeautifulSoup(post.get("excerpt", {}).get("rendered", ""), "html.parser").get_text(" "))
    category = guess_category(title)
    ev = {
        "title": title,
        "url": post["link"],
        "date_text": spec_text(spec),
        "spec": spec,
        "time": find_time(window),
        "venue": venue,
        "address": "" if venue else find_address(text),
        "description": re.sub(r"\s*\[?(&hellip;|…)\]?$", "", excerpt)[:400],
        "image": img["src"] if img and img["src"].startswith(("https://", "http://")) else "",
        "category": category,
        "all_categories": [category],
        "plan": guess_plan(title, category, excerpt),
        "source": SOURCE,
        "price_from": min(prices) if prices else None,
        "free": bool(FREE_RE.search(text[:HEAD_CHARS])) and not prices,
    }
    ticket = ticket_link(soup)
    if ticket:  # la ticketera es la fuente primaria; la nota queda como "vía"
        ev["source"], ev["url"], ev["also"] = ticket[0], ticket[1], [{"name": SOURCE, "url": post["link"]}]
    return ev


def spec_text(spec: DateSpec) -> str:
    if spec.ranged:
        return f"{format_dates([spec.start])} al {format_dates([spec.end])}"
    return format_dates(spec.dates)


def load_venues() -> dict[int, str]:
    out: dict[int, str] = {}
    for page in (1, 2):
        try:
            rows = json.loads(fetch(
                f"{API}/categories?parent={CAT_PADRE_LUGARES}&per_page={PER_PAGE}&page={page}&_fields=id,name"))
        except Exception:  # noqa: BLE001 - WordPress responde 400 pasada la última página
            break
        out.update({r["id"]: clean(html.unescape(r["name"])) for r in rows})
        if len(rows) < PER_PAGE:
            break
    return out


def scrape(today: date) -> list[dict]:
    venues = load_venues()
    events, seen = [], set()
    for page in range(1, MAX_PAGES + 1):
        try:
            posts = json.loads(fetch(
                f"{API}/posts?categories={CAT_EVENTOS}&per_page={PER_PAGE}&page={page}"
                "&_fields=id,date,link,title,excerpt,content,categories"))
        except Exception as exc:  # noqa: BLE001
            print(f"  [disfrutarosario] página {page}: {exc}")
            break
        for post in posts:
            ev = parse_post(post, venues, today)
            if ev and ev["url"] not in seen:
                seen.add(ev["url"])
                events.append(ev)
        if len(posts) < PER_PAGE:
            break
    print(f"  [disfrutarosario] {len(events)} eventos con fecha futura")
    return events
