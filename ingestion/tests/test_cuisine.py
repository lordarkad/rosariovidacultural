import unittest

import cuisine
from ingest_places import curated_place, osm_place


def osm(**over):
    base = {"id": "w1", "name": "Café", "kind": "Café", "cuisine": [], "address": "Calle 1", "lat": -32.9, "lon": -60.7,
            "hours": "", "phone": "", "website": "", "instagram": "", "outdoor": None}
    return {**base, **over}


class Traduccion(unittest.TestCase):
    def test_ac10_valores_conocidos_se_traducen(self):
        """[AC-10]"""
        self.assertEqual(cuisine.translate(["coffee shop", "italian pizza"]), ["café", "pizza italiana"])
        self.assertEqual(osm_place(osm(cuisine=["coffee shop", "italian pizza"]))["cuisine"], ["café", "pizza italiana"])

    def test_ac10_los_doce_valores_vistos_en_staging(self):
        """[AC-10]"""
        esperado = {"coffee shop": "café", "pastry": "pastelería", "ice cream": "helados", "cake": "tortas",
                    "breakfast": "desayunos", "brunch": "brunch", "bakery": "panadería", "sandwich": "sándwiches",
                    "argentinian": "argentina", "italian pizza": "pizza italiana", "mediterranean": "mediterránea",
                    "italian": "italiana"}
        for crudo, traducido in esperado.items():
            self.assertEqual(cuisine.translate([crudo]), [traducido], crudo)

    def test_ac11_desconocido_se_conserva_crudo(self):
        """[AC-11]"""
        self.assertEqual(cuisine.translate(["coffee shop", "thai"]), ["café", "thai"])

    def test_ac11_un_valor_ya_en_espanol_no_cuenta_como_desconocido(self):
        """[AC-11]"""
        self.assertEqual(cuisine.translate(["café"]), ["café"])
        self.assertEqual(cuisine.unknown_summary([["café"], ["pizza italiana"]]), [])

    def test_ac11_resumen_unico_con_los_distintos_sin_traducir(self):
        """[AC-11]"""
        listas = [["coffee shop", "thai"], ["thai", "café"], ["Vegan_Food"], []]
        self.assertEqual(cuisine.unknown_summary(listas), ["thai", "vegan food"])

    def test_ac12_normaliza_mayusculas_guiones_bajos_y_espacios(self):
        """[AC-12]"""
        self.assertEqual(cuisine.translate(["Coffee_Shop"]), ["café"])
        self.assertEqual(cuisine.translate([" coffee shop "]), ["café"])
        self.assertEqual(cuisine.translate(["Coffee_Shop", " coffee shop "]), ["café"])

    def test_ac12_dos_valores_que_traducen_igual_se_reducen_a_uno_conservando_el_orden(self):
        """[AC-12]"""
        self.assertEqual(cuisine.translate(["coffee shop", "café"]), ["café"])
        self.assertEqual(cuisine.translate(["italian", "coffee shop", "italiana"]), ["italiana", "café"])

    def test_ac11_el_resumen_sale_como_un_solo_warning_de_actions(self):
        """[AC-11]"""
        self.assertEqual(cuisine.warning([["thai", "coffee shop"], ["thai", "vegan_food"]]),
                         "::warning::Cocinas de OpenStreetMap sin traducir (2): thai, vegan food")
        self.assertIsNone(cuisine.warning([["coffee shop"], ["café"], []]))

    def test_errores_de_tipeo_frecuentes_de_osm(self):
        self.assertEqual(cuisine.translate(["coffe shop", "sandiwch"]), ["café", "sándwiches"])

    def test_vacios_se_descartan(self):
        self.assertEqual(cuisine.translate(["", "  "]), [])

    def test_ac13_los_curados_no_cambian(self):
        """[AC-13]"""
        pl = curated_place({"name": "Sala X", "lat": -32.9, "lon": -60.7, "id": "x"})
        if pl is not None:
            self.assertEqual(pl["cuisine"], [])


if __name__ == "__main__":
    unittest.main()
