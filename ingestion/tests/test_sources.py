import unittest
from datetime import date

from build import merge_duplicates, to_record
from scrapers import broadway, comedia
from scrapers.common import DateSpec, extract_time, strip_time

TODAY = date(2026, 9, 29)

COMEDIA_HTML = """
<article class="mec-event-article"><div class="mec-event-month"><span class="mec-start-date-label">02 octubre</span></div>
<span class="mec-start-time">21:00</span><h4 class="mec-event-title"><a href="https://x.test/e/rio-1">Lo que el río hace</a></h4></article>
<article class="mec-event-article"><div class="mec-event-month"><span class="mec-start-date-label">03 octubre</span></div>
<span class="mec-start-time">20:00</span><h4 class="mec-event-title"><a href="https://x.test/e/rio-2">Lo que el río hace</a></h4></article>
<article class="post-68"><h4>ruido</h4></article>
"""

BROADWAY_HTML = """
<html><head><title>AXEL TOUR 2026 | Teatro Broadway Rosario</title></head><body><h1>AXEL TOUR 2026 EN VENTA!!</h1><p>Fechas y horarios</p>
<p>Viernes 6 de Noviembre a las 21:00 Hs.</p><p>Sábado 7 de Noviembre a las 18:30 Hs.</p>
<p>Más información</p><p>Promo 6 cuotas</p><p>Platea Alta — $ 60000</p><p>Palcos — $ 90.000</p></body></html>
"""


class Times(unittest.TestCase):
    def test_extract_and_strip(self):
        self.assertEqual(extract_time("Viernes 6 de Noviembre a las 21:00 Hs."), "21:00")
        self.assertEqual(strip_time("Viernes 6 de Noviembre a las 21:00 Hs."), "Viernes 6 de Noviembre")
        self.assertEqual(extract_time("sin hora"), "")


class Comedia(unittest.TestCase):
    def test_groups_showings_by_title(self):
        shows = comedia.group(comedia.parse_home(COMEDIA_HTML, TODAY))
        self.assertEqual(len(shows), 1)
        self.assertEqual([d.isoformat() for d in shows[0]["dates"]], ["2026-10-02", "2026-10-03"])
        self.assertEqual(shows[0]["times"], ["20:00", "21:00"])


class Broadway(unittest.TestCase):
    def test_parse_show(self):
        s = broadway.parse_show(BROADWAY_HTML, TODAY)
        self.assertEqual(s["title"], "AXEL TOUR 2026")
        self.assertEqual([d.isoformat() for d in s["dates"]], ["2026-11-06", "2026-11-07"])
        self.assertEqual(s["times"], ["18:30", "21:00"])
        self.assertEqual(s["price_from"], 60000)  # 6 cuotas no cuenta: < 1000

    def test_no_dates_returns_none(self):
        self.assertIsNone(broadway.parse_show("<title>X</title><p>Sin fechas</p>", TODAY))


def rec(title, dates, source, ranged=False):
    ds = sorted(date.fromisoformat(d) for d in dates)
    spec = DateSpec(start=ds[0], end=ds[-1], dates=ds, ranged=ranged)
    return to_record({"title": title, "url": f"https://{source}/{title}", "spec": spec, "category": "teatro",
                      "all_categories": ["teatro"], "plan": "cultura", "venue": "", "date_text": "",
                      "image": "", "description": "", "source": source})


class Merge(unittest.TestCase):
    def test_overlapping_dates_merge_and_union(self):
        a = rec("Agotados", ["2026-10-03"], "Cartel")
        b = rec("AGOTADOS", ["2026-10-03", "2026-10-10"], "Broadway")
        out = merge_duplicates([a, b])
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["dates"], ["2026-10-03", "2026-10-10"])
        self.assertEqual(len(out[0]["sources"]), 2)

    def test_same_title_disjoint_dates_stay_separate(self):
        a = rec("Hamlet", ["2026-10-03"], "Cartel")
        b = rec("Hamlet", ["2026-12-01"], "Broadway")
        self.assertEqual(len(merge_duplicates([a, b])), 2)


if __name__ == "__main__":
    unittest.main()
