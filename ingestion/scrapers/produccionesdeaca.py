"""Producciones de Acá (ticketera.produccionesdeaca.com): productora rosarina de rock, sobre EventoSimple.

La portada lista sus eventos próximos; cada `/eventos/<slug>-e<N>` trae, en HTML, la fecha con hora
('28.NOV.2026 23:50hs'), el lugar con su dirección, el precio inicial, la descripción y un link a Google Maps
con las coordenadas. Es fuente primaria (vende las entradas). Los eventos pasados dicen 'Evento Finalizado'.
"""
from __future__ import annotations

import re
from datetime import date
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .common import (DateSpec, clean, fetch, format_dates, guess_category, guess_plan, http_url, in_rosario_bbox,
                     norm)

BASE = "https://ticketera.produccionesdeaca.com/"
SOURCE = "Producciones de Acá"
EVENT_HREF = re.compile(r"^/eventos/[a-z0-9-]+-e\d+$")
DATE_RE = re.compile(r"(\d{1,2})\.([A-Z]{3})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?")
MESES = {"ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6, "JUL": 7, "AGO": 8, "SEP": 9, "SET": 9,
         "OCT": 10, "NOV": 11, "DIC": 12}
MAPS_QUERY = re.compile(r"[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)")


def list_events(html: str) -> list[str]:
    """URLs absolutas de evento, sin repetir (el destacado y la grilla repiten los mismos)."""
    soup = BeautifulSoup(html, "html.parser")
    seen: dict[str, str] = {}
    for a in soup.find_all("a", href=EVENT_HREF):
        seen.setdefault(a["href"], urljoin(BASE, a["href"]))
    return list(seen.values())


def parse_when(text: str) -> tuple[date, str] | None:
    """'28.NOV.2026 23:50hs' -> (fecha, 'HH:MM'). None si el mes no se reconoce."""
    m = DATE_RE.search(text or "")
    if not m or m.group(2) not in MESES:
        return None
    try:
        day = date(int(m.group(3)), MESES[m.group(2)], int(m.group(1)))
    except ValueError:
        return None
    return day, (f"{int(m.group(4)):02d}:{m.group(5)}" if m.group(4) else "")


def parse_event(html: str, url: str, today: date) -> dict | None:
    """Evento de Rosario con fecha futura y a la venta, o None (finalizado, otra ciudad, sin fecha)."""
    soup = BeautifulSoup(html, "html.parser")
    main = soup.select_one("main[data-vista=evento]")
    if not main:
        return None
    card = main.select_one("section.evento article")  # data-estado='activo' | 'finalizado'; no mirar la descripción
    status = main.select_one("section.evento h3")  # 'En venta' | 'Evento Finalizado'
    if (card and card.get("data-estado") == "finalizado") or (status and "finalizado" in norm(status.get_text())):
        return None
    title_el = main.select_one("section.evento h2")
    when = parse_when(clean(main.select_one("section.evento .fecha h4").get_text())) if main.select_one(
        "section.evento .fecha h4") else None
    title = clean(title_el.get_text()) if title_el else ""
    if not when or not title or when[0] < today:
        return None
    lugar = main.select_one("section.evento .lugar h4")
    address_el = lugar.find("span") if lugar else None
    address = clean(address_el.get_text()) if address_el else ""
    venue = clean(lugar.get_text().replace(address, "", 1)) if lugar else ""
    link = main.select_one(".e-evento.lugar a[href*='maps']")
    coords = None
    if link:
        q = MAPS_QUERY.search(link["href"])
        coords = (float(q.group(1)), float(q.group(2))) if q else None
    if not ("rosario" in norm(address) or (coords and in_rosario_bbox(*coords))):
        return None
    price = main.select_one("section.evento .precio .es_precio")
    paras = [clean(p.get_text()) for p in main.select(".e-evento.descripcion p")]
    desc = " ".join(p for p in paras if p)
    og = soup.find("meta", property="og:image")
    day, hhmm = when
    category = guess_category(title, default="musica")  # la productora es de rock
    ev = {
        "title": title,
        "url": url,
        "date_text": format_dates([day]),
        "spec": DateSpec(start=day, end=day, dates=[day]),
        "time": hhmm,
        "venue": venue,
        "address": address,
        "description": desc[:400],
        "image": http_url(og["content"]) if og and og.get("content") else "",
        "category": category,
        "all_categories": [category],
        "plan": guess_plan(title, category, desc),
        "source": SOURCE,
        "free": False,
    }
    if price and price.get("data-valor", "").isdigit():
        ev["price_from"] = int(price["data-valor"])
    if coords:
        ev["coords"] = [list(coords)]
    return ev


def scrape(today: date) -> list[dict]:
    events = []
    for url in list_events(fetch(BASE)):
        try:
            ev = parse_event(fetch(url), url, today)
        except Exception as exc:  # noqa: BLE001 - un evento roto no frena el resto
            print(f"  [produccionesdeaca] {url}: {exc}")
            continue
        if ev:
            events.append(ev)
    print(f"  [produccionesdeaca] {len(events)} eventos en Rosario")
    return events
