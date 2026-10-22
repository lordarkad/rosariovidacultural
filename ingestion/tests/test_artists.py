import unittest

from ingest_payload import to_ingest_events
from scrapers import artists
from scrapers.artists import ArtistError, genres_of, validate
from tests.test_ingest_payload import record

LISTA = [
    validate({"name": "Ciro y Los Persas", "genres": ["rock"], "source": "wikidata"}, set()),
    validate({"name": "Serú Girán", "aliases": ["Seru Giran"], "genres": ["rock"]}, set()),
    validate({"name": "Tarja Turunen", "aliases": ["Tarja"], "genres": ["clasica", "rock"], "source": "wikidata"}, set()),
    validate({"name": "Pez", "genres": ["rock"], "exact": True}, set()),
    validate({"name": "Paralamas", "genres": ["rock"]}, set()),
]


class GenerosDeArtistas(unittest.TestCase):
    def test_nombre_en_el_titulo(self):
        self.assertEqual(genres_of("CIRO Y LOS PERSAS en Rosario", LISTA), ["rock"])
        self.assertEqual(genres_of("Paralamas + Nonpalidece", LISTA), ["rock"])  # norm borra el «+»

    def test_alias_y_varios_generos(self):
        self.assertEqual(genres_of("Tarja en el Teatro Broadway", LISTA), ["clasica", "rock"])
        self.assertEqual(genres_of("40 años de Seru Giran", LISTA), ["rock"])

    def test_nombre_ambiguo_solo_si_el_titulo_es_ese_nombre(self):
        self.assertEqual(genres_of("Pez", LISTA), ["rock"])
        self.assertEqual(genres_of("PEZ", LISTA), ["rock"])
        self.assertEqual(genres_of("El pez dorado, teatro para chicos", LISTA), [])
        self.assertEqual(genres_of("Pez en vivo", LISTA), [])

    def test_palabra_completa(self):
        self.assertEqual(genres_of("Tarjanos", LISTA), [])

    def test_sin_artista(self):
        self.assertEqual(genres_of("Stand up", LISTA), [])
        self.assertEqual(genres_of("Stand up", []), [])


class Validacion(unittest.TestCase):
    def test_genero_fuera_del_enum(self):
        with self.assertRaises(ArtistError):
            validate({"name": "X", "genres": ["vallenato"]}, set())

    def test_sin_generos_o_sin_nombre(self):
        with self.assertRaises(ArtistError):
            validate({"name": "X", "genres": []}, set())
        with self.assertRaises(ArtistError):
            validate({"genres": ["rock"]}, set())

    def test_nombre_o_alias_repetido(self):
        seen: set[str] = set()
        validate({"name": "Tarja", "genres": ["rock"]}, seen)
        with self.assertRaises(ArtistError):
            validate({"name": "Otro", "aliases": ["TARJA"], "genres": ["rock"]}, seen)

    def test_fuente_desconocida(self):
        with self.assertRaises(ArtistError):
            validate({"name": "X", "genres": ["rock"], "source": "un blog"}, set())

    def test_el_archivo_real_es_valido(self):
        lista = artists.load()
        self.assertGreater(len(lista), 20)
        self.assertEqual(genres_of("Los Nocheros - Oficial", lista), ["folklore"])
        self.assertEqual(genres_of("MARIA BECERRA", lista), ["pop", "urbano"])


class EnElPayload(unittest.TestCase):
    def test_el_artista_aporta_el_genero(self):
        [ev] = to_ingest_events(record(title="Ciro y Los Persas", categories=["musica"]), [], LISTA)
        self.assertEqual(ev["music_genres"], ["rock"])

    def test_se_une_a_lo_que_dice_el_titulo(self):
        [ev] = to_ingest_events(record(title="Ciro y Los Persas - noche de reggae", categories=["musica"]), [], LISTA)
        self.assertEqual(ev["music_genres"], ["reggae", "rock"])

    def test_sin_lista_no_cambia_nada(self):
        [ev] = to_ingest_events(record(title="Ciro y Los Persas", categories=["musica"]), [])
        self.assertEqual(ev["music_genres"], [])

    def test_un_artista_en_un_evento_no_musical_tambien_cuenta(self):
        # la fuente lo puede haber categorizado como «eventos»; nombrar al artista es señal de música
        [ev] = to_ingest_events(record(title="Ciro y Los Persas", categories=["eventos"], category="eventos"), [], LISTA)
        self.assertEqual(ev["music_genres"], ["rock"])


if __name__ == "__main__":
    unittest.main()
