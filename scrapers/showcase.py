"""Showcase Rosario (Alto Rosario Shopping) vía la API JSON de Voy al Cine que usa su propio sitio."""
from __future__ import annotations

import json
from datetime import date

from .cine_common import cine_event
from .common import fetch as http_fetch

SOURCE = "Showcase Rosario"
VENUE = "Showcase Rosario"
ADDRESS = "Junín 501 (Alto Rosario Shopping)"
CINEMA_ID = 16
API = "https://api.voyalcine.net/films"
FILM_URL = "https://entradas.todoshowcase.com/showcase/pelicula?filmid={id}"
POSTER = "https://static.voyalcine.net/Uploads/i{id}.jpg"


def parse_tree(tree: dict, cinema_id: int = CINEMA_ID) -> dict[date, set[str]]:
    """Días y horarios de un cine dentro del árbol de una película."""
    out: dict[date, set[str]] = {}
    for day, cinemas in (tree.get("days") or {}).items():
        try:
            d = date.fromisoformat(day)
        except ValueError:
            continue
        for cinema in cinemas:
            if cinema.get("id") != cinema_id:
                continue
            for fmt in cinema.get("formats", []):
                for perf in fmt.get("performances", []):
                    t = str(perf.get("showTime", ""))
                    t = t[2:] if t.startswith("N ") else t
                    out.setdefault(d, set()).add(t)
    return out


def scrape(today: date, fetch=None) -> list[dict]:
    get = fetch or http_fetch
    films = json.loads(get(API))
    events = []
    for film in films:
        if not film.get("dB_Active"):
            continue
        tree = json.loads(get(f"{API}/{film['id']}/tree"))
        showings = {d: t for d, t in parse_tree(tree).items() if d >= today}
        ev = cine_event(title=tree.get("name") or film["name"], url=FILM_URL.format(id=film["id"]),
                        source=SOURCE, venue=VENUE, address=ADDRESS,
                        image=POSTER.format(id=film["id"]), showings=showings)
        if ev:
            events.append(ev)
    return events
