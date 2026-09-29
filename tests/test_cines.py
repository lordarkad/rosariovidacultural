import json
import unittest
from datetime import date

from build import merge_duplicates, to_record
from scrapers import cine_common, cinemark, showcase
from scrapers.cine_common import smart_title

LD = json.dumps({"@type": "MovieTheater", "event": [
    {"@type": "ScreeningEvent", "startDate": "2026-09-29T15:40:00.000Z-03:00",
     "workPresented": {"name": "RESIDENT EVIL: NOCHE CERO", "image": "https://x/p.jpg"},
     "offers": {"url": "https://www.cinemark.com.ar/pelicula/re/compra-entradas/entradas"}},
    {"@type": "ScreeningEvent", "startDate": "2026-09-30T18:45:00.000Z-03:00",
     "workPresented": {"name": "RESIDENT EVIL: NOCHE CERO"}, "offers": {}},
    {"@type": "ScreeningEvent", "startDate": "2026-09-28T10:00:00.000Z-03:00",
     "workPresented": {"name": "Vieja"}, "offers": {}},
]})
HTML = f'<html><script type="application/ld+json">{LD}</script><script type="application/ld+json">{{roto</script></html>'
TODAY = date(2026, 9, 29)


class Cinemark(unittest.TestCase):
    def test_groups_by_film_and_skips_past(self):
        evs = cinemark.scrape(TODAY, fetch=lambda url: HTML)
        self.assertEqual([e["title"] for e in evs], ["Resident Evil: Noche Cero"])
        ev = evs[0]
        self.assertEqual(ev["spec"].dates, [date(2026, 9, 29), date(2026, 9, 30)])
        self.assertEqual(ev["time"], "15:40 / 18:45")
        self.assertEqual(ev["category"], "cine")


class Showcase(unittest.TestCase):
    TREE = {"days": {
        "2026-09-29": [{"id": 16, "formats": [{"performances": [{"showTime": "19:00"}, {"showTime": "N 00:15"}]}]},
                       {"id": 13, "formats": [{"performances": [{"showTime": "10:00"}]}]}],
        "2026-09-30": [{"id": 13, "formats": [{"performances": [{"showTime": "11:00"}]}]}],
    }}

    def test_only_selected_cinema(self):
        out = showcase.parse_tree(self.TREE)
        self.assertEqual(out, {date(2026, 9, 29): {"19:00", "00:15"}})

    def test_smart_title(self):
        self.assertEqual(smart_title("LA ODISEA DE LA VIDA"), "La Odisea de la Vida")
        self.assertEqual(smart_title("Toy Story 5"), "Toy Story 5")


class CineMerge(unittest.TestCase):
    def test_same_film_two_cinemas(self):
        recs = []
        for src, venue in (("Showcase Rosario", "Showcase Rosario"), ("Cinemark Rosario", "Cinemark Rosario")):
            ev = cine_common.cine_event(title="Toy Story 5", url=f"https://{venue}", source=src, venue=venue,
                                     address="calle 1", image="", showings={date(2026, 9, 29): {"20:00"}})
            recs.append(to_record(ev))
        merged = merge_duplicates(recs)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["venue"], "Showcase Rosario · Cinemark Rosario")
        self.assertEqual(merged[0]["time"], "")
        self.assertEqual(len(merged[0]["sources"]), 2)


if __name__ == "__main__":
    unittest.main()
