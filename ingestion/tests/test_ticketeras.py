import json
import unittest
from datetime import date
from unittest import mock

from build import to_record
from scrapers import mil_tickets, produccionesdeaca, ticketle, turboentrada
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


LD = """<html><head>
<script type="application/ld+json">{"@type": "MusicEvent", "name": "Camilo", "startDate": "2026-10-30",
 "url": "https://www.ticketle.com.ar/camilo-rosario-tickets-30-10-2026/event/1", "image": "https://cdn.test/c.jpg",
 "location": {"name": "Metropolitano De Rosario", "address": {"addressLocality": "Rosario"}},
 "offers": {"price": 100240, "priceCurrency": "ARS"}}</script>
<script type="application/ld+json">{"@type": "MusicEvent", "name": "Airbag", "startDate": "2026-11-03",
 "url": "https://www.ticketle.com.ar/airbag/event/2", "location": {"name": "Estadio", "address": {"addressLocality": "Rosario"}}}</script>
<script type="application/ld+json">{"@type": "MusicEvent", "name": "Bad Bunny", "startDate": "2026-12-01",
 "url": "https://www.ticketle.com.ar/bb/event/3", "location": {"name": "River", "address": {"addressLocality": "Buenos Aires"}}}</script>
<script type="application/ld+json">{"@type": "MusicEvent", "name": "Ya pasó", "startDate": "2026-09-01",
 "url": "https://www.ticketle.com.ar/x/event/4", "location": {"name": "S", "address": {"addressLocality": "Rosario"}}}</script>
<script type="application/ld+json">{ roto</script>
<script type="application/ld+json">{"@type": "Organization", "name": "Ticketle"}</script>
</head></html>"""


class Ticketle(unittest.TestCase):
    def test_eventos_de_rosario_con_sede_y_sin_precio(self):
        evs = ticketle.parse(LD, TODAY)
        self.assertEqual([e["title"] for e in evs], ["Camilo", "Airbag"])
        camilo = evs[0]
        self.assertEqual((camilo["venue"], camilo["category"], camilo["time"]), ("Metropolitano De Rosario", "musica", ""))
        self.assertEqual(camilo["image"], "https://cdn.test/c.jpg")
        rec = to_record(camilo)
        self.assertIsNone(rec["price_from"])  # el precio de Ticketle es de reventa: no se publica
        self.assertEqual(rec["sources"][0]["name"], "Ticketle")

    def test_descarta_links_inseguros(self):
        peligroso = LD.replace("https://www.ticketle.com.ar/airbag/event/2", "javascript:alert(1)")
        self.assertEqual([e["title"] for e in ticketle.parse(peligroso, TODAY)], ["Camilo"])


class TicketlePaginado(unittest.TestCase):
    def test_sigue_las_paginas_hasta_que_no_hay_siguiente(self):
        def ld(name, n):
            return ('<script type="application/ld+json">{"@type": "MusicEvent", "name": "%s", "startDate": "2026-11-01", '
                    '"url": "https://www.ticketle.com.ar/x/event/%d", "location": {"name": "S", "address": '
                    '{"addressLocality": "Rosario"}}}</script>' % (name, n))
        pages = {ticketle.URL: ld("Uno", 1) + '<a data-element=next-page href="/rosario?page=2">',
                 ticketle.URL + "?page=2": ld("Dos", 2) + ld("Uno", 1)}
        with mock.patch.object(ticketle, "fetch", side_effect=lambda url: pages[url]) as fetch:
            evs = ticketle.scrape(TODAY)
        self.assertEqual([e["title"] for e in evs], ["Uno", "Dos"])  # sin repetir el de la página 1
        self.assertEqual([c.args[0] for c in fetch.call_args_list], [ticketle.URL, ticketle.URL + "?page=2"])


