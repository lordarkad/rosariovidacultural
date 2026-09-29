"""Teatro Municipal La Comedia (teatrolacomedia.gob.ar): portada con el plugin MEC.

Cada función es una tarjeta con día ('06 octubre') y hora. Las funciones del mismo
espectáculo se agrupan por título para obtener una sola entrada con varias fechas.
"""
from __future__ import annotations

from datetime import date

from bs4 import BeautifulSoup

from .common import DateSpec, clean, extract_time, format_dates, guess_plan, norm, parse_spanish_dates

HOME = "https://teatrolacomedia.gob.ar/"
SOURCE = "Teatro La Comedia"
VENUE = "Teatro Municipal La Comedia"
ADDRESS = "Mitre 958"


def parse_home(html: str, today: date) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for art in soup.select("article.mec-event-article"):
        a = art.select_one("h4.mec-event-title a")
        day = art.select_one(".mec-start-date-label")
        if not (a and day):
            continue
        spec = parse_spanish_dates(day.get_text(), today)
        if not spec.dates:
            continue
        hour = art.select_one(".mec-start-time")
        img = art.find("img")
        out.append({
            "title": clean(a.get_text()), "url": a["href"], "date": spec.dates[0],
            "time": extract_time(hour.get_text()) if hour else "",
            "image": img.get("src", "") if img else "",
        })
    return out


def group(shows: list[dict]) -> list[dict]:
    """Una entrada por título, con todas sus funciones (usa la URL de la primera)."""
    by_title: dict[str, dict] = {}
    for s in sorted(shows, key=lambda x: x["date"]):
        ev = by_title.setdefault(norm(s["title"]), {**s, "dates": []})
        if s["date"] not in ev["dates"]:
            ev["dates"].append(s["date"])
        ev["times"] = sorted({*ev.get("times", []), s["time"]} - {""})
    return list(by_title.values())


def scrape(today: date, fetch=None) -> list[dict]:
    from .common import fetch as http_fetch
    html = (fetch or http_fetch)(HOME)
    events = []
    for ev in group(parse_home(html, today)):
        dates = sorted(ev["dates"])
        spec = DateSpec(start=dates[0], end=dates[-1], dates=dates)
        text = format_dates(dates)
        events.append({
            "title": ev["title"], "url": ev["url"], "spec": spec, "date_text": text,
            "time": " / ".join(ev["times"]), "venue": VENUE, "address": ADDRESS,
            "description": "", "image": ev["image"], "category": "teatro",
            "all_categories": ["teatro"], "plan": guess_plan(ev["title"], "teatro"),
            "source": SOURCE, "free": False,
        })
    return events
