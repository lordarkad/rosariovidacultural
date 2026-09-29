"""Coordenadas de sedes de eventos vía Nominatim (OpenStreetMap), con caché en disco.

Política de uso de Nominatim: máx. 1 pedido/seg, User-Agent propio y cachear resultados.
La caché (data/geocache.json) se versiona: cada sede se consulta una sola vez.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
from pathlib import Path

from .common import clean, fetch, norm

CACHE = Path(__file__).parent.parent / "data" / "geocache.json"
API = "https://nominatim.openstreetmap.org/search"
# Rosario: oeste, norte, este, sur (viewbox de Nominatim); bounded=1 evita homónimos de otras ciudades
VIEWBOX = "-60.85,-32.85,-60.55,-33.05"


def load_cache() -> dict:
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")


def _strip_parens(text: str) -> str:
    out, depth = [], 0
    for ch in text:
        depth += ch == "("
        if depth == 0:
            out.append(ch)
        depth -= ch == ")" and depth > 0
    return clean("".join(out))


_failed: set[str] = set()  # claves que fallaron por red en esta corrida: no reintentar por cada evento


def _looks_like_date(text: str) -> bool:
    """'29 DE Septiembre': fragmento de fecha que el scraper leyó como sede."""
    words = norm(text).split(" ")
    return len(words) >= 3 and words[0].isdigit() and words[1] == "de"


def _search(query: str) -> tuple[float, float] | None:
    url = f"{API}?{urllib.parse.urlencode({'q': query, 'format': 'jsonv2', 'limit': 1, 'viewbox': VIEWBOX, 'bounded': 1, 'countrycodes': 'ar'})}"
    time.sleep(1.5)  # sumado a la pausa de fetch(): < 1 pedido cada 2 s (Nominatim limita fuerte)
    for attempt in range(3):
        try:
            rows = json.loads(fetch(url))
            break
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 2:
                raise
            time.sleep(20 * (attempt + 1))  # límite de Nominatim: esperar y reintentar
    return (round(float(rows[0]["lat"]), 5), round(float(rows[0]["lon"]), 5)) if rows else None


def _swapped(address: str) -> str:
    """'LOPEZ ESTANISLAO 2250' -> 'ESTANISLAO LOPEZ 2250' (la agenda municipal escribe Apellido Nombre)."""
    words = address.split(" ")
    if len(words) >= 3 and words[-1].isdigit() and not any(w.isdigit() for w in words[:-1]):
        return " ".join([*reversed(words[:-1]), words[-1]])
    return ""


def locate(venue: str, address: str, cache: dict) -> tuple[float, float] | None:
    """Coordenadas de una sede: primero por dirección, si no por nombre. Usa y completa la caché."""
    venue, address = _strip_parens(venue), _strip_parens(address)
    key = norm(f"{venue}|{address}")
    if not key.strip("|"):
        return None
    if _looks_like_date(venue):
        return None
    if key in _failed:
        return None
    if key in cache:
        return tuple(cache[key]) if cache[key] else None
    if not any(ch.isdigit() for ch in address):
        address = ""  # 'Paga', 'Consultar'...: no es una dirección
    name = clean(venue.split(" / ")[0].split(" - ")[0])
    swapped = _swapped(address)
    # El nombre es más fiable que las numeraciones de OSM; la dirección queda de respaldo
    queries = ([f"{name}, Rosario"] if name else [])         + ([f"{swapped}, Rosario, Santa Fe"] if swapped else [])         + ([f"{address}, Rosario, Santa Fe"] if address else [])
    found = None
    for q in queries:
        try:
            found = _search(q)
        except Exception as exc:  # red caída: no se cachea, se reintenta la próxima vez
            print(f"  [geocode] {q}: {exc}")
            _failed.add(key)
            return None
        if found:
            break
    cache[key] = list(found) if found else None
    return found
