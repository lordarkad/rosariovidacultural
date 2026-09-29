"""TurboEntrada (turboentrada.com): ticketera de recitales y shows grandes, sobre la plataforma EntradaUno.

El sitio es una SPA que consume dos endpoints JSON públicos (los mismos que usa su front):
  - /v2/EspectaculosCartel  -> shows con nombre, imagen, link de compra y su próxima función
  - /v2/Establecimientos    -> sedes con ciudad, domicilio y el mapa embebido (de ahí salen las coordenadas)
Es una fuente primaria (vende las entradas), así que el link va directo a la página de compra.
Cada ítem de la cartelera es una función/fecha; una gira con varias fechas trae un ítem por fecha.
"""
from __future__ import annotations

import json
from datetime import date, datetime

from .common import (DateSpec, clean, coords_from_embed, fetch, format_dates, guess_category, guess_plan,
                     in_rosario_bbox, norm)

API = "https://api-ecommerce-live-turboentrada.entradauno.com/v1/api/v2"
SOURCE = "TurboEntrada"
# Etiquetas de imagen preferidas, de más a menos útil para una tarjeta
IMAGE_LABELS = ("WEB_TOP", "WEB_DESTACADO", "WEB_CARRUSEL_GRANDE", "WEB_CARRUSEL_CHICO")


def venue_info(est: dict) -> dict:
    """Sede normalizada: nombre, dirección, coordenadas y si es de Rosario."""
    coords = coords_from_embed(est.get("cGoogleMapTag") or "")
    place = norm(" ".join(str(est.get(k) or "") for k in ("cCiudad", "cZona", "cDomicilio")))
    return {
        "name": clean(est.get("cNombre") or ""),
        "address": clean(est.get("cDomicilio") or ""),
        "coords": coords,
        # Varias sedes de Rosario vienen con cCiudad vacío: el mapa o el domicilio lo aclaran
        "rosario": "rosario" in place or bool(coords and in_rosario_bbox(*coords)),
    }


def pick_image(images: list[dict] | None) -> str:
    by_label = {lab: img["cUri"] for img in images or [] for lab in img.get("listaEtiquetas", []) if img.get("cUri")}
    return next((by_label[l] for l in IMAGE_LABELS if l in by_label), "")


def to_event(show: dict, venues: dict[int, dict], today: date) -> dict | None:
    """Ítem de cartelera -> dict del pipeline. None si no es de Rosario, no tiene fecha futura o no tiene link."""
    site = [venues[i] for i in show.get("listaIdEstablecimiento") or [] if i in venues]
    site = next((v for v in site if v["rosario"]), None)
    if not site:
        return None
    try:
        when = datetime.fromisoformat(show["oFuncionMenor"]["oFuncionFecha"]["dFuncion"])
    except (KeyError, TypeError, ValueError):
        return None  # sin función publicada (el show existe pero todavía no tiene fecha)
    link = show.get("cWebUri") or ""
    title = clean(show.get("cNombre") or "")
    if when.date() < today or not title or not link.startswith(("https://", "http://")):
        return None
    day = when.date()
    category = guess_category(title, default="musica")  # la cartelera es casi toda recitales; deporte/teatro se detectan por título
    ev = {
        "title": title,
        "url": link,
        "date_text": format_dates([day]),
        "spec": DateSpec(start=day, end=day, dates=[day]),
        "time": when.strftime("%H:%M") if show["oFuncionMenor"].get("bIncluyeHora") else "",
        "venue": site["name"],
        "address": site["address"],
        "description": clean(show.get("cDescripcion") or "")[:400],
        "image": pick_image(show.get("listaImagenes")),
        "category": category,
        "all_categories": [category],
        "plan": guess_plan(title, category),
        "source": SOURCE,
        "free": False,
    }
    if site["coords"]:
        ev["coords"] = [list(site["coords"])]
    return ev


def parse(shows_json: str, venues_json: str, today: date) -> list[dict]:
    shows = json.loads(shows_json)["oData"]["listaEspectaculoCartel"]
    ests = json.loads(venues_json)["oData"]["listaEstablecimiento"]
    venues = {e["idEstablecimiento"]: venue_info(e) for e in ests}
    return [e for e in (to_event(s, venues, today) for s in shows) if e]


def scrape(today: date) -> list[dict]:
    events = parse(fetch(f"{API}/EspectaculosCartel"), fetch(f"{API}/Establecimientos"), today)
    print(f"  [turboentrada] {len(events)} eventos en Rosario")
    return events
