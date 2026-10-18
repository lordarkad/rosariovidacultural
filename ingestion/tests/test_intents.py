import unittest

from scrapers.common import guess_intents


def intents(title, categories, plan="cultura", description=""):
    return guess_intents(title, description, categories, plan)


class Musica(unittest.TestCase):
    def test_musica_es_musica_en_vivo(self):
        self.assertEqual(intents("Orquesta Sinfónica Provincial", ["musica"]), ["musica_en_vivo"])

    def test_el_genero_no_cambia_el_intent(self):
        self.assertEqual(intents("Noche de tango", ["musica"]), ["musica_en_vivo"])


class Danza(unittest.TestCase):
    def test_milonga_y_tertulia_son_bailar(self):
        self.assertEqual(intents("Tertulia de tango", ["danza"]), ["bailar"])
        self.assertEqual(intents("Milonga del viernes", ["danza"]), ["bailar"])
        self.assertEqual(intents("Gran baile popular", ["danza"]), ["bailar"])

    def test_estilos_de_baile_sin_ambiguedad(self):
        self.assertEqual(intents("Noche de bachata", ["danza"]), ["bailar"])
        self.assertEqual(intents("Kizomba social", ["danza"]), ["bailar"])
        self.assertEqual(intents("Fiesta bailable", ["musica"]), ["musica_en_vivo", "bailar"])

    def test_tango_solo_es_espectaculo(self):
        # «tango» a secas es ambiguo: puede ser un espectáculo para mirar
        self.assertEqual(intents("Tango para ver", ["danza"]), ["espectaculo"])

    def test_ballet_es_espectaculo(self):
        self.assertEqual(intents("El lago de los cisnes", ["danza"]), ["espectaculo"])

    def test_milonga_con_musica_en_vivo_tiene_ambos(self):
        self.assertEqual(intents("Milonga con orquesta en vivo", ["musica"]), ["musica_en_vivo", "bailar"])

    def test_la_descripcion_libre_no_cuenta(self):
        self.assertEqual(intents("Ballet", ["danza"], description="Después hay baile y tertulia para todos"),
                         ["espectaculo"])

    def test_la_tertulia_como_nombre_de_sede_no_es_bailar(self):
        self.assertEqual(intents("Muestras en La Tertulia", ["muestras"]), [])
        self.assertEqual(intents("Tertulias Tangueras", ["danza"]), ["bailar"])


class Espectaculo(unittest.TestCase):
    def test_teatro_y_cine(self):
        self.assertEqual(intents("Hamlet", ["teatro"]), ["espectaculo"])
        self.assertEqual(intents("Una película", ["cine"]), ["espectaculo"])


class Chicos(unittest.TestCase):
    def test_chicos(self):
        self.assertEqual(intents("Show infantil", ["chicos"]), ["con_chicos"])

    def test_se_suma_a_otro_intent(self):
        self.assertEqual(intents("Obra infantil", ["teatro", "chicos"]), ["espectaculo", "con_chicos"])


class Gastronomia(unittest.TestCase):
    def test_tomar_algo(self):
        self.assertEqual(intents("Cata de vinos", ["eventos"], plan="gastronomia"), ["tomar_algo"])
        self.assertEqual(intents("Fiesta de la cerveza", ["eventos"], plan="gastronomia"), ["tomar_algo"])

    def test_comer(self):
        self.assertEqual(intents("Brunch del domingo", ["eventos"], plan="gastronomia"), ["comer"])

    def test_sin_palabra_clara_no_hay_intent(self):
        # guess_plan es ruidoso: «feria de» y «mercado» también marcan ferias de libros y de artesanías
        for titulo in ("Feria de productores", "Feria del libro en Rosario", "Mercado de las Artes"):
            self.assertEqual(intents(titulo, ["eventos"], plan="gastronomia"), [], msg=titulo)

    def test_cena_es_palabra_completa(self):
        self.assertEqual(intents("Feria de la escena local", ["eventos"], plan="gastronomia"), [])
        self.assertEqual(intents("Cena de gala", ["eventos"], plan="gastronomia"), ["comer"])
        for titulo in ("Cenas de gala", "Cocinas del mundo", "Almuerzos solidarios", "Chefs invitados", "Brunchs"):
            self.assertEqual(intents(titulo, ["eventos"], plan="gastronomia"), ["comer"], msg=titulo)

    def test_ambos(self):
        self.assertEqual(intents("Brunch con café de especialidad", ["eventos"], plan="gastronomia"),
                         ["comer", "tomar_algo"])

    def test_sin_plan_gastronomico_no_hay_comer(self):
        self.assertEqual(intents("Cata de vinos", ["eventos"], plan="cultura"), [])


class SinIntent(unittest.TestCase):
    def test_muestras_deporte_y_otros(self):
        for cat in ("muestras", "arte", "deporte", "otros", "eventos"):
            self.assertEqual(intents("Algo", [cat]), [], msg=cat)

    def test_sin_duplicados_y_en_orden_estable(self):
        self.assertEqual(intents("Concierto", ["musica", "musica"]), ["musica_en_vivo"])


if __name__ == "__main__":
    unittest.main()
