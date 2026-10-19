import re
import unittest

from ingest_places import curated_place, osm_place

HOURS = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def osm(**over):
    base = {"id": "w1225024480", "name": "1965 Café", "kind": "Café", "cuisine": [], "address": "Los Nogales 2501",
            "lat": -32.92891, "lon": -60.79804, "hours": "Mo-Sa 08:00-21:00", "phone": "", "website": "",
            "instagram": "", "outdoor": True}
    return {**base, **over}


class Osm(unittest.TestCase):
    def test_campos(self):
        pl = osm_place(osm(phone="+54 341 424-2454", website="https://x.example", cuisine=["coffee shop"]))
        self.assertEqual((pl["source_key"], pl["origin"], pl["kind"]), ("osm:w1225024480", "osm", "cafe"))
        self.assertEqual((pl["lat"], pl["lon"]), (-32.92891, -60.79804))
        self.assertEqual((pl["phone"], pl["website"], pl["cuisine"]), ("+54 341 424-2454", "https://x.example",
                                                                       ["café"]))
        self.assertEqual(pl["hours_text"], "Mo-Sa 08:00-21:00")
        self.assertEqual(len(pl["opening_hours"]), 6)
        self.assertTrue(all(HOURS.match(x["opens"]) and HOURS.match(x["closes"]) for x in pl["opening_hours"]))
        self.assertTrue(pl["outdoor"])

    def test_vacios_son_null(self):
        pl = osm_place(osm(address="", hours="", outdoor=None))
        for key in ("address", "hours_text", "opening_hours", "phone", "website", "instagram", "outdoor"):
            self.assertIsNone(pl[key], msg=key)

    def test_outdoor_no_explicito_se_publica_como_false(self):
        self.assertIs(osm_place(osm(outdoor=False))["outdoor"], False)  # OSM dice `outdoor_seating=no`
        self.assertIsNone(osm_place({k: v for k, v in osm().items() if k != "outdoor"})["outdoor"])

    def test_horario_que_no_se_entiende_conserva_el_texto(self):
        pl = osm_place(osm(hours="We-Su 19:00+"))
        self.assertIsNone(pl["opening_hours"])
        self.assertEqual(pl["hours_text"], "We-Su 19:00+")

    def test_kind_e_intents(self):
        casos = {"Restaurante": ("restaurante", ["comer"]), "Comida rápida": ("comida_rapida", ["comer"]),
                 "Bar": ("bar", ["comer", "tomar_algo"]), "Café": ("cafe", ["comer", "tomar_algo"]),
                 "Heladería": ("heladeria", ["comer", "tomar_algo"]), "Otro": ("otro", [])}
        for display, (kind, intents) in casos.items():
            pl = osm_place(osm(kind=display))
            self.assertEqual((pl["kind"], pl["intents"]), (kind, intents), msg=display)

    def test_instagram_solo_el_usuario(self):
        for raw in ("https://www.instagram.com/lacafeteria/", "@lacafeteria", "lacafeteria"):
            self.assertEqual(osm_place(osm(instagram=raw))["instagram"], "lacafeteria", msg=raw)
        for raw in ("https://www.instagram.com/p/XYZ123/", "https://facebook.com/lacafeteria", "dos palabras"):
            self.assertIsNone(osm_place(osm(instagram=raw))["instagram"], msg=raw)

    def test_image_url_solo_http(self):
        self.assertEqual(osm_place(osm(image="https://x.example/f.jpg"))["image_url"], "https://x.example/f.jpg")
        self.assertIsNone(osm_place(osm())["image_url"])
        for raw in ("", "File:Foto.jpg", "javascript:alert(1)", "//x.example/f.jpg", "http://", "http://[::1"):
            self.assertIsNone(osm_place(osm(image=raw))["image_url"], msg=raw)


CURADO = {"id": "casa-brava", "name": "Casa Brava", "kind": "bar", "address": "Pichincha 120", "lat": -32.93415,
          "lon": -60.66093, "offers": ["musica_en_vivo", "cena", "baile"], "instagram": "casabrava", "website": "",
          "note": "Bandas en vivo."}


class Curados(unittest.TestCase):
    def test_campos_e_intents_desde_offers(self):
        pl = curated_place(CURADO)
        self.assertEqual((pl["source_key"], pl["origin"], pl["kind"]), ("curated:casa-brava", "curated", "bar"))
        self.assertEqual(pl["intents"], ["comer", "tomar_algo", "musica_en_vivo", "bailar"])
        self.assertEqual(pl["offers"], ["musica_en_vivo", "cena", "baile"])
        self.assertEqual((pl["instagram"], pl["website"], pl["note"]), ("casabrava", None, "Bandas en vivo."))
        self.assertIsNone(pl["opening_hours"])

    def test_bar_curado_suma_comer_y_tomar_algo(self):
        pl = curated_place({**CURADO, "offers": ["musica_en_vivo"]})  # sin «cena»: igual es un bar
        self.assertEqual(pl["intents"], ["comer", "tomar_algo", "musica_en_vivo"])

    def test_sala_no_suma_tomar_algo(self):
        pl = curated_place({**CURADO, "kind": "sala", "offers": ["musica_en_vivo", "baile"]})
        self.assertEqual(pl["intents"], ["musica_en_vivo", "bailar"])

    def test_image_url_del_espacio_curado(self):
        self.assertEqual(curated_place({**CURADO, "image_url": "https://x.example/f.jpg"})["image_url"],
                         "https://x.example/f.jpg")
        self.assertIsNone(curated_place(CURADO)["image_url"])
        self.assertIsNone(curated_place({**CURADO, "image_url": "File:Foto.jpg"})["image_url"])

    def test_sin_coordenadas_no_se_publica(self):
        self.assertIsNone(curated_place({**CURADO, "lat": None, "lon": None}))


if __name__ == "__main__":
    unittest.main()
