"""Espacios (venues): lugares que albergan eventos y tienen perfil propio (música en vivo, cena, baile).

A diferencia de `places.json` (directorio de OSM para comer y tomar algo), acá la lista es curada a mano en
`data/venues.json`. Este módulo la valida, vincula cada espacio con los eventos ya ingeridos (por el nombre
con que las fuentes escriben la sede), resuelve sus coordenadas y arma `site/venues.json`.
Un espacio sin eventos igual aparece: es un lugar donde ir, no solo una agenda.
"""
from __future__ import annotations

import json
import re
import statistics
from pathlib import Path

from . import geocode
from .common import norm

SOURCE_FILE = Path(__file__).parent.parent / "data" / "venues.json"
# Qué ofrece un espacio. Ampliar acá y en el sitio (se lee de venues.json, no está duplicado en el HTML).
OFFERS = {"musica_en_vivo": "Música en vivo", "cena": "Cena", "baile": "Baile"}
UPCOMING = 5  # próximos eventos que se muestran por espacio
_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")


class VenueError(ValueError):
    pass


def _http(url: str) -> bool:
    return isinstance(url, str) and url.startswith(("https://", "http://"))


def validate(raw: dict, seen: set[str]) -> dict:
    """Espacio curado -> espacio normalizado. Falla fuerte: un error de carga no debe publicarse callado."""
    vid = raw.get("id", "")
    if not _ID.match(vid) or vid in seen:
        raise VenueError(f"id inválido o repetido: {vid!r}")
    name = (raw.get("name") or "").strip()
    if not name:
        raise VenueError(f"{vid}: falta name")
    unknown = [o for o in raw.get("offers", []) if o not in OFFERS]
    if unknown or not raw.get("offers"):
        raise VenueError(f"{vid}: offers vacío o desconocido {unknown} (válidos: {sorted(OFFERS)})")
    handle = (raw.get("instagram") or "").strip().lstrip("@")
    if handle and not _HANDLE.match(handle):
        raise VenueError(f"{vid}: instagram debe ser solo el usuario, no {raw['instagram']!r}")
    website = (raw.get("website") or "").strip()
    if website and not _http(website):
        raise VenueError(f"{vid}: website debe ser http(s)")
    infos = raw.get("info_sources") or []
    if any(not _http(s.get("url")) or not s.get("name") for s in infos):
        raise VenueError(f"{vid}: info_sources necesita name y url http(s)")
    aliases = {norm(a) for a in [name, *raw.get("aliases", [])] if norm(a)}
    return {
        "id": vid, "name": name, "aliases": sorted(aliases), "address": (raw.get("address") or "").strip(),
        "offers": list(dict.fromkeys(raw["offers"])), "instagram": handle, "website": website,
        "note": (raw.get("note") or "").strip(), "info_sources": infos,
        "lat": raw.get("lat"), "lon": raw.get("lon"),
    }


def load(path: Path = SOURCE_FILE) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    seen: set[str] = set()
    out = []
    for raw in data.get("venues", []):
        v = validate(raw, seen)
        seen.add(v["id"])
        out.append(v)
    return out


def venue_of(event: dict, venues: list[dict]) -> dict | None:
    """Espacio al que pertenece el evento: algún alias aparece completo (por palabras) en el nombre de la sede."""
    where = f" {norm(event.get('venue', ''))} "
    if not where.strip():
        return None
    return next((v for v in venues if any(f" {a} " in where for a in v["aliases"])), None)


def _summary(ev: dict) -> dict:
    src = ev["sources"][0]
    return {"id": ev["id"], "title": ev["title"], "start": ev["start"], "date_text": ev["date_text"],
            "time": ev["time"], "url": src["url"], "source": src["name"], "free": ev["free"],
            "price_from": ev.get("price_from")}


def _coords(venue: dict, events: list[dict], cache: dict) -> tuple[float, float] | None:
    """Coordenadas: las cargadas a mano; si no, la mediana de las de sus eventos; si no, geocodificar."""
    if venue["lat"] is not None and venue["lon"] is not None:
        return float(venue["lat"]), float(venue["lon"])
    pts = [e["coords"][0] for e in events if e.get("coords")]
    if pts:
        return (round(statistics.median(p[0] for p in pts), 5), round(statistics.median(p[1] for p in pts), 5))
    return geocode.locate(venue["name"], venue["address"], cache)


def build(events: list[dict], venues: list[dict] | None = None, cache: dict | None = None) -> list[dict]:
    """Vincula eventos (les agrega `venue_id`) y devuelve los espacios listos para publicar."""
    venues = load() if venues is None else venues
    own_cache = cache is None
    cache = geocode.load_cache() if own_cache else cache
    by_venue: dict[str, list[dict]] = {v["id"]: [] for v in venues}
    for ev in events:
        ev.pop("venue_id", None)  # eventos guardados de una corrida anterior pueden traer un espacio ya quitado
        v = venue_of(ev, venues)
        if v:
            ev["venue_id"] = v["id"]
            by_venue[v["id"]].append(ev)
    out = []
    for v in venues:
        evs = sorted(by_venue[v["id"]], key=lambda e: (e["start"], e["title"]))
        pos = _coords(v, evs, cache)
        out.append({
            "id": v["id"], "name": v["name"], "address": v["address"],
            "lat": pos[0] if pos else None, "lon": pos[1] if pos else None,
            "offers": v["offers"], "instagram": v["instagram"], "website": v["website"], "note": v["note"],
            "info_sources": v["info_sources"],
            "upcoming_count": len(evs), "upcoming": [_summary(e) for e in evs[:UPCOMING]],
        })
    if own_cache:
        geocode.save_cache(cache)
    return out
