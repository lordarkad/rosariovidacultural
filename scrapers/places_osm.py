"""Lugares de gastronomía en Rosario desde OpenStreetMap (Overpass API).

No son eventos: es un directorio. Datos © colaboradores de OpenStreetMap (ODbL).
Se consulta por mosaicos chicos porque los servidores públicos fallan con áreas grandes.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request

from .common import USER_AGENT, clean, norm

HOSTS = ["https://overpass-api.de/api/interpreter"]  # kumi.systems y private.coffee daban timeout en las pruebas
# Rosario: sur, oeste, norte, este
BBOX = (-33.02, -60.80, -32.86, -60.58)
GRID = (4, 4)  # filas, columnas
AMENITIES = "restaurant|cafe|bar|pub|ice_cream|fast_food"
KIND = {"restaurant": "Restaurante", "cafe": "Café", "bar": "Bar", "pub": "Bar", "ice_cream": "Heladería",
        "fast_food": "Comida rápida"}


def _tiles():
    s, w, n, e = BBOX
    rows, cols = GRID
    for r in range(rows):
        for c in range(cols):
            yield (s + (n - s) * r / rows, w + (e - w) * c / cols,
                   s + (n - s) * (r + 1) / rows, w + (e - w) * (c + 1) / cols)


def _query(bbox) -> list[dict]:
    box = ",".join(f"{v:.5f}" for v in bbox)
    q = f'[out:json][timeout:90];nwr["amenity"~"^({AMENITIES})$"]["name"]({box});out center tags;'
    last: Exception | None = None
    for attempt in range(3):
        host = HOSTS[attempt % len(HOSTS)]
        try:
            req = urllib.request.Request(host + "?data=" + urllib.parse.quote(q), headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as resp:  # nosec - hosts fijos
                return json.load(resp)["elements"]
        except Exception as exc:
            last = exc
            time.sleep(15 * (attempt + 1))  # 429/504: el servidor está cargado, esperar
    raise RuntimeError(f"Overpass falló: {last}")


def to_place(el: dict) -> dict | None:
    tags = el.get("tags", {})
    lat = el.get("lat") or el.get("center", {}).get("lat")
    lon = el.get("lon") or el.get("center", {}).get("lon")
    name = clean(tags.get("name", ""))
    if not (name and lat and lon):
        return None
    street = clean(tags.get("addr:street", ""))
    number = clean(tags.get("addr:housenumber", ""))
    site = tags.get("website") or tags.get("contact:website") or ""
    cuisine = [c.strip().replace("_", " ") for c in tags.get("cuisine", "").split(";") if c.strip()]
    return {
        "id": f"{el['type'][0]}{el['id']}",
        "name": name,
        "kind": KIND.get(tags.get("amenity", ""), "Otro"),
        "cuisine": cuisine,
        "address": clean(f"{street} {number}"),
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "hours": clean(tags.get("opening_hours", "")),
        "phone": clean(tags.get("phone") or tags.get("contact:phone") or ""),
        "website": site if site.startswith(("http://", "https://")) else "",
        "instagram": clean(tags.get("contact:instagram", "")),
        "outdoor": tags.get("outdoor_seating") == "yes",
    }


def in_tile(place: dict, tile) -> bool:
    s_, w, n, e = tile
    return s_ <= place["lat"] < n and w <= place["lon"] < e


def scrape(previous: list[dict] | None = None) -> tuple[list[dict], int]:
    """Devuelve (lugares, mosaicos_fallidos). Si un mosaico falla se conservan los lugares
    previos que caen en él, así una caída del servidor no vacía el directorio."""
    seen: dict[str, dict] = {}
    failed = 0
    for i, tile in enumerate(_tiles(), 1):
        try:
            elements = _query(tile)
        except RuntimeError as exc:
            failed += 1
            kept = [p for p in (previous or []) if in_tile(p, tile)]
            seen.update({p["id"]: p for p in kept})
            print(f"  [osm] mosaico {i}: {exc} (se conservan {len(kept)} previos)")
            continue
        for el in elements:
            p = to_place(el)
            if p:
                seen[p["id"]] = p
        print(f"  [osm] mosaico {i}/{GRID[0] * GRID[1]}: {len(elements)} (acumulado {len(seen)})", flush=True)
        time.sleep(2)
    return sorted(seen.values(), key=lambda p: norm(p["name"])), failed
