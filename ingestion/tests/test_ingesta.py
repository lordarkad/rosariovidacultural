import json
import unittest
from datetime import date

from build import feed_of, merge_duplicates, to_record
from scrapers import disfrutarosario, noticias, quehacemos
from scrapers.common import DateSpec

TODAY = date(2026, 9, 29)


def api_event(**over):
    base = {
        "id": 52919, "title": "ATTACK ON TITAN: The Last Concert | 22 De Noviembre", "description": "Una noche épica",
        "event_type": "recital", "city": "Rosario", "province": "Santa Fe", "venue": "Jaguar Haüs",
        "address": "Martín Rodríguez & Av. Rivadavia", "date": "2026-11-22T20:00:00", "price": None,
        "min_price": 45000.0, "price_type": "pago", "image_url": "https://img.test/a.webp",
        "link": "https://www.passline.com/eventos/aot", "source": "passline.com", "status": "scheduled",
        "latitude": -32.96392, "longitude": -60.66403, "is_past": False,
    }
    return {**base, **over}


class QueHacemos(unittest.TestCase):
    def test_atribuye_a_la_fuente_primaria_y_cita_al_agregador(self):
        ev = quehacemos.to_event(api_event(), TODAY)
        self.assertEqual(ev["source"], "Passline")
        self.assertEqual(ev["url"], "https://www.passline.com/eventos/aot")
        self.assertEqual(ev["also"][0]["name"], "Qué Hacemos")
        self.assertTrue(ev["also"][0]["url"].endswith("-52919"))
        self.assertEqual(ev["title"], "ATTACK ON TITAN: The Last Concert")  # sin la fecha pegada al título
        self.assertEqual((ev["time"], ev["price_from"], ev["category"]), ("20:00", 45000, "musica"))
        self.assertEqual(ev["coords"], [[-32.96392, -60.66403]])

    def test_descarta_pasados_otras_ciudades_y_sin_link(self):
        self.assertIsNone(quehacemos.to_event(api_event(date="2026-09-01T20:00:00"), TODAY))
        self.assertIsNone(quehacemos.to_event(api_event(city="Córdoba", latitude=-31.4, longitude=-64.2), TODAY))
        self.assertIsNone(quehacemos.to_event(api_event(link="", source_url=""), TODAY))
        self.assertIsNone(quehacemos.to_event(api_event(link="javascript:alert(1)", source_url=""), TODAY))

    def test_ciudad_mal_cargada_se_rescata_por_coordenadas(self):
        self.assertIsNotNone(quehacemos.to_event(api_event(city="Santa Fe"), TODAY))

    def test_funciones_del_mismo_show_se_unifican(self):
        seen: dict = {}
        for d in ("2026-11-22T20:00:00", "2026-11-23T21:00:00"):
            quehacemos.merge_showing(seen, quehacemos.to_event(api_event(date=d), TODAY))
        (ev,) = seen.values()
        self.assertEqual([x.isoformat() for x in ev["spec"].dates], ["2026-11-22", "2026-11-23"])
        self.assertEqual(ev["time"], "")

    def test_parse_y_record(self):
        (ev,) = quehacemos.parse(json.dumps([api_event()]), TODAY)
        rec = to_record(ev)
        self.assertEqual([s["name"] for s in rec["sources"]], ["Passline", "Qué Hacemos"])
        self.assertEqual(rec["coords"], [[-32.96392, -60.66403]])
        self.assertEqual(feed_of({**rec, "feed": "Qué Hacemos"}), "Qué Hacemos")

    def test_se_fusiona_con_otra_fuente_y_conserva_coords(self):
        a = to_record(quehacemos.to_event(api_event(title="Hamlet", date="2026-10-03T21:00:00"), TODAY))
        b = to_record({**quehacemos.to_event(api_event(title="Hamlet", date="2026-10-03T21:00:00"), TODAY),
                       "coords": [], "url": "https://muni.test/hamlet", "source": "Agenda municipal", "also": []})
        (m,) = merge_duplicates([b, a])
        self.assertEqual(m["coords"], [[-32.96392, -60.66403]])
        self.assertEqual(len(m["sources"]), 3)


