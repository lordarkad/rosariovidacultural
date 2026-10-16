import re
import unittest

from ingest_payload import to_ingest_events

CASA_TANGO = {"id": "casa-del-tango", "name": "Centro Cultural La Casa del Tango", "aliases": ["casa del tango"],
              "genres": ["tango"]}


def record(**over):
    base = {
        "id": "abc123", "title": "Orquesta Sinfónica", "category": "musica", "categories": ["musica"],
        "plan": "cultura", "venue": "Teatro El Círculo", "date_text": "3 oct", "start": "2026-10-03",
        "end": "2026-10-03", "ranged": False, "dates": ["2026-10-03"], "address": "Laprida 1223", "time": "21:00",
        "price_from": 15000, "free": False, "image": "https://img.example/x.jpg", "description": "Una noche.",
        "sources": [{"name": "Agenda municipal", "url": "https://rosario.gob.ar/e/1"},
                    {"name": "Qué Hacemos", "url": "https://quehacemos.example/1"}],
        "coords": [[-32.94, -60.64]], "feed": "Agenda municipal",
    }
    return {**base, **over}


class Campos(unittest.TestCase):
    def test_evento_completo(self):
        [ev] = to_ingest_events(record(), [])
        self.assertEqual(ev["title"], "Orquesta Sinfónica")
        self.assertEqual(ev["intents"], ["musica_en_vivo"])
        self.assertEqual(ev["music_genres"], ["clasica"])
        self.assertEqual((ev["start_date"], ev["end_date"], ev["start_time"]), ("2026-10-03", "2026-10-03", "21:00"))
        self.assertEqual((ev["venue_name"], ev["address"]), ("Teatro El Círculo", "Laprida 1223"))
        self.assertEqual((ev["lat"], ev["lon"]), (-32.94, -60.64))
        self.assertEqual(ev["source_url"], "https://rosario.gob.ar/e/1")
        self.assertEqual(ev["via"], [{"name": "Qué Hacemos", "url": "https://quehacemos.example/1"}])
        self.assertEqual(ev["image_url"], "https://img.example/x.jpg")
        self.assertEqual(ev["date_text"], "3 oct")

    def test_sin_hora_ni_coords_ni_imagen(self):
        [ev] = to_ingest_events(record(time="", coords=[], image="", description=""), [])
        self.assertIsNone(ev["start_time"])
        self.assertEqual((ev["lat"], ev["lon"]), (None, None))
        self.assertIsNone(ev["image_url"])
        self.assertIsNone(ev["description"])

    def test_hora_invalida_es_null(self):
        [ev] = to_ingest_events(record(time="25:99"), [])
        self.assertIsNone(ev["start_time"])

    def test_place_source_key_queda_vacio(self):
        # El vínculo con lugares llega con B-3c
        [ev] = to_ingest_events(record(), [])
        self.assertIsNone(ev["place_source_key"])


class Precio(unittest.TestCase):
    def test_estados(self):
        [free] = to_ingest_events(record(free=True, price_from=None), [])
        self.assertEqual((free["price_status"], free["price_from_ars"]), ("free", None))
        [paid] = to_ingest_events(record(price_from=15000.0), [])
        self.assertEqual((paid["price_status"], paid["price_from_ars"]), ("paid", 15000))
        [unk] = to_ingest_events(record(price_from=None), [])
        self.assertEqual((unk["price_status"], unk["price_from_ars"]), ("unknown", None))

    def test_precio_cero_no_es_pago(self):
        [ev] = to_ingest_events(record(price_from=0), [])
        self.assertEqual((ev["price_status"], ev["price_from_ars"]), ("unknown", None))


class SourceKey(unittest.TestCase):
    def test_prefijo_de_la_fuente_y_estable(self):
        [a] = to_ingest_events(record(), [])
        [b] = to_ingest_events(record(title="Otro título"), [])
        self.assertTrue(re.fullmatch(r"agenda-municipal:[0-9a-f]{12}", a["source_key"]), a["source_key"])
        self.assertEqual(a["source_key"], b["source_key"])  # depende de URL + sede, no del título

    def test_sin_feed_usa_la_primera_fuente(self):
        r = record()
        del r["feed"]
        [ev] = to_ingest_events(r, [])
        self.assertTrue(ev["source_key"].startswith("agenda-municipal:"))

    def test_sedes_distintas_dan_claves_distintas(self):
        r = record(categories=["cine"], category="cine", venue="Cinemark Rosario · Showcase Rosario",
                   address="", coords=[[-32.95, -60.66], [-32.93, -60.63]])
        evs = to_ingest_events(r, [])
        self.assertEqual([e["venue_name"] for e in evs], ["Cinemark Rosario", "Showcase Rosario"])
        self.assertEqual(len({e["source_key"] for e in evs}), 2)
        self.assertEqual([(e["lat"], e["lon"]) for e in evs], [(-32.95, -60.66), (-32.93, -60.63)])
        self.assertEqual({e["source_url"] for e in evs}, {"https://rosario.gob.ar/e/1"})  # clave de agrupado (E-2)

    def test_coords_que_no_calzan_con_las_sedes_se_omiten(self):
        r = record(venue="A · B", coords=[[-32.95, -60.66]])
        self.assertEqual([(e["lat"], e["lon"]) for e in to_ingest_events(r, [])], [(None, None)] * 2)


class Generos(unittest.TestCase):
    def test_la_sede_fuerza_el_genero(self):
        r = record(title="Noche de gala", venue="Centro Cultural La Casa del Tango", categories=["danza"],
                   category="danza")
        [ev] = to_ingest_events(r, [CASA_TANGO])
        self.assertEqual(ev["music_genres"], ["tango"])

    def test_solo_en_musica_o_baile(self):
        # «House» en el título de una película no es electrónica
        r = record(title="House of Gucci", categories=["cine"], category="cine")
        [ev] = to_ingest_events(r, [])
        self.assertEqual((ev["intents"], ev["music_genres"]), (["espectaculo"], []))


if __name__ == "__main__":
    unittest.main()
