"""Alpogo (alpogo.com): ticketera argentina. Fuente primaria, link directo a la compra.

El front consulta `POST /api/events/getEvents2` (JSON, público, paginado por `limit`/`offset`); se filtra por la
provincia de Santa Fe y después por ciudad. Trae una fila por evento con su próxima función: fecha y hora,
sede como texto `Sala, Ciudad`, precio mínimo, imagen y actividad. No informa dirección ni coordenadas.
"""
from __future__ import annotations

import json
from datetime import date, datetime

from bs4 import BeautifulSoup

from . import geocode
from .common import DateSpec, clean, fetch, format_dates, guess_category, guess_plan, http_url, norm

API = "https://alpogo.com/api/events/getEvents2"
SOURCE = "Alpogo"
SANTA_FE_ID = "20"  # provincia_id de Santa Fe (GET /inicio/provincias_ajax)
PAGE = 50
MAX_PAGES = 10  # tope de seguridad: hoy toda la provincia entra en una página (17 eventos)
# Categoría por la actividad que declara la ticketera; el título la afina (guess_category)
ACTIVITY = {"teatro": "teatro", "recital": "musica", "festival": "musica", "fiesta disco": "musica",
            "pena": "musica", "tributo": "musica", "cultural": "eventos", "deporte": "deporte"}


def split_lugar(lugar: str) -> tuple[str, str]:
    """'Casona, Rosario.' -> ('Casona', 'Rosario'). Sin coma no hay ciudad: ('Jaguar Haüs', '')."""
    name, sep, city = clean(lugar).rpartition(",")
    return (clean(name), clean(city).rstrip(".").strip()) if sep else (clean(lugar), "")


def in_rosario(venue: str, city: str, cache: dict) -> bool:
    """La ciudad dice Rosario, o la ticketera puso solo la provincia ('Santa Fe') / nada y la sede se ubica en Rosario.

    Una ciudad explícita distinta (Venado Tuerto, Colonia Aldao) descarta el evento sin geocodificar.
    """
    if "rosario" in norm(f"{venue} {city}"):
        return True
    if norm(city) not in ("", "santa fe"):
        return False
    return geocode.locate(venue, "", cache) is not None


def to_event(row: dict, today: date, cache: dict) -> dict | None:
    """Fila de la API -> dict del pipeline. None si no es de Rosario, está oculta, ya pasó o no tiene link."""
    venue, city = split_lugar(row.get("lugar") or "")
    try:
        start = datetime.fromisoformat(str(row.get("fecha_funcion")))
    except ValueError:
        return None
    title = clean(row.get("nombre") or "")
    link = http_url(row.get("url"))
    if str(row.get("visible")) != "1" or start.date() < today or not title or not link:
        return None
    if not in_rosario(venue, city, cache):
        return None
    desc = clean(BeautifulSoup(row.get("descripcion_corta") or row.get("descripcion") or "", "html.parser").get_text(" "))
    category = guess_category(title, default=ACTIVITY.get(norm(row.get("actividad") or ""), "eventos"))
    ev = {
        "title": title,
        "url": link,
        "date_text": format_dates([start.date()]),
        "spec": DateSpec(start=start.date(), end=start.date(), dates=[start.date()]),
        "time": start.strftime("%H:%M"),
        "venue": venue,
        "address": "",
        "description": desc[:400],
        "image": http_url(row.get("imagen_grilla")) or http_url(row.get("imagen_logo")),
        "category": category,
        "all_categories": [category],
        "plan": guess_plan(title, category, desc),
        "source": SOURCE,
        "free": str(row.get("gratuito")) == "1",
    }
    try:
        price = int(float(row.get("menor_precio") or 0))
    except ValueError:
        price = 0
    if price > 0:  # 0 = la API no informa precio, no que sea gratis
        ev["price_from"] = price
    return ev


def scrape(today: date) -> list[dict]:
    cache = geocode.load_cache()
    events: dict[str, dict] = {}
    for page in range(MAX_PAGES):
        batch = json.loads(fetch(API, payload={"limit": PAGE, "offset": page * PAGE, "eventos_estado": "activo",
                                               "funciones_estado": "activo", "provincia_id": SANTA_FE_ID}))
        for row in batch:
            ev = to_event(row, today, cache)
            if ev:
                events.setdefault(ev["url"], ev)
        if len(batch) < PAGE:
            break
    geocode.save_cache(cache)
    print(f"  [alpogo] {len(events)} eventos en Rosario")
    return list(events.values())