POST = {
    "date": "2026-09-20T10:00:00",
    "link": "https://disfrutarosario.com/fieston/",
    "title": {"rendered": "Fiest&oacute;n"},
    "excerpt": {"rendered": "<p>Fiesta japonesa &hellip;</p>"},
    "categories": [7, 999],
    "content": {"rendered": (
        "<p>El s&aacute;bado 3 de octubre desde las 20:30 en la Asociaci&oacute;n Japonesa. "
        "Entradas desde $15.000 en <a href='https://www.ticketsforlovers.com/eventos/fieston-e1385'>Tickets</a>. "
        "Fundada el 5 de mayo de 1900.</p><img src='https://disfrutarosario.com/wp-content/x.jpg'>")},
}


class DisfrutaRosario(unittest.TestCase):
    def test_fecha_hora_precio_y_ticketera_primaria(self):
        ev = disfrutarosario.parse_post(POST, {7: "Asociación Japonesa"}, TODAY)
        self.assertEqual([d.isoformat() for d in ev["spec"].dates], ["2026-10-03"])
        self.assertEqual((ev["time"], ev["price_from"], ev["free"]), ("20:30", 15000, False))
        self.assertEqual(ev["venue"], "Asociación Japonesa")
        self.assertEqual((ev["source"], ev["url"]), ("Tickets for Lovers", "https://www.ticketsforlovers.com/eventos/fieston-e1385"))
        self.assertEqual(ev["also"], [{"name": "Disfruta Rosario", "url": POST["link"]}])

    def test_sin_ticketera_la_fuente_es_la_nota(self):
        post = {**POST, "content": {"rendered": "<p>Domingo 4 de octubre de 14 a 20. Entrada libre y gratuita.</p>"}}
        ev = disfrutarosario.parse_post(post, {}, TODAY)
        self.assertEqual((ev["source"], ev["url"], ev["time"], ev["free"]),
                         ("Disfruta Rosario", POST["link"], "14:00", True))
        self.assertNotIn("also", ev)

    def test_descarta_pasadas_historicas_y_guias(self):
        past = {**POST, "content": {"rendered": "<p>Fue el domingo 27 de septiembre de 10 a 17.</p>"}}
        self.assertIsNone(disfrutarosario.parse_post(past, {}, TODAY))
        history = {**POST, "content": {"rendered": "<p>El club se fundó el 5 de mayo de 1900.</p>"}}
        self.assertIsNone(disfrutarosario.parse_post(history, {}, TODAY))
        guide = {**POST, "title": {"rendered": "Cartelera de teatro en Rosario 2026"}}
        self.assertIsNone(disfrutarosario.parse_post(guide, {}, TODAY))

    def test_el_anio_se_ancla_a_la_fecha_de_publicacion(self):
        # nota de 2015 que dice '14 de octubre': no debe leerse como octubre de 2027
        old = {**POST, "date": "2015-09-30T10:00:00",
               "content": {"rendered": "<p>El 14 de octubre de 14 a 20 en Warnes 1917.</p>"}}
        self.assertIsNone(disfrutarosario.parse_post(old, {}, TODAY))
        # nota de noviembre que anuncia enero: cae en el año siguiente a la publicación
        ahead = {**POST, "date": "2026-11-20T10:00:00",
                 "content": {"rendered": "<p>El sábado 9 de enero a las 21.</p>"}}
        ev = disfrutarosario.parse_post(ahead, {}, date(2026, 11, 21))
        self.assertEqual(ev["spec"].start.isoformat(), "2027-01-09")

    def test_fecha_lejana_solo_con_cue_de_evento(self):
        relleno = "<p>" + "Texto de contexto general. " * 70 + "</p>"  # > HEAD_CHARS
        with_cue = {**POST, "content": {"rendered": relleno + "<p>El evento se realizará el domingo 4 de octubre de 14 a 20.</p>"}}
        ev = disfrutarosario.parse_post(with_cue, {}, TODAY)
        self.assertEqual((ev["spec"].start.isoformat(), ev["time"]), ("2026-10-04", "14:00"))
        history = {**POST, "content": {"rendered": relleno + "<p>La casona fue donada el 5 de mayo.</p>"}}
        self.assertIsNone(disfrutarosario.parse_post(history, {}, TODAY))

    def test_titulo_con_edicion_pasada_se_descarta(self):
        post = {**POST, "title": {"rendered": "Terror Aventura en Rosario 2025"}}
        self.assertIsNone(disfrutarosario.parse_post(post, {}, TODAY))

    def test_direccion_solo_con_cue_y_sin_confundir_anios(self):
        self.assertEqual(disfrutarosario.find_address("Será en Warnes 1917 desde las 14."), "Warnes 1917")
        self.assertEqual(disfrutarosario.find_address("en Av. Diario La Capital 1602"), "Diario La Capital 1602")
        self.assertEqual(disfrutarosario.find_address("Rosario en Octubre 2026 y en Rosario 2026"), "")
        self.assertEqual(disfrutarosario.find_address("Sin dirección"), "")


