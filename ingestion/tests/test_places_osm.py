import unittest

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


if __name__ == "__main__":
    unittest.main()
