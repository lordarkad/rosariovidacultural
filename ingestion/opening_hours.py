"""Estructura el `opening_hours` de OSM en los `OpeningPeriod` del contrato de /ingest (F-6).

Entiende el subconjunto que usa casi todo el mapa: días (`Mo-Fr`, `Sa,Su`, `Fr-Mo`), uno o varios tramos horarios,
`off`, `24/7` y reglas que se pisan entre sí (la última gana para sus días). Ignora las reglas de feriados fijos
(`Jan 1 off "…"`, `PH`). Lo que no entiende (`19:00+`, `sunrise`, semanas, `[1]`) devuelve `None`: «horario no
informado» es mejor que un horario inventado.
"""
from __future__ import annotations

import re

_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
_M = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
# Solo feriados fijos (`Jan 1 off`, `Dec 24-25 off`). Un cierre de temporada (`Jun-Aug off`, `Dec Mo-Fr off`) no se
# ignora: el parser devuelve None, porque un horario semanal completo mentiría durante esos meses.
_MONTH_RULE = re.compile(rf"^{_M}\s+\d{{1,2}}(?:\s*-\s*(?:{_M}\s+)?\d{{1,2}})?:?\s+off\b", re.I)
_DAY = r"(?:Mo|Tu|We|Th|Fr|Sa|Su)"
_SELECTOR = re.compile(rf"^{_DAY}(?:-{_DAY})?(?:\s*,\s*(?:{_DAY}(?:-{_DAY})?|PH))*$|^PH$")
_SPAN = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)-(?:([01]?\d|2[0-3]):([0-5]\d)|24:00)$")


def _days(selector: str) -> list[int] | None:
    out: list[int] = []
    for part in (p.strip() for p in selector.split(",")):
        if part == "PH":
            continue  # feriados: no hay forma de expresarlos en el contrato
        first, _, last = part.partition("-")
        start = _DAYS.index(first)
        end = _DAYS.index(last) if last else start
        out += [(start + i) % 7 for i in range(((end - start) % 7) + 1)]
    return out or None


def _spans(text: str) -> list[tuple[str, str]] | None:
    out = []
    for raw in text.split(","):
        m = _SPAN.match(raw.strip())
        if not m:
            return None
        opens = f"{int(m.group(1)):02d}:{m.group(2)}"
        closes = f"{int(m.group(3)):02d}:{m.group(4)}" if m.group(3) is not None else "00:00"  # «24:00»
        if opens == closes and not (opens == "00:00" and raw.strip().endswith("24:00")):
            return None  # 08:00-08:00 sería «abierto 24 h» en el contrato: probablemente un error del mapa
        out.append((opens, closes))
    return out


def parse(text: str) -> list[dict] | None:
    text = (text or "").strip()
    if not text:
        return None
    if text == "24/7":
        return [{"day": d, "opens": "00:00", "closes": "00:00"} for d in range(7)]
    by_day: dict[int, list[tuple[str, str]]] = {}
    for rule in (r.strip() for r in text.split(";") if r.strip()):
        if _MONTH_RULE.match(rule):
            continue
        selector, _, rest = rule.partition(" ")
        if not _SELECTOR.match(selector) and re.match(r"^\d", rule):
            selector, rest = "Mo-Su", rule  # sin días: todos los días
        elif not _SELECTOR.match(selector):
            # «We, Th, Su 19:00-22:30»: el selector lleva espacios después de las comas
            m = re.match(rf"^({_DAY}(?:-{_DAY})?(?:\s*,\s*{_DAY}(?:-{_DAY})?)*)\s+(.*)$", rule)
            if not m:
                return None
            selector, rest = m.group(1), m.group(2)
        rest = rest.strip()
        if selector == "PH":
            continue
        days = _days(selector)
        if days is None:
            continue
        if rest.lower() == "off":
            spans: list[tuple[str, str]] = []
        else:
            parsed = _spans(rest)
            if parsed is None:
                return None
            spans = parsed
        for d in days:
            by_day[d] = spans
    periods = [{"day": d, "opens": o, "closes": c} for d in sorted(by_day) for o, c in by_day[d]]
    return periods or None
