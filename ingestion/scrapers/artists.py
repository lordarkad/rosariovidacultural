"""Artistas con género conocido: lista curada a mano en `data/artistas.json`.

Las fuentes casi no declaran género (ver B-3a en docs/changes/sitio-publico-busqueda.md) y la mayoría de los
títulos de música son solo el nombre del artista, que `guess_genres` no puede clasificar por palabras. Esta
lista cubre ese hueco: si el título nombra a un artista conocido, sus géneros pasan a `music_genres`.
Los géneros salen de Wikidata y Wikipedia (campo `source`) y los confirma una persona; no se asignan solos.
"""
from __future__ import annotations

import json
from pathlib import Path

from .common import MUSIC_GENRES, norm

SOURCE_FILE = Path(__file__).parent.parent / "data" / "artistas.json"
SOURCES = ("wikidata", "wikipedia", "manual")


class ArtistError(ValueError):
    pass


def validate(raw: dict, seen: set[str]) -> dict:
    """Artista curado -> artista normalizado. Falla fuerte: un error de carga no debe publicarse callado."""
    name = (raw.get("name") or "").strip()
    if not name:
        raise ArtistError("falta name")
    names = [norm(n) for n in [name, *raw.get("aliases", [])] if norm(n)]
    repeated = [n for n in names if n in seen]
    if repeated:
        raise ArtistError(f"{name}: nombre o alias repetido {repeated}")
    genres = list(dict.fromkeys(raw.get("genres") or []))
    bad = [g for g in genres if g not in MUSIC_GENRES]
    if not genres or bad:
        raise ArtistError(f"{name}: genres vacío o desconocido {bad} (válidos: {list(MUSIC_GENRES)})")
    source = raw.get("source") or "manual"
    if source not in SOURCES:
        raise ArtistError(f"{name}: source desconocido {source!r} (válidos: {list(SOURCES)})")
    seen.update(names)
    return {"name": name, "names": names, "genres": genres, "exact": bool(raw.get("exact")), "source": source}


def load(path: Path = SOURCE_FILE) -> list[dict]:
    if not path.exists():
        return []
    seen: set[str] = set()
    return [validate(a, seen) for a in json.loads(path.read_text(encoding="utf-8")).get("artists", [])]


def genres_of(title: str, artists: list[dict]) -> list[str]:
    """Géneros de los artistas que nombra el título. Nombre completo, como palabras; un nombre ambiguo
    (`exact`: «Pez», «Axel») solo cuenta si el título es exactamente ese nombre."""
    text = f" {norm(title)} "
    found: set[str] = set()
    for artist in artists:
        for name in artist["names"]:
            if (text.strip() == name) if artist["exact"] else (f" {name} " in text):
                found.update(artist["genres"])
                break
    return sorted(found)
