"""Corre los scrapers, unifica y escribe site/events.json.

Uso:  python build.py            (todas las fuentes)
      python build.py --only cartel
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from scrapers import (broadway, cartel, cinemark, comedia, disfrutarosario, mil_tickets, muni, noticias,
                      quehacemos, showcase, turboentrada)
from scrapers import geocode, venues
from scrapers.common import norm

ROOT = Path(__file__).parent
OUT = ROOT / "site" / "events.json"
NEWS_OUT = ROOT / "site" / "news.json"
VENUES_OUT = ROOT / "site" / "venues.json"
SOURCES = {"muni": muni, "cartel": cartel, "comedia": comedia, "broadway": broadway,
           "showcase": showcase, "cinemark": cinemark, "quehacemos": quehacemos,
           "disfrutarosario": disfrutarosario, "turboentrada": turboentrada, "mil_tickets": mil_tickets}
KEEP_PAST_DAYS = 0  # eventos terminados hace más de esto se descartan


def to_record(ev: dict) -> dict | None:
    spec = ev["spec"]
    if not spec.start:
        return None
    return {
        "id": hashlib.sha256(ev["url"].encode()).hexdigest()[:10],
        "title": ev["title"],
        "category": ev["category"],
        "categories": ev["all_categories"],
        "plan": ev["plan"],
        "venue": ev["venue"],
        "date_text": ev["date_text"],
        "start": spec.start.isoformat(),
        "end": spec.end.isoformat(),
        "ranged": spec.ranged,
        "dates": [d.isoformat() for d in spec.dates],
        "address": ev.get("address", ""),
        "time": ev.get("time", ""),
        "price_from": ev.get("price_from"),
        "free": bool(ev.get("free")),
        "image": ev["image"],
        "description": ev["description"],
        # fuente primaria primero; "also" son agregadores/notas que lo mencionan (atribución "vía")
        "sources": [{"name": ev["source"], "url": ev["url"]}, *ev.get("also", [])],
        **({"coords": ev["coords"]} if ev.get("coords") else {}),
    }


# Orden de citación de un evento con varias fuentes: 0 = quien vende la entrada, 1 = la sala u organizador,
# 2 = agendas, agregadores y notas editoriales. Lo que no está listado (ticketeras que solo conoce Qué
# Hacemos: Passline, Ticketek, Venti, Qrticket...) es fuente primaria y va primero.
SALAS = {"Teatro La Comedia", "Teatro Broadway", "Showcase Rosario", "Cinemark Rosario", "Agenda municipal"}
AGREGADORES = {"Qué Hacemos", "Bandsintown", "Rosario en Cartel", "Disfruta Rosario"}


def source_rank(name: str) -> int:
    return 2 if name in AGREGADORES else 1 if name in SALAS else 0


def sort_sources(records: list[dict]) -> None:
    """Ticketera primero. Orden estable: dentro de cada nivel se conserva el orden de llegada."""
    for rec in records:
        rec["sources"].sort(key=lambda s: source_rank(s["name"]))


def _overlap(a: dict, b: dict) -> bool:
    """Comparten alguna fecha (puntuales) o se pisan los rangos."""
    if a["ranged"] or b["ranged"]:
        return a["start"] <= b["end"] and b["start"] <= a["end"]
    return bool(set(a["dates"]) & set(b["dates"]))


def merge_duplicates(records: list[dict]) -> list[dict]:
    """Mismo título normalizado + fechas que se solapan = mismo evento en varias fuentes."""
    groups: dict[str, list[dict]] = {}
    for rec in records:
        bucket = groups.setdefault(norm(rec["title"]), [])
        cur = next((c for c in bucket if _overlap(c, rec)), None)
        if not cur:
            bucket.append(rec)
            continue
        if "cine" in cur["categories"] and "cine" in rec["categories"] and cur["venue"] != rec["venue"]:
            # misma película en cines distintos: horarios y dirección son de cada cine
            cur["venue"] = f'{cur["venue"]} · {rec["venue"]}'
            cur["address"] = cur["time"] = ""
            rec = {**rec, "address": "", "time": "", "venue": cur["venue"]}
        known = {s["url"] for s in cur["sources"]}
        cur["sources"] += [s for s in rec["sources"] if s["url"] not in known]
        cur["free"] = cur["free"] or rec["free"]
        cur["price_from"] = cur.get("price_from") or rec.get("price_from")
        for field in ("venue", "address", "image", "description", "time", "coords"):
            cur[field] = cur.get(field) or rec.get(field, "")
        cur["categories"] = sorted(set(cur["categories"]) | set(rec["categories"]))
        if not cur["ranged"] and not rec["ranged"]:
            cur["dates"] = sorted(set(cur["dates"]) | set(rec["dates"]))
        cur["start"], cur["end"] = min(cur["start"], rec["start"]), max(cur["end"], rec["end"])
        if len(rec["sources"]) and rec["sources"][0]["name"] in ("Teatro La Comedia", "Teatro Broadway"):
            cur["date_text"] = rec["date_text"] or cur["date_text"]  # la sala manda en sus fechas
    merged = [c for bucket in groups.values() for c in bucket]
    sort_sources(merged)
    return merged


def add_coords(events: list[dict]) -> None:
    """coords = [[lat, lon], ...], una por sede (una película en 2 cines tiene 2). Vacío si no se pudo ubicar."""
    cache = geocode.load_cache()
    for ev in events:
        if ev.get("coords"):
            continue  # la fuente ya trae coordenadas (p. ej. Qué Hacemos): no se geocodifica
        parts = [v.strip() for v in ev["venue"].split(" · ")] if ev["venue"] else [""]
        addr = ev["address"] if len(parts) == 1 else ""
        found = [geocode.locate(p, addr if i == 0 else "", cache) for i, p in enumerate(parts)]
        ev["coords"] = [list(c) for c in found if c]
    geocode.save_cache(cache)


def feed_of(record: dict) -> str:
    """Scraper que trajo el evento. Con fuentes agregadoras la primera fuente citada ya no lo identifica."""
    return record.get("feed") or record["sources"][0]["name"]


def build_news(only: str | None) -> dict:
    """Notas de prensa culturales -> site/news.json. Si el feed falla se conserva el archivo anterior."""
    if only:
        return {}
    print(f"== {noticias.SOURCE}")
    try:
        items = noticias.scrape()
    except Exception as exc:  # noqa: BLE001
        print(f"  FALLÓ: {exc}. Se conserva news.json anterior.")
        return {noticias.SOURCE: {"ok": False, "error": str(exc)}}
    payload = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "source": noticias.SOURCE, "items": items}
    NEWS_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    return {noticias.SOURCE: {"ok": True, "count": len(items)}}


def build_venues(events: list[dict]) -> None:
    """Espacios curados + sus próximos eventos -> site/venues.json. Un error en data/venues.json corta el build."""
    items = venues.build(events)
    payload = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "offers": venues.OFFERS, "venues": items}
    VENUES_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"== Espacios: {len(items)} ({sum(v['upcoming_count'] for v in items)} eventos vinculados)")


def load_previous() -> dict:
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=list(SOURCES), help="correr una sola fuente")
    args = parser.parse_args()

    today = date.today()
    prev_data = load_previous()
    previous = prev_data.get("events", [])
    records: list[dict] = []
    status: dict[str, dict] = {}
    for key, mod in SOURCES.items():
        if args.only and args.only != key:
            # fuente no pedida: se conserva lo anterior
            records += [r for r in previous if feed_of(r) == mod.SOURCE]
            if mod.SOURCE in prev_data.get("sources", {}):
                status[mod.SOURCE] = prev_data["sources"][mod.SOURCE]
            continue
        print(f"== {mod.SOURCE}")
        try:
            raw = mod.scrape(today)
        except Exception as exc:  # noqa: BLE001 - una fuente caída no debe borrar el resto
            print(f"  FALLÓ: {exc}. Se conservan los eventos anteriores de esta fuente.")
            records += [r for r in previous if feed_of(r) == mod.SOURCE]
            status[mod.SOURCE] = {"ok": False, "error": str(exc)}
            continue
        parsed = [{**r, "feed": mod.SOURCE} for r in (to_record(e) for e in raw) if r]
        print(f"  {len(raw)} crudos, {len(parsed)} con fecha válida")
        status[mod.SOURCE] = {"ok": True, "count": len(parsed), "sin_fecha": len(raw) - len(parsed)}
        records += parsed

    cutoff = (today - timedelta(days=KEEP_PAST_DAYS)).isoformat()
    records = [r for r in records if r["end"] >= cutoff]
    events = merge_duplicates(records)
    events.sort(key=lambda r: (r["start"], r["title"]))
    add_coords(events)
    build_venues(events)  # antes de escribir events.json: agrega venue_id a cada evento
    status.update(build_news(args.only))
    if args.only and noticias.SOURCE in prev_data.get("sources", {}):
        status[noticias.SOURCE] = prev_data["sources"][noticias.SOURCE]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": status,
        "events": events,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n{len(events)} eventos -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
