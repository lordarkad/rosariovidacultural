"""Arma los `IngestEvent` del contrato de /ingest (docs/api-spec.yml) a partir de los registros de events.json.

Solo transforma datos: no hace red ni escribe archivos. El envío a /ingest lo hace publish.py.
"""
from __future__ import annotations

import hashlib
import re

from scrapers import artists as artists_mod
from scrapers import venues as venues_mod
from scrapers.common import feed_of, guess_genres, guess_intents, norm, split_venues

_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d")  # «15:10 / 17:55» (varias funciones) conserva la primera
_MUSIC_CATEGORIES = {"musica", "danza"}


_VOLATILE_PARAM = re.compile(r"[?&]cHashValidacion=[^&#]*")  # TurboEntrada firma cada link y la firma rota


def _source_key(record: dict, venue: str) -> str:
    """`<fuente>:<hash de la URL de esa fuente + sede>`. Se ancla a la fuente que trajo el evento (`feed`), no a
    `sources[0]`: al fusionar duplicados la ticketera pasa primera y la clave cambiaría, duplicando la fila.
    La URL se normaliza sin parámetros que cambian entre corridas; el link publicado (`source_url`) no se toca."""
    feed = feed_of(record)
    url = next((s["url"] for s in record["sources"] if s["name"] == feed), record["sources"][0]["url"])
    url = _VOLATILE_PARAM.sub("", url)
    digest = hashlib.sha256(f"{url}|{norm(venue)}".encode()).hexdigest()[:12]
    return f'{norm(feed).replace(" ", "-")}:{digest}'


def _price(record: dict) -> tuple[str, int | None]:
    price = record.get("price_from")
    if record.get("free"):
        return "free", None
    if price:
        return "paid", int(price)
    return "unknown", None


def to_ingest_events(record: dict, venues: list[dict], artists: list[dict] | None = None) -> list[dict]:
    """Un `IngestEvent` por sede: una película en 2 cines da 2 eventos con la misma `source_url` (E-2)."""
    parts = split_venues(record.get("venue") or "")
    coords = record.get("coords") or []
    description = record.get("description") or ""
    categories = record.get("categories") or [record["category"]]
    intents = guess_intents(record["title"], description, categories, record.get("plan", "cultura"))
    hints = set(record.get("genre_hints") or [])  # lo que declaró la propia fuente (p. ej. «Fiestas electrónicas»)
    hints |= set(artists_mod.genres_of(record["title"], artists or []))  # artistas curados (data/artistas.json)
    musical = bool(_MUSIC_CATEGORIES & set(categories)) or bool(hints)  # «House of Gucci» (cine) no es electrónica
    price_status, price_from = _price(record)
    primary = record["sources"][0]
    out = []
    for i, part in enumerate(parts):
        place = venues_mod.venue_of({"venue": part}, venues) if part else None
        genres = (guess_genres(record["title"], description, sorted(hints | set(place["genres"] if place else [])))
                  if musical else [])
        located = coords[i] if len(coords) == len(parts) else None
        time = record.get("time") or ""
        out.append({
            "source_key": _source_key(record, part),
            "title": record["title"],
            "description": description or None,
            "intents": intents,
            "music_genres": genres,
            "start_date": record["start"],
            "end_date": record["end"],
            "start_time": time[:5] if _TIME.match(time) else None,
            "date_text": record.get("date_text") or None,
            "venue_name": part or None,
            "address": (record.get("address") or None) if len(parts) == 1 else None,
            "lat": located[0] if located else None,
            "lon": located[1] if located else None,
            "place_source_key": f'curated:{place["id"]}' if place else None,
            "price_status": price_status,
            "price_from_ars": price_from,
            "image_url": record.get("image") or None,
            "source_url": primary["url"],
            "via": record["sources"][1:],
        })
    return out
