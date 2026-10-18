import unittest
from unittest import mock

from scrapers import places_osm
from scrapers.places_osm import to_place


def el(**tags):
    return {"type": "node", "id": 1, "lat": -32.9, "lon": -60.7, "tags": {"name": "Café X", "amenity": "cafe", **tags}}


class Imagen(unittest.TestCase):
    def test_toma_el_tag_image_si_es_url(self):
        self.assertEqual(to_place(el(image="https://x.example/f.jpg"))["image"], "https://x.example/f.jpg")

    def test_ignora_lo_que_no_es_url_http(self):
        for raw in ("File:Foto.jpg", "//x.example/f.jpg", "ftp://x.example/f.jpg", "http://[::1", "http://]"):
            self.assertEqual(to_place(el(image=raw))["image"], "", msg=raw)
        self.assertEqual(to_place(el())["image"], "")


class Afuera(unittest.TestCase):
    def test_outdoor_distingue_si_no_y_sin_dato(self):
        self.assertIs(to_place(el(outdoor_seating="yes"))["outdoor"], True)
        self.assertIs(to_place(el(outdoor_seating="no"))["outdoor"], False)
        self.assertIsNone(to_place(el())["outdoor"])
        self.assertIsNone(to_place(el(outdoor_seating="maybe"))["outdoor"])


class MosaicoCaido(unittest.TestCase):
    def test_los_previos_no_arrastran_un_no_heredado(self):
        # El places.json viejo guardaba `False` tanto para «no» como para «sin dato»: no se puede confiar en él
        viejo = [{"id": "n1", "name": "A", "lat": -32.9, "lon": -60.7, "outdoor": False},
                 {"id": "n2", "name": "B", "lat": -32.9, "lon": -60.7, "outdoor": True},
                 {"id": "n3", "name": "C", "lat": -32.9, "lon": -60.7, "outdoor": None}]
        with mock.patch.object(places_osm, "_tiles", return_value=[(-33.0, -61.0, -32.0, -60.0)]), \
                mock.patch.object(places_osm, "_query", side_effect=RuntimeError("timeout")):
            places, failed = places_osm.scrape(viejo)
        self.assertEqual(failed, 1)
        self.assertEqual({p["id"]: p["outdoor"] for p in places}, {"n1": None, "n2": True, "n3": None})


if __name__ == "__main__":
    unittest.main()
