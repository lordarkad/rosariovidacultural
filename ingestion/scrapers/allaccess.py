"""AllAccess (allaccess.com.ar): ticketera sobre la plataforma Crowder. Fuente primaria.

No hay feed ni sitemap, y su API (`/api/...`) rechaza a los clientes que no son un navegador, así que no se usa.
Lo que se lee sin problema: la portada, que destaca ~25 shows de todo el país, y la página de cada evento, con un
`<script type="application/ld+json">` (`Event` de schema.org) que trae ciudad, sede, fecha y precios. Se recorren
los links de la portada y se queda con los de Rosario: sale un show cada tanto (recitales grandes), por eso corre
una vez por semana (`WEEKDAY`). El JSON-LD solo informa la primera función del evento.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta

from .common import DateSpec, clean, fetch, format_dates, guess_category, guess_plan, http_url, norm

HOME = "https://www.allaccess.com.ar/"
SOURCE = "AllAccess"
WEEKDAY = 0  # lunes: build.py solo corre esta fuente ese día y conserva lo anterior el resto
MAX_EVENTS = 60  # tope de seguridad: la portada trae ~25
EVENT_LINK = re.compile(r"https://www\.allaccess\.com\.ar/event/[A-Za-z0-9_-]+")
LD_JSON = re.compile(r"<script[^>]*ld\+json[^>]*>(.*?)</script>", re.S | re.I)
OG_IMAGE = re.compile(r"og:image[\"']\s+content=[\"']([^\"']+)")
ARGENTINA = timedelta(hours=-3)  # sin horario de verano


def local_start(raw: object) -> datetime | None:
    """'2026-11-07T00:00:00Z' (UTC) -> hora de Rosario, 2026-11-06 21:00. Sin zona se toma como local."""
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    return (parsed + ARGENTINA).replace(tzinfo=None) if parsed.tzinfo else parsed


def to_event(item: dict, today: date, image: str = "") -> dict | None:
    """JSON-LD -> dict del pipeline. None si no es un evento de Rosario con fecha futura y link."""
    if not isinstance(item, dict) or not str(item.get("@type", "")).endswith("Event"):
        return None
    place = item.get("location") if isinstance(item.get("location"), dict) else {}
    addr = place.get("address") if isinstance(place.get("address"), dict) else {}
    if "rosario" not in norm(str(addr.get("addressLocality") or "")):
        return None
    start = local_start(item.get("startDate"))
    title = clean(item.get("name") or "")
    link = http_url(item.get("url"))
    if not start or start.date() < today or not title or not link:
        return None
    description = clean(item.get("description") or "")
    category = guess_category(title, default="musica")
    prices = [o["price"] for o in item.get("offers") or [] if isinstance(o, dict) and isinstance(o.get("price"), (int, float))]
    ev = {
        "title": title,
        "url": link,
        "date_text": format_dates([start.date()]),
        "spec": DateSpec(start=start.date(), end=start.date(), dates=[start.date()]),
        "time": start.strftime("%H:%M"),
        "venue": clean(place.get("name") or ""),
        "address": clean(str(addr.get("streetAddress") or "")),
        "description": "" if norm(description) == norm(title) else description[:400],  # suele repetir el título
        "image": http_url(item.get("image")) or http_url(image),
        "category": category,
        "all_categories": [category],
        "plan": guess_plan(title, category, description),
        "source": SOURCE,
        "free": False,
    }
    if prices and min(prices) > 0:
        ev["price_from"] = int(min(prices))
    return ev


def parse_event(html: str, today: date) -> dict | None:
    og = OG_IMAGE.search(html)
    for block in LD_JSON.findall(html):
        try:
            data = json.loads(block)
        except ValueError:
            continue  # un bloque roto no frena el resto
        for item in data if isinstance(data, list) else [data]:
            ev = to_event(item, today, og.group(1) if og else "")
            if ev:
                return ev
    return None


def scrape(today: date) -> list[dict]:
    links = sorted(set(EVENT_LINK.findall(fetch(HOME))))[:MAX_EVENTS]
    events = []
    for url in links:
        try:
            ev = parse_event(fetch(url), today)
        except Exception as exc:  # noqa: BLE001 - un evento roto no frena el resto
            print(f"  [allaccess] {url}: {exc}")
            continue
        if ev:
            events.append(ev)
    print(f"  [allaccess] {len(events)} eventos en Rosario de {len(links)} en portada")
    return events
