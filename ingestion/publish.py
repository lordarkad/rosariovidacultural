"""Publica lugares (site/venues.json, site/places.json) y eventos (site/events.json) a POST /api/ingest (docs/api-spec.yml, operationId ingestBatch).

Uso:  INGEST_URL=https://…/api/ingest INGEST_TOKEN=… python publish.py [--dry-run]

Un lote por fuente (el contrato fija `source` por lote) y de a 200 como máximo, en serie: el Worker tiene un
presupuesto de llamadas a D1 por request y el dedupe (E-10) depende del orden de llegada. Van primero los lugares
curados, después los de OSM (el curado absorbe al OSM equivalente) y al final los eventos.
"""
from __future__ import annotations

import argparse
import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import cuisine
from ingest_payload import to_ingest_events
from ingest_places import curated_place, osm_place
from scrapers import venues as venues_mod
from scrapers.common import feed_of

ROOT = Path(__file__).parent
EVENTS = ROOT / "site" / "events.json"
PLACES = ROOT / "site" / "places.json"
VENUES = ROOT / "site" / "venues.json"
MAX_BATCH = 200  # maxItems del contrato
SALAS = {"Teatro La Comedia", "Teatro Broadway", "Showcase Rosario", "Cinemark Rosario", "Agenda municipal"}
RETRIES = 3  # solo ante 5xx o red; 4xx no se reintenta


def tier_of(feed: str) -> str:
    """Prioridad de la fuente para el dedupe (E-10): la sala o la agenda oficial pesa más que un agregador."""
    return "official" if feed in SALAS else "aggregator"


def build_batches(records: list[dict], venues: list[dict], generated_at: str) -> list[dict]:
    """Agrupa los IngestEvent por fuente y los parte en lotes de MAX_BATCH. Orden estable: fuentes por aparición."""
    by_feed: dict[str, list[dict]] = {}
    for record in records:
        by_feed.setdefault(feed_of(record), []).extend(to_ingest_events(record, venues))
    batches = []
    for feed, events in by_feed.items():
        for i in range(0, len(events), MAX_BATCH):
            batches.append({"source": {"name": feed, "tier": tier_of(feed)}, "generated_at": generated_at,
                            "events": events[i:i + MAX_BATCH]})
    return batches


def _chunks(key: str, source: dict, items: list[dict], generated_at: str) -> list[dict]:
    return [{"source": source, "generated_at": generated_at, key: items[i:i + MAX_BATCH]}
            for i in range(0, len(items), MAX_BATCH)]


def build_place_batches(curated: list[dict], osm: list[dict], generated_at: str) -> list[dict]:
    """Lotes de lugares: primero los curados (tier `curated`), después los de OpenStreetMap."""
    curated_items = [p for p in (curated_place(v) for v in curated) if p]
    osm_items = [osm_place(p) for p in osm]
    return (_chunks("places", {"name": "Curados", "tier": "curated"}, curated_items, generated_at)
            + _chunks("places", {"name": "OpenStreetMap", "tier": "aggregator"}, osm_items, generated_at))


class IngestError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def post_batch(url: str, token: str, batch: dict, timeout: int = 60, sleep=time.sleep) -> dict:
    """POST de un lote; devuelve `data` del envelope. Reintenta 5xx y errores de red; 4xx corta de inmediato."""
    body = json.dumps(batch, ensure_ascii=False).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "rosario-agenda-bot"})
    last: IngestError | None = None
    for attempt in range(RETRIES):
        if attempt:
            sleep(2 ** attempt)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec - el esquema se valida en main
                envelope = json.loads(resp.read())
            if not envelope.get("success"):
                raise IngestError(f"respuesta sin success: {str(envelope)[:200]}")
            return envelope["data"]
        except urllib.error.HTTPError as exc:
            detail = exc.read()[:200].decode("utf-8", "replace")
            last = IngestError(f"HTTP {exc.code}: {detail}", exc.code)
            if exc.code < 500:
                raise last from exc
        except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError) as exc:
            last = IngestError(f"{type(exc).__name__}: {exc}")
    assert last is not None
    raise last


def publish(url: str, token: str, batches: list[dict], post=post_batch) -> tuple[dict, list[str]]:
    """Envía los lotes en serie. Un lote fallido no frena los demás, salvo 401/403: con token malo todos fallarían."""
    totals = {"created": 0, "updated": 0, "rejected": 0}
    failures: list[str] = []
    for batch in batches:
        kind = "places" if "places" in batch else "events"
        label = f'{batch["source"]["name"]} ({len(batch[kind])} {"lugares" if kind == "places" else "eventos"})'
        try:
            data = post(url, token, batch)
        except IngestError as exc:
            failures.append(f"{label}: {exc}")
            print(f"  FALLÓ {label}: {exc}")
            if exc.status in (401, 403):
                break
            continue
        counts = data.get(kind, {})
        totals["created"] += counts.get("created", 0)
        totals["updated"] += counts.get("updated", 0)
        rejected = data.get("rejected", [])
        totals["rejected"] += len(rejected)
        print(f"  {label}: {counts}, rechazados {len(rejected)}")
        for item in rejected[:5]:
            print(f"    rechazado: {item}")
    return totals, failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="arma los lotes y los cuenta, sin enviar")
    args = parser.parse_args()

    data = json.loads(EVENTS.read_text(encoding="utf-8"))
    generated_at = data.get("generated_at") or datetime.now(timezone.utc).isoformat(timespec="seconds")
    curated = json.loads(VENUES.read_text(encoding="utf-8")).get("venues", []) if VENUES.exists() else []
    osm = json.loads(PLACES.read_text(encoding="utf-8")).get("places", []) if PLACES.exists() else []
    batches = build_place_batches(curated, osm, generated_at) + build_batches(data["events"], venues_mod.load(),
                                                                              generated_at)
    n_places = sum(len(b.get("places", [])) for b in batches)
    n_events = sum(len(b.get("events", [])) for b in batches)
    print(f"{len(data['events'])} registros -> {n_events} eventos y {n_places} lugares en {len(batches)} lotes")
    if untranslated := cuisine.warning([p.get("cuisine") or [] for p in osm]):
        print(untranslated)
    if args.dry_run:
        return 0

    url, token = os.environ.get("INGEST_URL", ""), os.environ.get("INGEST_TOKEN", "")
    if not url or not token:
        print("::warning::INGEST_URL o INGEST_TOKEN sin configurar: no se publicó a la API")
        return 0
    if not url.startswith("https://"):
        print("INGEST_URL debe ser https://")
        return 2

    totals, failures = publish(url, token, batches)
    print(f"\ncreados {totals['created']}, actualizados {totals['updated']}, rechazados {totals['rejected']}")
    for failure in failures:
        print(f"::error::{failure}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
