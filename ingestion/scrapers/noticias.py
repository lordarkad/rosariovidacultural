"""Rosario Noticias (rosarionoticias.gob.ar): prensa de la Municipalidad, vía RSS.

Son notas de prensa, no eventos: las fechas de los eventos están dentro del texto y no siguen un
formato. Por eso NO van a events.json sino a news.json ("novedades"), filtradas a las categorías
culturales/turísticas, siempre con link a la nota original.
El RSS se lee con regex (no con un parser XML) para no depender de entidades externas del feed.
"""
from __future__ import annotations

import html
import re
from email.utils import parsedate_to_datetime

from .common import clean, fetch

FEED = "https://www.rosarionoticias.gob.ar/rss/rss.php"
SOURCE = "Rosario Noticias"
KEEP = {"cultura", "turismo"}  # categorías del feed que interesan a una agenda de planes


def _tag(block: str, tag: str) -> str:
    m = re.search(rf"<{tag}\b[^>]*>(.*?)</{tag}>", block, re.S)
    if not m:
        return ""
    body = m.group(1).strip()
    cdata = re.fullmatch(r"<!\[CDATA\[(.*)\]\]>", body, re.S)
    return html.unescape(cdata.group(1) if cdata else body).strip()


def parse_feed(xml: str) -> list[dict]:
    out = []
    for block in re.findall(r"<item>(.*?)</item>", xml, re.S):
        cats = [clean(c) for c in _tag(block, "category").split(",") if clean(c)]
        if not {norm_cat(c) for c in cats} & KEEP:
            continue
        link = _tag(block, "link")
        if not link.startswith(("https://", "http://")):
            continue
        try:
            published = parsedate_to_datetime(_tag(block, "pubDate")).isoformat(timespec="minutes")
        except (TypeError, ValueError):
            published = ""
        img = re.search(r'<media:content[^>]*\burl="([^"]+)"', block)
        out.append({
            "title": clean(_tag(block, "title")),
            "url": link,
            "summary": clean(_tag(block, "description"))[:400],
            "image": html.unescape(img.group(1)) if img else "",
            "published": published,
            "categories": cats,
            "source": SOURCE,
        })
    return out


def norm_cat(text: str) -> str:
    return text.strip().lower().replace("í", "i").replace("ú", "u")


def scrape() -> list[dict]:
    items = parse_feed(fetch(FEED))
    print(f"  [noticias] {len(items)} notas culturales/turísticas")
    return items
