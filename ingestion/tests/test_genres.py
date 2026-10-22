import unittest

from scrapers import venues
from scrapers.common import guess_genres
from scrapers.venues import VenueError, validate

CASA_TANGO = {"id": "casa-del-tango", "name": "Centro Cultural La Casa del Tango", "offers": ["musica_en_vivo", "baile"],
              "genres": ["tango"]}


class Palabras(unittest.TestCase):
    def test_titulo(self):
        self.assertEqual(guess_genres("Tertulias Tangueras"), ["tango"])
        self.assertEqual(guess_genres("Noche de cumbia"), ["cumbia"])
        self.assertEqual(guess_genres("Gran chamamé del litoral"), ["chamame"])
        self.assertEqual(guess_genres("Orquesta Sinfónica Provincial"), ["clasica"])

    def test_genero_en_la_descripcion(self):
        # Mil Tickets pega «Género: Folclore» sin espacio con el campo siguiente
        desc = "VICTOR HEREDIA Descripción Género: FolcloreDestinatarios: ATPDuración: 120 min."
        self.assertEqual(guess_genres("Víctor Heredia", desc), ["folklore"])

    def test_la_descripcion_libre_no_clasifica(self):
        # El cuerpo nombra de todo: solo cuenta el campo «Género:», igual que en guess_category
        self.assertEqual(guess_genres("Cena show", "El chef prepara un tango de sabores y una cumbia de postres"), [])

    def test_puede_tener_varios(self):
        self.assertEqual(guess_genres("Tango y folklore en vivo"), ["folklore", "tango"])

    def test_palabra_completa_en_el_titulo(self):
        # Subcadenas dentro de otras palabras no clasifican
        for titulo in ("Warehouse party", "Clubhouse", "Technology expo", "Cooperadora escolar", "Operativo verano",
                       "Crock", "Rocket League", "Contango", "Tangible"):
            self.assertEqual(guess_genres(titulo), [], msg=titulo)

    def test_flexiones_de_plural(self):
        self.assertEqual(guess_genres("Noche de tangos y milongas"), ["tango"])
        self.assertEqual(guess_genres("Bandas rockeras"), ["rock"])
        self.assertEqual(guess_genres("Fiesta House"), ["electronica"])

    def test_palabras_que_faltaban(self):
        # títulos reales de la agenda que quedaban sin género
        self.assertEqual(guess_genres("Peña Folclórica día de la Independencia"), ["folklore"])
        self.assertEqual(guess_genres("Pre Cosquín 2027 Sede Rosario en el Galpón 11"), ["folklore"])
        self.assertEqual(guess_genres("Buenos Aires Nu Metal Fest en Rosario"), ["metal"])  # F-19: metal no es rock
        self.assertEqual(guess_genres("Piedra y camino. Cantata a la Luna en el CAM"), ["clasica"])
        self.assertEqual(guess_genres("Orquesta Filarmónica de Rosario"), ["clasica"])
        self.assertEqual(guess_genres("Noche punk"), ["rock"])

    def test_generos_nuevos_f19(self):
        self.assertEqual(guess_genres("Noche de heavy metal"), ["metal"])
        self.assertEqual(guess_genres("Reggae en la terraza"), ["reggae"])
        self.assertEqual(guess_genres("Cuarteto a pleno"), ["cuarteto"])
        self.assertEqual(guess_genres("Fiesta trap y reggaetón"), ["urbano"])
        self.assertEqual(guess_genres("Hip hop en vivo"), ["urbano"])
        self.assertEqual(guess_genres("Noche pop"), ["pop"])
        self.assertEqual(guess_genres("Metal y rock"), ["metal", "rock"])

    def test_pop_con_exclusiones(self):
        self.assertEqual(guess_genres("Feria pop up de diseño"), [])
        self.assertEqual(guess_genres("Muestra de pop art"), [])

    def test_genero_f19_en_el_campo_genero(self):
        self.assertEqual(guess_genres("Show", "Género: Reggaeton Destinatarios: todos"), ["urbano"])
        self.assertEqual(guess_genres("Show", "Género: Pop"), ["pop"])
        self.assertEqual(guess_genres("Show", "Género: PopDestinatarios: todos"), ["pop"])  # pegado al campo siguiente
        self.assertEqual(guess_genres("Show", "Género: Música Popular"), [])
        self.assertEqual(guess_genres("Show", "Género: Circo trapecio"), [])

    def test_sin_genero(self):
        self.assertEqual(guess_genres("Stand up"), [])

    def test_genero_forzado_por_el_espacio(self):
        self.assertEqual(guess_genres("Peña de Cantores y Cantoras", forced=["tango"]), ["tango"])
        self.assertEqual(guess_genres("Noche de cumbia", forced=["tango"]), ["cumbia", "tango"])


class EspacioConGenero(unittest.TestCase):
    def test_validate_acepta_y_normaliza_genres(self):
        self.assertEqual(validate(CASA_TANGO, set())["genres"], ["tango"])
        self.assertEqual(validate({**CASA_TANGO, "genres": []}, set())["genres"], [])

    def test_validate_rechaza_genero_desconocido(self):
        with self.assertRaises(VenueError):
            validate({**CASA_TANGO, "genres": ["vallenato"]}, set())

    def test_la_casa_del_tango_esta_cargada(self):
        casa = next(v for v in venues.load() if v["id"] == "casa-del-tango")
        self.assertEqual(casa["genres"], ["tango"])
        self.assertIn("baile", casa["offers"])
        self.assertTrue(any("casa del tango" in a for a in casa["aliases"]))


if __name__ == "__main__":
    unittest.main()
