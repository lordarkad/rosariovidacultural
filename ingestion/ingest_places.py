"""Arma los `IngestPlace` del contrato de /ingest (docs/api-spec.yml) a partir de places.json (OSM) y venues.json
(espacios curados). Solo transforma datos: el envío lo hace publish.py."""
from __future__ import annotations

import re

import cuisine
import opening_hours
from scrapers.common import http_url, norm

# places_osm.KIND guarda el nombre para mostrar; acá se pasa al PlaceKind del contrato
_OSM_KINDS = {"restaurante": "restaurante", "bar": "bar", "cafe": "cafe", "heladeria": "heladeria",
              "comida rapida": "comida_rapida"}
# Decidido por Daniel (2026-10-16): un café o una heladería sirven para comer y para tomar algo; (2026-10-18) un bar también.
_KIND_INTENTS = {"restaurante": ["comer"], "comida_rapida": ["comer"], "bar": ["comer", "tomar_algo"],
                 "cafe": ["comer", "tomar_algo"], "heladeria": ["comer", "tomar_algo"]}
_OFFER_INTENTS = {"musica_en_vivo": "musica_en_vivo", "cena": "comer", "baile": "bailar"}
_INTENT_ORDER = ("comer", "tomar_algo", "espectaculo", "musica_en_vivo", "bailar", "con_chicos")
_HANDLE = re.compile(r"^(?:https?://(?:www\.)?instagram\.com/)?@?([A-Za-z0-9._]{1,30})/?(?:\?.*)?$")
_NOT_HANDLES = {"p", "reel", "reels", "explore", "stories", "tv"}  # rutas de instagram.com que no son un perfil


def _handle(raw: str) -> str | None:
    m = _HANDLE.match((raw or "").strip())
    return m.group(1) if m and m.group(1) not in _NOT_HANDLES else None


def _image(raw: str) -> str | None:
    return http_url(raw) or None  # sin host la API lo rechaza (format: uri)


def _ordered(intents: set[str]) -> list[str]:
    return [i for i in _INTENT_ORDER if i in intents]


def osm_place(raw: dict) -> dict:
    kind = _OSM_KINDS.get(norm(raw.get("kind", "")), "otro")
    hours = (raw.get("hours") or "").strip()
    return {
        "source_key": f'osm:{raw["id"]}',
        "name": raw["name"],
        "kind": kind,
        "origin": "osm",
        "intents": _KIND_INTENTS.get(kind, []),
        "offers": [],
        "cuisine": cuisine.translate(raw.get("cuisine") or []),
        "address": raw.get("address") or None,
        "lat": raw["lat"],
        "lon": raw["lon"],
        "opening_hours": opening_hours.parse(hours),
        "hours_text": hours or None,
        "phone": raw.get("phone") or None,
        "website": raw.get("website") or None,
        "instagram": _handle(raw.get("instagram", "")),
        "outdoor": raw["outdoor"] if isinstance(raw.get("outdoor"), bool) else None,  # False = OSM dice «no»
        "note": None,
        "image_url": _image(raw.get("image", "")),
    }


def curated_place(raw: dict) -> dict | None:
    """Espacio curado. Sin coordenadas no se publica: `lat` y `lon` son obligatorios en el contrato."""
    if raw.get("lat") is None or raw.get("lon") is None:
        return None
    kind = raw.get("kind") or "sala"
    intents = {_OFFER_INTENTS[o] for o in raw.get("offers", []) if o in _OFFER_INTENTS}
    if kind == "bar":
        intents.update(_KIND_INTENTS["bar"])
    return {
        "source_key": f'curated:{raw["id"]}',
        "name": raw["name"],
        "kind": kind,
        "origin": "curated",
        "intents": _ordered(intents),
        "offers": raw.get("offers", []),
        "cuisine": [],
        "address": raw.get("address") or None,
        "lat": raw["lat"],
        "lon": raw["lon"],
        "opening_hours": None,
        "hours_text": None,
        "phone": None,
        "website": raw.get("website") or None,
        "instagram": raw.get("instagram") or None,
        "outdoor": None,
        "note": raw.get("note") or None,
        "image_url": _image(raw.get("image_url", "")),
    }
