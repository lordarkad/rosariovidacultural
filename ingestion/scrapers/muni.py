"""Agenda de la Municipalidad de Rosario (rosario.gob.ar/inicio/agenda).

Usa el buscador por etiqueta, que pagina con ?page=N (0-based, 9 por página),
para conocer la categoría de cada evento. La portada de la agenda aporta
eventos destacados que no tengan etiqueta conocida (categoría 'otros').
"""
from __future__ import annotations

from datetime import date
from urllib.parse import quote

from bs4 import BeautifulSoup

from .common import clean, fetch, guess_plan, norm, parse_range_ddmm

HOST = "https://www.rosario.gob.ar"
AGENDA = f"{HOST}/inicio/agenda"
SOURCE = "Agenda municipal"
# id de etiqueta del sitio -> categoría propia
TAGS = {337: "cine", 333: "teatro", 330: "musica", 331: "muestras", 327: "deporte"}
MAX_PAGES = 15
DAY_WORDS = {"lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "sábados", "domingo", "domingos", "todos"}


def parse_cards(html: str, today: date) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for card in soup.find_all("actividad"):
        link = card.find("a", href=True)
        title = card.find("h3")
        fecha = card.select_one(".fecha-card")
        if not (link and title and fecha):
            continue
        href = link["href"]
        img = card.find("img")
        raw_title = clean(title.get_text())
        # "Título | Sede": la sede suele venir después de la barra
        name, _, venue = raw_title.partition(" | ")
        src = img.get("src", "") if img else ""
        out.append({
            "title": name.strip(),
            "venue": venue.strip(),
            "url": href if href.startswith("http") else HOST + href,
            "date_text": clean(fecha.get_text(" ")),
            "spec": parse_range_ddmm(fecha.get_text(" "), today),
            "image": (HOST + src) if src.startswith("/") else src,
            "description": "",
        })
    return out


def _is_date_line(text: str) -> bool:
    """'29 DE Septiembre', 'DE 09:30': fragmentos de fecha/hora que no son sede ni dirección."""
    words = norm(text).split(" ")
    if len(words) < 2:
        return False
    return (words[0].isdigit() and words[1] == "de") or (words[0] == "de" and words[1].isdigit())


def parse_detail(html: str) -> dict:
    """Sede, dirección, horario, precio y descripción desde la página del evento."""
    soup = BeautifulSoup(html, "html.parser")
    out: dict = {}
    entrada = soup.select_one(".entrada-actividad")
    price = clean(entrada.get_text()) if entrada else ""
    out["free"] = price.lower().startswith("gratis")
    out["price_text"] = price
    box = soup.select_one(".tarjeta-fechas")
    if box:
        for junk in box.find_all(["svg", "script", "style"]):
            junk.decompose()
        lines = [clean(x) for x in box.get_text("\n").split("\n") if clean(x)]
        stop = {"cómo llego", "ver mapa", "gratis", "cuándo y dónde"}
        lines = [x for x in lines if x.lower() not in stop]
        rng = next((x for x in lines if x.upper().startswith(("DEL ", "EL ", "AL "))), "")
        hours = next((x for x in lines if x.lower().endswith(("horas", "hs", "h"))), "")
        days = next((x for x in lines if x.split(",")[0].split(" ")[0].lower() in DAY_WORDS), "")
        rest = [x for x in lines if x not in (rng, hours, days) and not _is_date_line(x)]
        out["venue"] = rest[0] if rest else ""
        out["address"] = rest[1] if len(rest) > 1 else ""
        parts = [rng.lower().capitalize() if rng else "", days, hours]
        out["date_text"] = " · ".join(p for p in parts if p)
    body = [clean(p.get_text()) for p in soup.select("main p, article p")]
    body = [p for p in body if len(p) > 60]
    out["description"] = body[0][:400] if body else ""
    return out


def enrich(ev: dict) -> None:
    try:
        d = parse_detail(fetch(ev["url"]))
    except Exception as exc:  # el detalle es un extra: si falla, queda la tarjeta
        print(f"  [muni] detalle {ev['url']}: {exc}")
        return
    ev["free"] = d["free"]
    ev["venue"] = ev["venue"] or d.get("venue", "")
    ev["address"] = d.get("address", "")
    ev["description"] = d.get("description", "")
    if d.get("date_text"):
        ev["date_text"] = d["date_text"]


def _crawl(url_for_page, today: date) -> list[dict]:
    seen: dict[str, dict] = {}
    for page in range(MAX_PAGES):
        try:
            html = fetch(url_for_page(page))
        except Exception as exc:
            print(f"  [muni] página {page}: {exc}")
            break
        cards = [c for c in parse_cards(html, today) if c["url"] not in seen]
        if not cards:
            break
        for c in cards:
            seen[c["url"]] = c
    return list(seen.values())


def scrape(today: date) -> list[dict]:
    by_url: dict[str, dict] = {}
    for tag_id, cat in TAGS.items():
        query = quote(f"etiquetas[{tag_id}]") + f"={tag_id}"
        items = _crawl(lambda p, q=query: f"{AGENDA}/buscar?{q}&page={p}", today)
        print(f"  [muni] {cat}: {len(items)} eventos")
        for it in items:
            ev = by_url.setdefault(it["url"], {**it, "categories": set()})
            ev["categories"].add(cat)
    # Portada: destacados sin etiqueta conocida
    for it in parse_cards(fetch(AGENDA), today):
        by_url.setdefault(it["url"], {**it, "categories": set()})
    events = []
    for ev in by_url.values():
        cats = sorted(ev.pop("categories")) or ["otros"]
        ev["category"] = cats[0]
        ev["all_categories"] = cats
        ev["plan"] = guess_plan(ev["title"], ev["category"], ev["description"])
        ev["source"] = SOURCE
        ev["free"] = False
        enrich(ev)
        ev["plan"] = guess_plan(ev["title"], ev["category"], ev["description"])
        events.append(ev)
    return events
