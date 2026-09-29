import json
import unittest
from datetime import date

from build import to_record
from scrapers import mil_tickets, turboentrada
from scrapers.common import coords_from_embed, decode, guess_category, in_rosario_bbox

TODAY = date(2026, 9, 29)

MAP = ('<iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3348.11!2d-60.640083999999995'
       '!3d-32.948009!3m2!1i1024"></iframe>')


class Helpers(unittest.TestCase):
    def test_decode_utf8_con_un_byte_latin1_suelto(self):
        raw = ("<p>Dirección " * 400).encode("utf-8") + b"LA MONTA\xd1A"
        text = decode(raw)
        self.assertTrue(text.endswith("LA MONTAÑA"))
        self.assertIn("Dirección", text)  # las tildes UTF-8 del resto quedan bien
        self.assertNotIn("Ã", text)

    def test_decode_legacy_cp1252(self):
        self.assertEqual(decode("Ñandú".encode("cp1252")), "Ñandú")
        self.assertEqual(decode("Ñandú".encode("utf-8")), "Ñandú")

    def test_coords_del_mapa_embebido(self):
        self.assertEqual(coords_from_embed(MAP), (-32.94801, -60.64008))
        self.assertIsNone(coords_from_embed("<p>sin mapa</p>"))

    def test_bbox_y_categoria(self):
        self.assertTrue(in_rosario_bbox(-32.95, -60.65))
        self.assertFalse(in_rosario_bbox(-34.6, -58.4))  # Buenos Aires
        self.assertEqual(guess_category("TC 2026- ROSARIO GRAN PREMIO"), "deporte")
        self.assertEqual(guess_category("Algo raro", default="musica"), "musica")


def show(**over):
    base = {
        "idEspectaculoCartel": 16559, "cNombre": "Diego Torres", "cDescripcion": "",
        "listaIdEstablecimiento": [145], "cWebUri": "https://www.turboentrada.com/landing/16559-diego-torres",
        "listaImagenes": [{"cUri": "https://img.test/small.jpg", "listaEtiquetas": ["WEB_CARRUSEL_CHICO"]},
                          {"cUri": "https://img.test/top.jpg", "listaEtiquetas": ["WEB_TOP"]}],
        "oFuncionMenor": {"bIncluyeHora": True, "oFuncionFecha": {"dFuncion": "2026-11-12T21:00:00"}},
    }
    return {**base, **over}


def est(**over):
    base = {"idEstablecimiento": 145, "cNombre": "Metropolitano Rosario", "cCiudad": "Rosario", "cZona": "Rosario",
            "cDomicilio": "Central Argentino 610 - Rosario", "cGoogleMapTag": MAP}
    return {**base, **over}


def payloads(shows, ests):
    return (json.dumps({"nCode": 200, "oData": {"listaEspectaculoCartel": shows}}),
            json.dumps({"nCode": 200, "oData": {"listaEstablecimiento": ests}}))


class Turbo(unittest.TestCase):
    def test_evento_de_rosario_con_sede_y_coords(self):
        (ev,) = turboentrada.parse(*payloads([show()], [est()]), TODAY)
        self.assertEqual((ev["title"], ev["time"], ev["venue"]), ("Diego Torres", "21:00", "Metropolitano Rosario"))
        self.assertEqual(ev["image"], "https://img.test/top.jpg")  # prefiere WEB_TOP
        self.assertEqual(ev["coords"], [[-32.94801, -60.64008]])
        rec = to_record(ev)
        self.assertEqual(rec["sources"], [{"name": "TurboEntrada", "url": show()["cWebUri"]}])

    def test_sede_sin_ciudad_se_reconoce_por_el_mapa(self):
        sede = est(cCiudad="", cZona="", cDomicilio="Sin datos")
        self.assertEqual(len(turboentrada.parse(*payloads([show()], [sede]), TODAY)), 1)

    def test_descarta_otra_ciudad_sin_fecha_y_pasados(self):
        cba = est(cCiudad="Córdoba", cZona="", cDomicilio="Av. Siempreviva 1", cGoogleMapTag="")
        self.assertEqual(turboentrada.parse(*payloads([show()], [cba]), TODAY), [])
        sin_fecha = show(oFuncionMenor=None)
        self.assertEqual(turboentrada.parse(*payloads([sin_fecha], [est()]), TODAY), [])
        pasado = show(oFuncionMenor={"bIncluyeHora": True, "oFuncionFecha": {"dFuncion": "2026-09-01T21:00:00"}})
        self.assertEqual(turboentrada.parse(*payloads([pasado], [est()]), TODAY), [])
        self.assertEqual(turboentrada.parse(*payloads([show(cWebUri="javascript:x")], [est()]), TODAY), [])


HOME = """<ul><li><a href="evento?id_evento=1560&lo-que-el-rio-hace"><div class="titulo_evento">X</div></a></li>
<li><a href="evento?id_evento=1560&lo-que-el-rio-hace">dup</a></li>
<li><a href="evento?id_evento=1466&7ma-fiesta-de-las-aldeas">Y</a></li></ul>"""

EVENT = f"""<html><body><h1>LO QUE EL RIO HACE</h1><img class="card-img-top" src="img/evento/1560.webp">
<p><b>Fechas:</b> 02/10 21:00hs - 03/10 20:00hs - 04/10 18:30hs</p>
<p><b>Lugar:</b> TEATRO LA COMEDIA</p><p><b>Dirección:</b> Mitre y Ctda. Ricardone - Rosario - Santa Fe</p>
<div id="modalDescripcionEvento"><p>Género: Comedia dramática</p>
<p>Amelia está desbordada, perdida entre objetos y obligaciones, su presente es una montaña de exigencias.</p></div>
{MAP}</body></html>"""


class MilTickets(unittest.TestCase):
    def test_lista_sin_repetir(self):
        self.assertEqual(mil_tickets.list_events(HOME), [
            "https://www.1000tickets.ar/evento?id_evento=1560&lo-que-el-rio-hace",
            "https://www.1000tickets.ar/evento?id_evento=1466&7ma-fiesta-de-las-aldeas"])

    def test_parse_evento(self):
        ev = mil_tickets.parse_event(EVENT, "https://www.1000tickets.ar/evento?id_evento=1560", TODAY)
        self.assertEqual([d.isoformat() for d in ev["spec"].dates], ["2026-10-02", "2026-10-03", "2026-10-04"])
        self.assertEqual(ev["time"], "18:30 / 20:00 / 21:00")
        self.assertEqual((ev["venue"], ev["category"]), ("TEATRO LA COMEDIA", "teatro"))
        self.assertEqual(ev["image"], "https://www.1000tickets.ar/img/evento/1560.webp")
        self.assertTrue(ev["description"].startswith("Amelia"))
        self.assertEqual(ev["coords"], [[-32.94801, -60.64008]])

    def test_descarta_indefinido_y_otra_ciudad(self):
        self.assertIsNone(mil_tickets.parse_event(EVENT.replace("02/10 21:00hs - 03/10 20:00hs - 04/10 18:30hs", "Indefinido"), "u", TODAY))
        lejos = EVENT.replace("Rosario - Santa Fe", "Salta").replace("!2d-60.640083999999995!3d-32.948009", "!2d-65.4!3d-24.8")
        self.assertIsNone(mil_tickets.parse_event(lejos, "u", TODAY))


if __name__ == "__main__":
    unittest.main()
