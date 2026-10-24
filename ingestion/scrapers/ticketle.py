"""Ticketle (ticketle.com.ar): marketplace de entradas para conciertos y giras. Fuente secundaria.

La página `/rosario` trae un `<script type="application/ld+json">` por evento (`MusicEvent` de schema.org) con
nombre, fecha, sede, imagen y link. No informa hora, y el precio es el de reventa/internacional (cientos de miles
de pesos), así que NO se publica: la entrada la vende otra ticketera que ya cubrimos, y ahí está el precio real.
Por eso va rankeada como agregador: si el mismo show llega de TurboEntrada o Passline, esa fuente va primero.
"""
from __future__ import annotations

import json
import re
from datetime import date

from .common import DateSpec, clean, fetch, format_dates, guess_category, guess_plan, http_url, norm

URL = "https://www.ticketle.com.ar/rosario"
SOURCE = "Ticketle"
MAX_PAGES = 10  # tope de seguridad: hoy son 2 (51 eventos)
NEXT_PAGE = re.compile(r"data-element=[\"']?next-page")
LD_JSON = re.compile(r"<script[^>]*ld\+json[^>]*>(.*?)</script>", re.S | re.I)


def to_event(item: dict, today: date) -> dict | None:
    """JSON-LD -> dict del pipeline. None si no es un evento de Rosario con fecha futura y link."""
    if not isinstance(item, dict) or not str(item.get("@type", "")).endswith("Event"):
        return None
    place = item.get("location") if isinstance(item.get("location"), dict) else {}
    addr = place.get("address") if isinstance(place.get("address"), dict) else {}
    if "rosario" not in norm(str(addr.get("addressLocality") or "")):
        return None
    try:
        day = date.fromisoformat(str(item.get("startDate"))[:10])
    except ValueError:
        return None
    title = clean(item.get("name") or "")
    link = http_url(item.get("url"))
    if day < today or not title or not link:
        return None
    category = guess_category(title, default="musica")
    return {
        "title": title,
        "url": link,
        "date_text": format_dates([day]),
        "spec": DateSpec(start=day, end=day, dates=[day]),
        "time": "",
        "venue": clean(place.get("name") or ""),
        "address": "",
        "description": "",  # el texto es una plantilla ('Concierto de X en Rosario el ...'): no aporta
        "image": http_url(item.get("image")),
        "category": category,
        "all_categories": [category],
        "plan": guess_plan(title, category),
        "source": SOURCE,
        "free": False,
    }


def parse(html: str, today: date) -> list[dict]:
    events = []
    for block in LD_JSON.findall(html):
        try:
            data = json.loads(block)
        except ValueError:
            continue  # un bloque roto no frena el resto
        for item in data if isinstance(data, list) else [data]:
            ev = to_event(item, today)
            if ev:
                events.append(ev)
    return events


def scrape(today: date) -> list[dict]:
    """El listado es paginado (50 por página, sin orden por fecha): se sigue `data-element=next-page`."""
    events: list[dict] = []
    seen: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        html = fetch(URL if page == 1 else f"{URL}?page={page}")
        new = [e for e in parse(html, today) if e["url"] not in seen]
        seen.update(e["url"] for e in new)
        events += new
        if not NEXT_PAGE.search(html) or not new:
            break
    print(f"  [ticketle] {len(events)} eventos en Rosario")
    return events
