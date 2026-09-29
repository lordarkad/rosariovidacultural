import unittest

from scrapers import venues
from scrapers.venues import VenueError, validate

CASA = {"id": "casa-brava", "name": "Casa Brava", "aliases": ["Casa Brava Bar"], "address": "Pichincha 120",
        "offers": ["musica_en_vivo", "cena"], "instagram": "@casabrava", "note": "x"}


def ev(eid, title, venue, start="2026-10-09", coords=None):
    return {"id": eid, "title": title, "venue": venue, "start": start, "date_text": "9 oct", "time": "20:00",
            "free": False, "price_from": None, "coords": coords or [],
            "sources": [{"name": "Passline", "url": f"https://p.test/{eid}"}, {"name": "Qué Hacemos", "url": "https://q.test"}]}


class Validacion(unittest.TestCase):
    def test_normaliza(self):
        v = validate(CASA, set())
        self.assertEqual(v["instagram"], "casabrava")  # sin @
        self.assertEqual(v["aliases"], ["casa brava", "casa brava bar"])

    def test_rechaza_datos_invalidos(self):
        for bad in ({"id": "Casa Brava"}, {"offers": []}, {"offers": ["karaoke"]}, {"name": " "},
                    {"instagram": "https://instagram.com/x"}, {"website": "javascript:alert(1)"},
                    {"info_sources": [{"name": "x", "url": "ftp://x"}]}):
            with self.assertRaises(VenueError, msg=bad):
                validate({**CASA, **bad}, set())
        with self.assertRaises(VenueError):
            validate(CASA, {"casa-brava"})  # id repetido

    def test_archivo_curado_es_valido(self):
        loaded = venues.load()
        self.assertTrue({"casa-brava", "bon-scott"} <= {v["id"] for v in loaded})


class Vinculo(unittest.TestCase):
    def setUp(self):
        self.vs = [validate(CASA, set())]

    def test_alias_por_palabras_completas(self):
        self.assertIsNotNone(venues.venue_of(ev(1, "x", "CASA BRAVA"), self.vs))
        self.assertIsNotNone(venues.venue_of(ev(1, "x", "Casa Brava Bar · Pichincha"), self.vs))
        self.assertIsNone(venues.venue_of(ev(1, "x", "Casa Bravazo"), self.vs))  # no es "casa brava" completo
        self.assertIsNone(venues.venue_of(ev(1, "x", ""), self.vs))

    def test_build_vincula_ordena_y_toma_coords_de_los_eventos(self):
        events = [ev(2, "B", "Casa Brava", "2026-10-22", [[-32.93415, -60.66093]]),
                  ev(1, "A", "Casa Brava", "2026-10-09", [[-32.93417, -60.66095]]),
                  ev(3, "Otro", "Teatro El Círculo")]
        events[2]["venue_id"] = "viejo"  # residuo de una corrida anterior
        (out,) = venues.build(events, self.vs, cache={})
        self.assertEqual([u["id"] for u in out["upcoming"]], [1, 2])
        self.assertEqual(out["upcoming_count"], 2)
        self.assertEqual((out["lat"], out["lon"]), (-32.93416, -60.66094))  # mediana
        self.assertEqual(out["upcoming"][0]["url"], "https://p.test/1")  # fuente primaria (la primera)
        self.assertEqual([e.get("venue_id") for e in events], ["casa-brava", "casa-brava", None])

    def test_coords_cargadas_a_mano_ganan_y_sin_eventos_igual_aparece(self):
        v = validate({**CASA, "lat": -32.9, "lon": -60.6}, set())
        (out,) = venues.build([ev(1, "A", "Casa Brava", coords=[[-1, -1]])], [v], cache={})
        self.assertEqual((out["lat"], out["lon"]), (-32.9, -60.6))
        (vacio,) = venues.build([], [v], cache={})
        self.assertEqual((vacio["upcoming_count"], vacio["upcoming"]), (0, []))

    def test_limita_los_proximos(self):
        events = [ev(i, f"E{i}", "Casa Brava", f"2026-10-{i:02d}", [[-32.9, -60.6]]) for i in range(1, 9)]
        (out,) = venues.build(events, self.vs, cache={})
        self.assertEqual((len(out["upcoming"]), out["upcoming_count"]), (venues.UPCOMING, 8))


if __name__ == "__main__":
    unittest.main()
