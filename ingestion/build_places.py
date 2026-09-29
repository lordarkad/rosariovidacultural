"""Genera site/places.json (directorio de lugares). Si la consulta falla, conserva el archivo anterior."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from scrapers import places_osm

OUT = Path(__file__).parent / "site" / "places.json"


def main() -> int:
    try:
        previous = json.loads(OUT.read_text(encoding="utf-8")).get("places", [])
    except (OSError, ValueError):
        previous = []
    places, failed = places_osm.scrape(previous)
    total = places_osm.GRID[0] * places_osm.GRID[1]
    if failed > total // 2 or not places:
        print(f"Fallaron {failed}/{total} mosaicos: se deja places.json como estaba.")
        return 1
    OUT.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "incomplete_tiles": failed,
        "attribution": "© colaboradores de OpenStreetMap (ODbL)",
        "places": places,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(places)} lugares -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