RSS = """<?xml version="1.0"?><rss><channel>
<item><title>Noche de Museos Abiertos</title><link>https://rn.test/1</link><category>Cultura,</category>
<description>Convocan a espacios &amp; museos.</description><pubDate>Tue, 29 Sep 2026 11:48:00 -0300</pubDate>
<media:content url="https://rn.test/f.jpg" medium="image"/></item>
<item><title>Cortes de calle</title><link>https://rn.test/2</link><category>Obras,Tránsito</category>
<description>x</description><pubDate>Tue, 29 Sep 2026 02:00:00 -0300</pubDate></item>
<item><title>Sin link</title><link>ftp://rn.test/3</link><category>Cultura</category><description>x</description></item>
</channel></rss>"""


class Noticias(unittest.TestCase):
    def test_filtra_categorias_y_exige_link_http(self):
        items = noticias.parse_feed(RSS)
        self.assertEqual([i["title"] for i in items], ["Noche de Museos Abiertos"])
        self.assertEqual(items[0]["summary"], "Convocan a espacios & museos.")
        self.assertEqual(items[0]["image"], "https://rn.test/f.jpg")
        self.assertTrue(items[0]["published"].startswith("2026-09-29T11:48"))


class OrdenDeFuentes(unittest.TestCase):
    def _rec(self, title, source, also=()):
        ds = [date(2026, 10, 3)]
        return to_record({"title": title, "url": f"https://{source}.test/{title}", "spec": DateSpec(ds[0], ds[0], ds),
                          "category": "musica", "all_categories": ["musica"], "plan": "cultura", "venue": "",
                          "date_text": "", "image": "", "description": "", "source": source,
                          "also": [{"name": n, "url": f"https://{n}.test/x"} for n in also]})

    def test_ticketera_va_primero_aunque_llegue_ultima(self):
        cartel = self._rec("Diego Torres", "Rosario en Cartel")
        sala = self._rec("Diego Torres", "Teatro La Comedia")
        turbo = self._rec("Diego Torres", "TurboEntrada")
        (m,) = merge_duplicates([cartel, sala, turbo])
        self.assertEqual([s["name"] for s in m["sources"]], ["TurboEntrada", "Teatro La Comedia", "Rosario en Cartel"])

    def test_agregadores_al_final_y_orden_estable(self):
        qh = self._rec("Coti", "Passline", also=["Qué Hacemos"])
        band = self._rec("Coti", "Bandsintown")
        tick = self._rec("Coti", "Ticketek")
        (m,) = merge_duplicates([qh, band, tick])
        # Passline y Ticketek (nivel 0) en orden de llegada; Bandsintown y Qué Hacemos (nivel 2) después
        self.assertEqual([s["name"] for s in m["sources"]], ["Passline", "Ticketek", "Qué Hacemos", "Bandsintown"])

    def test_evento_de_una_sola_fuente_no_cambia(self):
        (m,) = merge_duplicates([self._rec("Solo", "Rosario en Cartel")])
        self.assertEqual([s["name"] for s in m["sources"]], ["Rosario en Cartel"])


if __name__ == "__main__":
    unittest.main()
