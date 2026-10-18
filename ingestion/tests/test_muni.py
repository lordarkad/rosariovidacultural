import unittest
from unittest import mock

from scrapers import muni


def card(**over):
    return {"title": "DÍA 3", "venue": "", "url": "https://rosario.gob.ar/inicio/e", "date_text": "18 oct",
            "description": "", **over}


class Enrich(unittest.TestCase):
    def _enrich(self, ev, detail):
        with mock.patch.object(muni, "fetch", return_value="<html/>"), \
                mock.patch.object(muni, "parse_detail", return_value=detail):
            muni.enrich(ev)
        return ev

    def test_la_sede_del_detalle_gana_al_sufijo_de_la_tarjeta(self):
        # «DÍA 3 | MOSTRA. Memoria Queer en VHS»: lo que sigue a la barra es el programa, no la sede
        ev = self._enrich(card(venue="MOSTRA. Memoria Queer en VHS"),
                          {"free": True, "venue": "Centro Cultural Cine Lumière", "address": "Vélez Sarsfield 1027"})
        self.assertEqual((ev["venue"], ev["address"]), ("Centro Cultural Cine Lumière", "Vélez Sarsfield 1027"))

    def test_sin_sede_en_el_detalle_queda_la_de_la_tarjeta(self):
        ev = self._enrich(card(venue="Teatro El Círculo"), {"free": False})
        self.assertEqual(ev["venue"], "Teatro El Círculo")

    def test_sin_sede_en_ningun_lado_queda_vacia(self):
        self.assertEqual(self._enrich(card(), {"free": False})["venue"], "")


if __name__ == "__main__":
    unittest.main()
