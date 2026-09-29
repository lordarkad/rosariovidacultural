"""1000Tickets (1000tickets.ar): ticketera con teatros y eventos de la región. Fuente primaria (vende las entradas).

La portada lista los eventos en un menú; cada `evento?id_evento=N` trae, en HTML, las fechas con horario
('02/10 21:00hs - 03/10 20:00hs'), el lugar, la dirección y un mapa embebido (de ahí salen las
coordenadas). No informa precio: se calcula en el carrito con JS. Solo se conservan los de Rosario.
"""
from __future__ import annotations

import re
from datetime import date
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .common import (DateSpec, _year_for, _mk, clean, coords_from_embed, fetch, format_dates, guess_category,
                     guess_plan, in_rosario_bbox, norm)

BASE = "https://www.1000tickets.ar/"
SOURCE = "1000Tickets"
DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?")


def list_events(html: str) -> list[str]:
    """URLs absolutas de evento, sin repetir (el mismo evento aparece en varios menús)."""
    soup = BeautifulSoup(html, "html.parser")
    seen: dict[str, str] = {}
    for a in soup.find_all("a", href=re.compile(r"^evento\?id_evento=\d+")):
        eid = re.search(r"id_evento=(\d+)", a["href"]).group(1)
        seen.setdefault(eid, urljoin(BASE, a["href"]))
    return list(seen.values())


def _field(soup: BeautifulSoup, label: str) -> str:
    """Texto que sigue a '<b>Label:</b>' dentro de su <p>."""
    b = soup.find("b", string=re.compile(rf"^\s*{label}\s*:?\s*$"))
    return clean(b.parent.get_text(" ").replace(b.get_text(), "", 1)) if b and b.parent else ""


def parse_dates(text: str, today: date) -> tuple[list[date], list[str]]:
    """'02/10 21:00hs - 03/10 20:00hs' -> ([fechas], [horarios]). 'Indefinido' -> ([], [])."""
    days, times = [], []
    for d, m, hh, mm in DATE_RE.findall(text):
        day = _mk(_year_for(int(m), int(d), today), int(m), int(d))
        if day:
            days.append(day)
            if hh:
                times.append(f"{int(hh):02d}:{mm}")
    return sorted(set(days)), sorted(set(times))


def parse_event(html: str, url: str, today: date) -> dict | None:
    """Evento de Rosario con fecha futura, o None (otra ciudad, fecha 'Indefinido', ya pasó)."""
    soup = BeautifulSoup(html, "html.parser")
    coords = coords_from_embed(html)
    address = _field(soup, "Direcci[oó]n")
    if not ("rosario" in norm(address) or (coords and in_rosario_bbox(*coords))):
        return None
    days, times = parse_dates(_field(soup, "Fechas"), today)
    days = [d for d in days if d >= today]
    h1 = soup.find("h1")
    title = clean(h1.get_text()) if h1 else ""
    if not days or not title:
        return None
    img = soup.select_one("img.card-img-top")
    modal = soup.select_one("#modalDescripcionEvento")
    paras = [clean(p.get_text()) for p in (modal.find_all(["p", "div"]) if modal else [])]
    desc = next((p for p in paras if len(p) > 60 and not p.lower().startswith(("género", "genero"))), "")
    category = guess_category(title, default="teatro" if "Género" in (modal.get_text() if modal else "") else "eventos")
    ev = {
        "title": title,
        "url": url,
        "date_text": format_dates(days),
        "spec": DateSpec(start=days[0], end=days[-1], dates=days[:60]),
        "time": " / ".join(times),
        "venue": _field(soup, "Lugar"),
        "address": address,
        "description": desc[:400],
        "image": urljoin(BASE, img["src"]) if img and img.get("src") else "",
        "category": category,
        "all_categories": [category],
        "plan": guess_plan(title, category, desc),
        "source": SOURCE,
        "free": False,
    }
    if coords:
        ev["coords"] = [list(coords)]
    return ev


def scrape(today: date) -> list[dict]:
    events = []
    for url in list_events(fetch(BASE)):
        try:
            ev = parse_event(fetch(url), url, today)
        except Exception as exc:  # noqa: BLE001 - un evento roto no frena el resto
            print(f"  [1000tickets] {url}: {exc}")
            continue
        if ev:
            events.append(ev)
    print(f"  [1000tickets] {len(events)} eventos en Rosario")
    return events
