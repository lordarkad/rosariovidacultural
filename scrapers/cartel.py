"""Rosario en Cartel (rosarioencartel.com.ar): listados por categoría, HTML.

El sitio es WordPress pero la API REST no expone la fecha del evento, que solo
aparece como texto ('Sábado 3 de octubre') en los listados de categoría.
"""
from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup

from .common import DateSpec, clean, fetch, guess_plan, parse_spanish_dates

BASE = "https://www.rosarioencartel.com.ar"
SOURCE = "Rosario en Cartel"
# 'cine' se omite en v1: usa otra estructura (en cartel / estrenos), sin fechas por función.
CATEGORIES = ["musica", "teatro", "danza", "arte", "chicos", "eventos", "gratis"]
MAX_PAGES = 12


def parse_listing(html: str, today: date) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for box in soup.select("div.box-info"):
        link = box.find("a", href=True)
        title = box.select_one("h3.title")
        fecha = box.select_one("h5.fecha")
        if not (link and title and fecha):
            continue
        place = box.select_one("p.place")
        desc = box.select_one("p.place-dir")
        img = box.find("img")
        spec: DateSpec = parse_spanish_dates(fecha.get_text(), today)
        out.append({
            "title": clean(title.get_text()),
            "url": link["href"],
            "date_text": clean(fecha.get_text()),
            "spec": spec,
            "venue": re.sub(r"^LUGAR:\s*", "", clean(place.get_text()), flags=re.I) if place else "",
            "description": clean(desc.get_text()) if desc else "",
            "image": img.get("src", "") if img else "",
        })
    return out


def has_next(html: str) -> bool:
    return "next page-numbers" in html


def scrape(today: date) -> list[dict]:
    """Devuelve eventos únicos por URL, con las categorías en las que aparecen."""
    by_url: dict[str, dict] = {}
    for cat in CATEGORIES:
        seen_in_cat: set[str] = set()
        for page in range(1, MAX_PAGES + 1):
            url = f"{BASE}/category/{cat}/" + (f"?cpage={page}" if page > 1 else "")
            try:
                html = fetch(url)
            except Exception as exc:  # una categoría rota no debe frenar todo
                print(f"  [cartel] {url}: {exc}")
                break
            items = parse_listing(html, today)
            new = [i for i in items if i["url"] not in seen_in_cat]
            if not new:
                break
            for it in new:
                seen_in_cat.add(it["url"])
                ev = by_url.setdefault(it["url"], {**it, "categories": set(), "free": False})
                if cat == "gratis":
                    ev["free"] = True
                else:
                    ev["categories"].add(cat)
            if not has_next(html):
                break
        print(f"  [cartel] {cat}: {len(seen_in_cat)} eventos")
    events = []
    for ev in by_url.values():
        cats = sorted(ev.pop("categories")) or ["eventos"]
        ev["category"] = cats[0]
        ev["all_categories"] = cats
        ev["plan"] = guess_plan(ev["title"], ev["category"], ev["description"])
        ev["source"] = SOURCE
        events.append(ev)
    return events
