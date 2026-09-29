"""Teatro Broadway Rosario (teatrobroadwayrosario.com): cartelera + detalle por show.

El detalle lista 'Fechas y horarios' (ej. 'Viernes 6 de Noviembre a las 21:00 Hs.')
y 'Ubicaciones y precios' (ej. 'Platea Alta — $ 60000').
"""
from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup

from .common import (DateSpec, clean, extract_time, fetch as http_fetch, format_dates, guess_plan,
                     parse_spanish_dates, strip_time)

BASE = "https://teatrobroadwayrosario.com"
SOURCE = "Teatro Broadway"
VENUE = "Teatro Broadway"


def list_shows(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls = {a["href"] for a in soup.select("article.tbr-show-card a[href]")}
    return sorted(u for u in urls if "/cartelera/" in u)


def parse_show(html: str, today: date) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    for junk in soup.find_all(["script", "style", "svg", "nav", "footer"]):
        junk.decompose()
    lines = [clean(x) for x in soup.get_text("\n").split("\n") if clean(x)]
    try:
        i = next(k for k, l in enumerate(lines) if l.lower().startswith("fechas y horarios"))
    except StopIteration:
        return None
    dates, times = [], []
    for l in lines[i + 1:]:
        if l.lower().startswith(("más información", "mas informacion")):
            break
        spec = parse_spanish_dates(strip_time(l), today)
        if spec.dates:
            dates += spec.dates
            times.append(extract_time(l))
    if not dates:
        return None
    prices = [int(p.replace(".", "")) for l in lines for p in re.findall(r"\$\s*([\d.]+)", l)]
    prices = [p for p in prices if p >= 1000]
    page = BeautifulSoup(html, "html.parser")
    og = page.find("meta", property="og:image")
    # El <title> es 'Show | Teatro Broadway Rosario'; el h1 trae etiquetas como 'EN VENTA!!'
    name = clean(page.title.get_text().split("|")[0]) if page.title else ""
    return {
        "title": name or clean(lines[0].split("|")[0]),
        "dates": sorted(set(dates)),
        "times": sorted({t for t in times if t}),
        "price_from": min(prices) if prices else None,
        "image": og["content"] if og and og.get("content") else "",
    }


def scrape(today: date, fetch=None) -> list[dict]:
    get = fetch or http_fetch
    events = []
    for url in list_shows(get(BASE + "/")):
        try:
            show = parse_show(get(url), today)
        except Exception as exc:  # un show roto no frena la cartelera
            print(f"  [broadway] {url}: {exc}")
            continue
        if not show:
            continue
        d = show["dates"]
        events.append({
            "title": show["title"], "url": url,
            "spec": DateSpec(start=d[0], end=d[-1], dates=d[:60]),
            "date_text": format_dates(d), "time": " / ".join(show["times"]),
            "venue": VENUE, "address": "", "description": "", "image": show["image"],
            "price_from": show["price_from"], "category": "eventos", "all_categories": ["eventos"],
            "plan": guess_plan(show["title"], "eventos"), "source": SOURCE, "free": False,
        })
    return events
