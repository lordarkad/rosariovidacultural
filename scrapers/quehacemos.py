"""Qué Hacemos (quehacemos.com.ar): metabuscador de +50 fuentes, con API pública.

Es un agregador: cada evento se atribuye a su fuente primaria (la ticketera o el sitio que trae el
campo `link`, p. ej. Passline, Ticketek, Alternativa Teatral) y Qué Hacemos queda como segunda
fuente ("vía"). Sus coordenadas vienen en la respuesta, así que no hace falta geocodificar.

La API no pagina (`offset`/`page` no hacen nada) pero acepta `limit` hasta 1000 y `province`.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from urllib.parse import urlencode, urlparse

from .common import DateSpec, clean, fetch, format_dates, guess_plan, in_rosario_bbox, norm

API = "https://api.quehacemos.com.ar/api/v1/events/"
SITE = "https://www.quehacemos.com.ar/eventos"
SOURCE = "Qué Hacemos"
LIMIT = 1000

# event_type de la API -> categoría propia
CATEGORY = {
    "recital": "musica", "electronica": "musica", "cuarteto": "musica",
    "teatro": "teatro", "stand up": "teatro", "cine": "cine", "arte": "arte", "expo": "muestras",
    "familia": "chicos", "deporte": "deporte", "festival": "eventos", "fiesta": "eventos",
    "gastronomia": "eventos", "charla": "otros", "otro": "otros",
}
# dominio -> nombre para mostrar (los que no estén acá se muestran como dominio sin www/.com.ar)
NAMES = {
    "passline.com": "Passline", "ticketek.com.ar": "Ticketek", "alternativateatral.com": "Alternativa Teatral",
    "plateanet.com": "Plateanet", "alpogo.com": "Alpogo", "bandsintown.com": "Bandsintown",
    "tuentrada.com": "TuEntrada", "livepass.com.ar": "Livepass", "allaccess.com.ar": "AllAccess",
    "ticketway.com.ar": "Ticketway", "entradaplay.com": "Entradaplay", "venti": "Venti",
}


def source_name(source: str, link: str) -> str:
    """Nombre legible de la fuente primaria, con el campo `source` de la API como base."""
    key = (source or "").lower()
    if key in NAMES:
        return NAMES[key]
    host = urlparse(link or "").netloc.lower().removeprefix("www.")
    if host in NAMES:
        return NAMES[host]
    base = (source or host).lower().removeprefix("www.")
    return re.sub(r"\.(com|net|org)(\.ar)?$|\.ar$", "", base).capitalize() or SOURCE


def in_rosario(ev: dict) -> bool:
    if norm(ev.get("city") or "") == "rosario":
        return True
    lat, lon = ev.get("latitude"), ev.get("longitude")
    if lat is None or lon is None:
        return False
    return in_rosario_bbox(lat, lon)  # rescata eventos con la ciudad mal cargada


def clean_title(title: str) -> str:
    """'Show - Gira en Rosario | 22 De Noviembre' -> 'Show - Gira en Rosario' (la fecha ya va aparte)."""
    return clean(re.sub(r"\s*\|\s*\d{1,2}\s+de\s+\w+.*$", "", title or "", flags=re.I))


def event_url(ev: dict) -> str:
    """Página del evento en Qué Hacemos (mismo esquema que su RSS: slug-del-título + id)."""
    slug = re.sub(r"\s+", "-", norm(ev.get("title") or "")).strip("-")
    return f"{SITE}/{slug}-{ev['id']}" if slug else f"{SITE}/{ev['id']}"


def to_event(ev: dict, today: date) -> dict | None:
    """Evento de la API -> dict del pipeline (ver README). None si no sirve (pasado, sin fecha, otra ciudad)."""
    if ev.get("status") != "scheduled" or ev.get("is_past") or not in_rosario(ev):
        return None
    try:
        when = datetime.fromisoformat(ev["date"])
    except (KeyError, TypeError, ValueError):
        return None
    if when.date() < today:
        return None
    primary = ev.get("link") or ev.get("source_url") or ""
    if not primary.startswith(("https://", "http://")):
        return None  # sin link a la fuente no hay atribución posible
    day = when.date()
    price = ev.get("min_price") or ev.get("price")
    category = CATEGORY.get(ev.get("event_type") or "", "otros")
    title = clean_title(ev.get("title") or "")
    if not title:
        return None
    lat, lon = ev.get("latitude"), ev.get("longitude")
    desc = clean(ev.get("description") or "")
    out = {
        "title": title,
        "url": primary,
        "date_text": format_dates([day]),
        "spec": DateSpec(start=day, end=day, dates=[day]),
        # 00:00 y 23:59 son "sin horario" en varias ticketeras, no una hora real
        "time": "" if (when.hour, when.minute) in ((0, 0), (23, 59)) else when.strftime("%H:%M"),
        "venue": clean(ev.get("venue") or ""),
        "address": clean(ev.get("address") or ""),
        "description": desc[:400],
        "image": ev.get("image_url") or "",
        "category": category,
        "all_categories": [category],
        "plan": "gastronomia" if ev.get("event_type") == "gastronomia" else guess_plan(title, category, desc),
        "source": source_name(ev.get("source") or "", primary),
        "also": [{"name": SOURCE, "url": event_url(ev)}],
        "price_from": int(price) if price else None,
        "free": ev.get("price_type") == "gratis",
    }
    if lat is not None and lon is not None:
        out["coords"] = [[round(float(lat), 5), round(float(lon), 5)]]
    return out


def parse(payload: str, today: date) -> list[dict]:
    rows = json.loads(payload)
    return [e for e in (to_event(r, today) for r in rows) if e]


def scrape(today: date) -> list[dict]:
    seen: dict[str, dict] = {}
    # Dos consultas: la provincia (cubre lo bien cargado) y el texto "Rosario" (rescata provincia mal cargada)
    for params in ({"province": "Santa Fe"}, {"search": "Rosario"}):
        payload = fetch(f"{API}?{urlencode({**params, 'limit': LIMIT})}")
        rows = json.loads(payload)
        if len(rows) >= LIMIT:
            print(f"  [quehacemos] {params}: {len(rows)} filas = tope de la API, puede faltar data")
        for ev in (to_event(r, today) for r in rows):
            if ev:
                merge_showing(seen, ev)
    print(f"  [quehacemos] {len(seen)} eventos en Rosario")
    return list(seen.values())


def merge_showing(seen: dict[str, dict], ev: dict) -> None:
    """Varias funciones del mismo show comparten `link`: se unifican en un evento con todas las fechas."""
    cur = seen.setdefault(ev["url"], ev)
    if cur is ev:
        return
    dates = sorted(set(cur["spec"].dates) | set(ev["spec"].dates))
    cur["spec"] = DateSpec(start=dates[0], end=dates[-1], dates=dates)
    cur["date_text"] = format_dates(dates)
    if cur.get("time") != ev.get("time"):
        cur["time"] = ""  # horarios distintos entre funciones: no se afirma ninguno