ACA_HOME ="""<main data-vista="productor"><section class="js_slides"><article>
<a href="/eventos/rolockanroll-en-vivo-e167"><h2>ROLOCKAN'ROLL</h2></a></article></section>
<section class="eventos"><article><a href="/eventos/rolockanroll-en-vivo-e167">dup</a></article>
<article><a href="/eventos/experiencia-tr3ce-e172">TR3CE</a></article>
<a href="/contacto">Contacto</a><a href="https://www.eventosimple.com/">x</a></section></main>"""

ACA_EVENT = """<html><head><meta property="og:image" content="https://serv1.evento-simple.com/e167_xl.jpg" /></head>
<body><main data-vista="evento"><div class="e-evento"><section class="eventos evento"><article><div><div>
<h3>En venta</h3><h2>ROLOCKAN'ROLL EN VIVO</h2>
<div class="fecha"><label>Fecha</label><h4>28.NOV.2026 23:50hs</h4></div>
<div class="lugar"><label>Lugar</label><h4>Que Sea Rock <span>Sta Fe 1166, Rosario, Santa Fe</span></h4></div>
<div class="precio"><label>Precios desde</label><h4><span class="es_precio" data-moneda="ARS" data-valor="12000">$12.000</span></h4></div>
</div></div></article></section></div>
<div class="e-evento descripcion"><div><h4>Descripción</h4><div><p>Con más de dos décadas de recorrido.</p><p>&nbsp;</p><p>Rock hasta que apaguen las luces.</p></div></div></div>
<div class="e-evento lugar"><div><h2>Que Sea Rock</h2><div class="mapa"><a href="https://www.google.com/maps/search/?api=1&query=-32.9448582,-60.6388393&query_place_id=X">m</a></div></div></div>
</main></body></html>"""


class ProduccionesDeAca(unittest.TestCase):
    def test_lista_sin_repetir_y_solo_eventos(self):
        self.assertEqual(produccionesdeaca.list_events(ACA_HOME), [
            "https://ticketera.produccionesdeaca.com/eventos/rolockanroll-en-vivo-e167",
            "https://ticketera.produccionesdeaca.com/eventos/experiencia-tr3ce-e172"])

    def test_parse_evento(self):
        ev = produccionesdeaca.parse_event(ACA_EVENT, "https://ticketera.produccionesdeaca.com/eventos/x-e167", TODAY)
        self.assertEqual((ev["title"], ev["time"], ev["venue"]), ("ROLOCKAN'ROLL EN VIVO", "23:50", "Que Sea Rock"))
        self.assertEqual(ev["address"], "Sta Fe 1166, Rosario, Santa Fe")
        self.assertEqual([d.isoformat() for d in ev["spec"].dates], ["2026-11-28"])
        self.assertEqual((ev["price_from"], ev["category"]), (12000, "musica"))
        self.assertEqual(ev["coords"], [[-32.9448582, -60.6388393]])
        self.assertEqual(ev["image"], "https://serv1.evento-simple.com/e167_xl.jpg")
        self.assertEqual(ev["description"], "Con más de dos décadas de recorrido. Rock hasta que apaguen las luces.")

    def test_descarta_finalizado_pasado_y_otra_ciudad(self):
        url = "https://ticketera.produccionesdeaca.com/eventos/x-e1"
        fin = ACA_EVENT.replace("<h3>En venta</h3>", "<h3>Evento Finalizado</h3>")
        self.assertIsNone(produccionesdeaca.parse_event(fin, url, TODAY))
        self.assertIsNone(produccionesdeaca.parse_event(ACA_EVENT.replace("28.NOV.2026", "28.AGO.2026"), url, TODAY))
        lejos = ACA_EVENT.replace("Rosario, Santa Fe", "Salta").replace("-32.9448582,-60.6388393", "-24.8,-65.4")
        self.assertIsNone(produccionesdeaca.parse_event(lejos, url, TODAY))
        self.assertIsNone(produccionesdeaca.parse_event(ACA_EVENT.replace("NOV", "XYZ"), url, TODAY))


if __name__ == "__main__":
    unittest.main()
