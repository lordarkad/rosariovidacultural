"""Cinemark Rosario (Portal Rosario): la cartelera trae las funciones como JSON-LD (ScreeningEvent)."""
from __future__ import annotations

import json
from datetime import date

from bs4 import BeautifulSoup

from .cine_common import cine_event
from .common import clean
from .common import fetch as http_fetch

SOURCE = "Cinemark Rosario"
VENUE = "Cinemark Rosario"
ADDRESS = "Nansen 255 (Portal Rosario)"
URL = "https://www.cinemark.com.ar/cartelera/rosario"


def parse_screenings(html: str) -> list[dict]:
    """Lista de {title, url, image, day, time} tomada de los bloques JSON-LD."""
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for block in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(block.string or "")
        except ValueError:
            continue
        for ev in data.get("event", []) if isinstance(data, dict) else []:
            if ev.get("@type") != "ScreeningEvent":
                continue
            start = str(ev.get("startDate", ""))  # '2026-09-29T15:40:00.000Z-03:00'
            work = ev.get("workPresented") or {}
            try:
                day = date.fromisoformat(start[:10])
            except ValueError:
                continue
            out.append({
                "title": clean(work.get("name", "")), "day": day, "time": start[11:16],
                "image": work.get("image", ""), "url": (ev.get("offers") or {}).get("url", ""),
            })
    return out


def scrape(today: date, fetch=None) -> list[dict]:
    html = (fetch or http_fetch)(URL)
    films: dict[str, dict] = {}
    for s in parse_screenings(html):
        if not s["title"] or s["day"] < today:
            continue
        f = films.setdefault(s["title"], {"image": s["image"], "url": s["url"] or URL, "showings": {}})
        f["showings"].setdefault(s["day"], set()).add(s["time"])
    events = [cine_event(title=t, url=f["url"], source=SOURCE, venue=VENUE, address=ADDRESS,
                         image=f["image"], showings=f["showings"]) for t, f in films.items()]
    return [e for e in events if e]
