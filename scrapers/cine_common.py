"""Piezas comunes de los scrapers de cines: una entrada por película y cine."""
from __future__ import annotations

from datetime import date

from .common import DateSpec, format_dates

SMALL = {"de", "la", "el", "los", "las", "y", "en", "del", "un", "una", "a", "por", "con", "al"}
MAX_TIMES = 6


def smart_title(text: str) -> str:
    """'RESIDENT EVIL: NOCHE CERO' -> 'Resident Evil: Noche Cero' (solo si viene todo en mayúsculas)."""
    if text != text.upper():
        return text
    words = text.lower().split(" ")
    return " ".join(w if (i and w in SMALL) else w[:1].upper() + w[1:] for i, w in enumerate(words))


def cine_event(*, title: str, url: str, source: str, venue: str, address: str, image: str,
               showings: dict[date, set[str]]) -> dict | None:
    """showings: día -> horarios ('HH:MM'). Devuelve None si no hay funciones."""
    if not showings:
        return None
    dates = sorted(showings)
    times = sorted({t for ts in showings.values() for t in ts})
    shown = times[:MAX_TIMES] + (["…"] if len(times) > MAX_TIMES else [])
    return {
        "title": smart_title(title), "url": url, "spec": DateSpec(start=dates[0], end=dates[-1], dates=dates),
        "date_text": format_dates(dates), "time": " / ".join(shown), "venue": venue, "address": address,
        "description": "", "image": image, "category": "cine", "all_categories": ["cine"],
        "plan": "cultura", "source": source, "free": False,
    }
