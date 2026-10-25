import json
import unittest
from datetime import date
from unittest import mock

import build
from build import to_record
from scrapers import allaccess, alpogo

TODAY = date(2026, 10, 25)


def row(**over):
    base = {
        "id_evento": "29585", "nombre": "LOLA SANCHEZ", "lugar": "Casona, Rosario",
        "descripcion_corta": "", "descripcion": "<p>Show en <b>vivo</b></p>&nbsp;", "actividad": "Recital",
        "gratuito": "0", "visible": "1", "fecha_funcion": "2026-11-07 20:30:00",
        "fecha_fin_funcion": "2026-11-07 23:30:00", "menor_precio": "12000.00",
        "url": "https://alpogo.com/evento/lola-sanchez-29585",
        "imagen_grilla": "https://imagenes.alpogo.com/eventos/lola.webp", "imagen_logo": "",
    }
    return {**base, **over}


class Alpogo(unittest.TestCase):
    def ev(self, cache=None, **over):
        return alpogo.to_event(row(**over), TODAY, cache if cache is not None else {})

    def test_evento_de_rosario(self):
        ev = self.ev()
        self.assertEqual((ev["title"], ev["venue"], ev["time"]), ("LOLA SANCHEZ", "Casona", "20:30"))
        self.assertEqual(ev["spec"].start, date(2026, 11, 7))
        self.assertEqual((ev["category"], ev["price_from"], ev["source"]), ("musica", 12000, "Alpogo"))
        self.assertEqual(ev["description"], "Show en vivo")
        rec = to_record(ev)
        self.assertEqual(rec["sources"][0], {"name": "Alpogo", "url": "https://alpogo.com/evento/lola-sanchez-29585"})

    def test_split_lugar(self):
        self.assertEqual(alpogo.split_lugar("TEATRO DE LA MANZANA, Rosario."), ("TEATRO DE LA MANZANA", "Rosario"))
        self.assertEqual(alpogo.split_lugar("Jaguar Haüs"), ("Jaguar Haüs", ""))
        self.assertEqual(alpogo.split_lugar("Sala A, Av. Pellegrini, Rosario"), ("Sala A, Av. Pellegrini", "Rosario"))

    def test_otra_ciudad_se_descarta_sin_geocodificar(self):
        with mock.patch.object(alpogo.geocode, "locate") as locate:
            self.assertIsNone(self.ev(lugar="Teatro Ideal, Venado Tuerto"))
            self.assertIsNone(self.ev(lugar="Polideportivo Colonia Aldao, Santa Fe-Argentina"))
            locate.assert_not_called()

    def test_ciudad_ambigua_se_decide_por_la_ubicacion_de_la_sede(self):
        with mock.patch.object(alpogo.geocode, "locate", return_value=(-32.95, -60.65)) as locate:
            self.assertIsNotNone(self.ev(lugar="Mística.QTP, Santa Fe"))
            self.assertIsNotNone(self.ev(lugar="Jaguar Haüs"))
            self.assertEqual(locate.call_count, 2)
        with mock.patch.object(alpogo.geocode, "locate", return_value=None):
            self.assertIsNone(self.ev(lugar="Club de la ciudad de Santa Fe, Santa Fe"))

    def test_rosario_en_el_nombre_de_la_sede_alcanza(self):
        with mock.patch.object(alpogo.geocode, "locate") as locate:
            self.assertIsNotNone(self.ev(lugar="Asociación Japonesa de Rosario, Santa Fe"))
            locate.assert_not_called()

    def test_descartes(self):
        self.assertIsNone(self.ev(fecha_funcion="2026-10-24 21:00:00"))  # ya pasó
        self.assertIsNone(self.ev(visible="0"))
        self.assertIsNone(self.ev(url="javascript:alert(1)"))
        self.assertIsNone(self.ev(fecha_funcion="sin fecha"))
        self.assertEqual(self.ev(fecha_funcion="2026-10-25 20:00:00")["spec"].start, TODAY)  # hoy sí

    def test_precio_cero_no_es_gratis(self):
        ev = self.ev(menor_precio="0.00")
        self.assertNotIn("price_from", ev)
        self.assertFalse(ev["free"])
        self.assertTrue(self.ev(gratuito="1")["free"])

    def test_scrape_pagina_y_no_repite(self):
        page1 = [row(url=f"https://alpogo.com/evento/e-{i}", nombre=f"E{i}") for i in range(alpogo.PAGE)]
        page2 = [row(url="https://alpogo.com/evento/e-0", nombre="E0"), row(url="https://alpogo.com/evento/otro")]
        with mock.patch.object(alpogo, "fetch", side_effect=[json.dumps(page1), json.dumps(page2)]) as fetch, \
                mock.patch.object(alpogo.geocode, "load_cache", return_value={}), \
                mock.patch.object(alpogo.geocode, "save_cache"):
            events = alpogo.scrape(TODAY)
        self.assertEqual(len(events), alpogo.PAGE + 1)
        self.assertEqual(fetch.call_args.kwargs["payload"]["offset"], alpogo.PAGE)


LD = {
    "location": {"address": {"streetAddress": "Avenida Diario La Capital", "addressLocality": "Rosario"},
                 "@type": "Place", "name": "Anfiteatro Municipal Rosario"},
    "offers": [{"@type": "Offer", "price": 145000}, {"@type": "Offer", "price": 80000}],
    "@type": "Event", "name": "Ciro y Los Persas", "description": "Ciro y Los Persas", "image": None,
    "url": "https://www.allaccess.com.ar/event/ciro-y-los-persas",
    "startDate": "2026-11-07T00:00:00Z", "endDate": "2026-11-07T02:30:00Z",
}


