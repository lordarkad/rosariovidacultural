"""Arma los `IngestEvent` del contrato de /ingest (docs/api-spec.yml) a partir de los registros de events.json.

Solo transforma datos: no hace red ni escribe archivos. El envío a /ingest y el vínculo con lugares
(`place_source_key`) son pasos posteriores del slice.
"""
from __future__ import annotations

import hashlib
import re

from scrapers import venues as venues_mod
from scrapers.common import guess_genres, guess_intents, norm

_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_MUSIC_CATEGORIES = {"musica", "danza"}


def _feed(record: dict) -> str:
    return record.get("feed") or record["sources"][0]["name"]


def _source_key(record: dict, venue: str) -> str:
    """`<fuente>:<hash de URL primaria + sede>`: estable entre corridas y distinta por sede (E-2)."""
    digest = hashlib.sha256(f'{record["sources"][0]["url"]}|{norm(venue)}'.encode()).hexdigest()[:12]
    return f'{norm(_feed(record)).replace(" ", "-")}:{digest}'


def _price(record: dict) -> tuple[str, int | None]:
    price = record.get("price_from")
    if record.get("free"):
        return "free", None
    if price:
        return "paid", int(price)
    return "unknown", None


def to_ingest_events(record: dict, venues: list[dict]) -> list[dict]:
    """Un `IngestEvent` por sede: una película en 2 cines da 2 eventos con la misma `source_url` (E-2)."""
    parts = [p.strip() for p in record["venue"].split(" · ")] if record.get("venue") else [""]
    coords = record.get("coords") or []
    description = record.get("description") or ""
    categories = record.get("categories") or [record["category"]]
    intents = guess_intents(record["title"], description, categories, record.get("plan", "cultura"))
    musical = bool(_MUSIC_CATEGORIES & set(categories))  # «House of Gucci» (cine) no es electrónica
    price_status, price_from = _price(record)
    primary = record["sources"][0]
    out = []
    for i, part in enumerate(parts):
        place = venues_mod.venue_of({"venue": part}, venues) if part else None
        genres = (guess_genres(record["title"], description, place["genres"] if place else None)
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
            "start_time": time if _TIME.match(time) else None,
            "date_text": record.get("date_text") or None,
            "venue_name": part or None,
            "address": (record.get("address") or None) if len(parts) == 1 else None,
            "lat": located[0] if located else None,
            "lon": located[1] if located else None,
            "place_source_key": None,
            "price_status": price_status,
            "price_from_ars": price_from,
            "image_url": record.get("image") or None,
            "source_url": primary["url"],
            "via": record["sources"][1:],
        })
    return out
