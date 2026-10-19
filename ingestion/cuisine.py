"""Traduce al español los tipos de cocina de OpenStreetMap (`cuisine=*`, en inglés).

El contrato de /ingest deja `cuisine` como lista de strings; la UI los muestra tal cual, así que se traducen acá.
Un valor que el diccionario no conoce se conserva crudo (nunca se descarta información) y se resume una sola vez por
run con `unknown_summary` / `warning`, para ir ampliando el diccionario."""
from __future__ import annotations

import re

# Valores de places.json (2026-10-19) y errores de tipeo frecuentes de OSM; claves ya normalizadas (`normalize`).
_ES = {
    "burger": "hamburguesas", "pizza": "pizza", "sandwich": "sándwiches", "sandiwch": "sándwiches",
    "sub": "subs", "coffee shop": "café", "coffe shop": "café", "coffee": "café", "argentinian": "argentina",
    "regional": "regional", "local": "local", "empanada": "empanadas", "emapanada": "empanadas",
    "ice cream": "helados", "hot dog": "panchos", "hotdog": "panchos", "pastry": "pastelería",
    "bakery": "panadería", "cake": "tortas", "chicken": "pollo", "fried chicken": "pollo frito", "pasta": "pastas",
    "friture": "frituras", "fried food": "frituras", "italian": "italiana", "italian pizza": "pizza italiana",
    "sushi": "sushi", "breakfast": "desayunos", "brunch": "brunch", "milanesa": "milanesas",
    "grill": "parrilla", "parrilla": "parrilla", "barbecue": "parrilla", "barbaque": "parrilla",
    "steak house": "carnes", "meat": "carnes", "fish": "pescado", "seafood": "mariscos",
    "fish and chips": "fish and chips", "arab": "árabe", "picada": "picadas", "japanese": "japonesa",
    "american": "americana", "diner": "diner", "crepe": "crepes", "juice": "jugos", "smoothie": "licuados",
    "fast food": "comida rápida", "peruvian": "peruana", "chinese": "china", "mexican": "mexicana",
    "venezuelan": "venezolana", "asian": "asiática", "indian": "india", "spanish": "española",
    "latin american": "latinoamericana", "mediterranean": "mediterránea", "soup": "sopas", "salad": "ensaladas",
    "shawarma": "shawarma", "falafel": "falafel", "hemmos": "hummus", "kebbe": "kebbe", "kebab": "kebab",
    "backlawa": "baklava", "cocktails": "cócteles", "kitchen": "cocina", "snack": "snacks",
    "fine dining": "alta cocina", "noodles": "fideos", "ramen": "ramen", "wok": "wok", "bagel": "bagels",
    "bistro": "bistró", "bagna cauda": "bagna cauda",
}
# Un valor ya traducido pasa tal cual y no cuenta como «sin traducir» (reenvíos y curados).
_KNOWN = set(_ES.values())


def normalize(value: str) -> str:
    """Minúsculas, `_` como espacio y espacios colapsados: «Coffee_Shop» y « coffee shop » son lo mismo."""
    return re.sub(r"\s+", " ", (value or "").replace("_", " ")).strip().lower()


def translate(values: list[str]) -> list[str]:
    """Traduce cada valor (el desconocido queda normalizado pero en su idioma), sin repetidos y en el mismo orden."""
    out: list[str] = []
    for raw in values:
        v = normalize(raw)
        if not v:
            continue
        v = _ES.get(v, v)
        if v not in out:
            out.append(v)
    return out


def unknown_summary(lists: list[list[str]]) -> list[str]:
    """Valores distintos que ni el diccionario ni las traducciones conocen, ordenados; uno solo para todo el run."""
    unknown = {normalize(v) for values in lists for v in values}
    return sorted(v for v in unknown if v and v not in _ES and v not in _KNOWN)


def warning(lists: list[list[str]]) -> str | None:
    """Línea `::warning::` (GitHub Actions) con el resumen, o `None` si no hay nada sin traducir."""
    unknown = unknown_summary(lists)
    if not unknown:
        return None
    return f"::warning::Cocinas de OpenStreetMap sin traducir ({len(unknown)}): {', '.join(unknown)}"