def page(*items, og="https://cdn.getcrowder.com/images/ciro.jpg"):
    blocks = "".join(f'<script type="application/ld+json">{json.dumps(i)}</script>' for i in items)
    return f'<head><meta property="og:image" content="{og}">{blocks}</head>'


class AllAccess(unittest.TestCase):
    def test_hora_utc_pasa_a_hora_de_rosario(self):
        # 2026-11-07 00:00 UTC es el 6 de noviembre a las 21:00 en Rosario (la página dice «6 de noviembre»)
        ev = allaccess.parse_event(page(LD), TODAY)
        self.assertEqual(ev["spec"].start, date(2026, 11, 6))
        self.assertEqual((ev["time"], ev["venue"], ev["address"]), ("21:00", "Anfiteatro Municipal Rosario", "Avenida Diario La Capital"))
        self.assertEqual((ev["price_from"], ev["source"], ev["category"]), (80000, "AllAccess", "musica"))
        self.assertEqual(ev["image"], "https://cdn.getcrowder.com/images/ciro.jpg")  # JSON-LD sin imagen: og:image
        self.assertEqual(ev["description"], "")  # repetía el título
        self.assertEqual(to_record(ev)["sources"][0]["name"], "AllAccess")

    def test_otra_ciudad_o_pasado_o_sin_link(self):
        caba = {**LD, "location": {**LD["location"], "address": {"addressLocality": "CABA"}}}
        self.assertIsNone(allaccess.parse_event(page(caba), TODAY))
        self.assertIsNone(allaccess.parse_event(page({**LD, "startDate": "2026-10-01T20:00:00Z"}), TODAY))
        self.assertIsNone(allaccess.parse_event(page({**LD, "url": ""}), TODAY))
        self.assertIsNone(allaccess.parse_event("<p>sin json-ld</p>", TODAY))

    def test_bloque_roto_no_frena_el_resto(self):
        html = '<script type="application/ld+json">{roto</script>' + page(LD)
        self.assertIsNotNone(allaccess.parse_event(html, TODAY))

    def test_scrape_recorre_la_portada(self):
        home = ('<a href="https://www.allaccess.com.ar/event/ciro-y-los-persas">x</a>'
                '<a href="https://www.allaccess.com.ar/event/q-lokura">x</a>'
                '<a href="https://www.allaccess.com.ar/event/ciro-y-los-persas">repetido</a>')
        caba = {**LD, "url": "https://www.allaccess.com.ar/event/q-lokura",
                "location": {"address": {"addressLocality": "CABA"}, "name": "Vélez"}}
        pages = {allaccess.HOME: home, "https://www.allaccess.com.ar/event/ciro-y-los-persas": page(LD),
                 "https://www.allaccess.com.ar/event/q-lokura": page(caba)}
        with mock.patch.object(allaccess, "fetch", side_effect=pages.__getitem__):
            events = allaccess.scrape(TODAY)
        self.assertEqual([e["title"] for e in events], ["Ciro y Los Persas"])

    def test_un_evento_que_falla_no_frena_el_resto(self):
        home = ('<a href="https://www.allaccess.com.ar/event/roto">x</a>'
                '<a href="https://www.allaccess.com.ar/event/ciro-y-los-persas">x</a>')

        def fake(url):
            if url.endswith("/roto"):
                raise OSError("timeout")
            return home if url == allaccess.HOME else page(LD)

        with mock.patch.object(allaccess, "fetch", side_effect=fake):
            self.assertEqual(len(allaccess.scrape(TODAY)), 1)


class FuenteSemanal(unittest.TestCase):
    """build.py: una fuente con WEEKDAY solo corre ese día; los demás conserva lo anterior."""

    def run_main(self, today, only=None):
        prev = {"events": [{"id": "x", "title": "Ciro", "category": "musica", "categories": ["musica"], "plan": "cultura",
                            "venue": "Anfiteatro", "date_text": "", "start": "2026-11-06", "end": "2026-11-06",
                            "ranged": False, "dates": ["2026-11-06"], "address": "", "time": "", "free": False,
                            "image": "", "description": "", "feed": "AllAccess",
                            "sources": [{"name": "AllAccess", "url": "https://www.allaccess.com.ar/event/ciro"}]}],
                "sources": {"AllAccess": {"ok": True, "count": 1}}}
        fake = mock.Mock(SOURCE="AllAccess", WEEKDAY=0)
        fake.scrape.return_value = []
        argv = ["build.py", *(["--only", "allaccess"] if only else [])]
        with mock.patch.object(build, "SOURCES", {"allaccess": fake}), \
                mock.patch.object(build, "date", mock.Mock(today=lambda: today)), \
                mock.patch.object(build, "load_previous", return_value=prev), \
                mock.patch.object(build, "add_coords"), mock.patch.object(build, "build_venues"), \
                mock.patch.object(build, "build_news", return_value={}), \
                mock.patch.object(build, "OUT", mock.Mock()) as out, mock.patch("sys.argv", argv):
            build.main()
        return fake, json.loads(out.write_text.call_args.args[0])

    def test_no_es_su_dia_conserva_lo_anterior(self):
        fake, payload = self.run_main(date(2026, 10, 27))  # martes
        fake.scrape.assert_not_called()
        self.assertEqual([e["title"] for e in payload["events"]], ["Ciro"])
        self.assertEqual(payload["sources"]["AllAccess"], {"ok": True, "count": 1})

    def test_su_dia_corre(self):
        fake, payload = self.run_main(date(2026, 10, 26))  # lunes
        fake.scrape.assert_called_once()
        self.assertEqual(payload["events"], [])

    def test_only_corre_cualquier_dia(self):
        fake, _ = self.run_main(date(2026, 10, 27), only=True)
        fake.scrape.assert_called_once()


if __name__ == "__main__":
    unittest.main()
