import json
import socket
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

import publish
from publish import (IngestError, build_batches, build_place_batches, post_batch, publish as publish_all,
                     tier_of)


def record(i, feed="Agenda municipal", venue="Teatro El Círculo"):
    return {
        "id": str(i), "title": f"Evento {i}", "category": "musica", "categories": ["musica"], "plan": "cultura",
        "venue": venue, "date_text": "3 oct", "start": "2026-10-03", "end": "2026-10-03", "ranged": False,
        "dates": ["2026-10-03"], "address": "", "time": "21:00", "price_from": None, "free": False, "image": "",
        "description": "", "sources": [{"name": feed, "url": f"https://x.example/{feed}/{i}"}], "feed": feed,
    }


class Lotes(unittest.TestCase):
    def test_un_lote_por_fuente_con_su_tier(self):
        records = [record(1), record(2, feed="Qué Hacemos"), record(3, feed="Teatro Broadway")]
        batches = build_batches(records, [], "2026-10-16T09:00:00+00:00")
        self.assertEqual([(b["source"]["name"], b["source"]["tier"]) for b in batches],
                         [("Agenda municipal", "official"), ("Qué Hacemos", "aggregator"),
                          ("Teatro Broadway", "official")])
        self.assertTrue(all(b["generated_at"] == "2026-10-16T09:00:00+00:00" for b in batches))

    def test_parte_en_lotes_de_200_como_maximo(self):
        batches = build_batches([record(i) for i in range(450)], [], "t")
        self.assertEqual([len(b["events"]) for b in batches], [200, 200, 50])
        self.assertEqual({b["source"]["name"] for b in batches}, {"Agenda municipal"})

    def test_el_tope_cuenta_eventos_no_registros(self):
        # una película en 2 cines da 2 IngestEvent: 150 registros × 2 sedes = 300 eventos
        batches = build_batches([record(i, venue="A · B") for i in range(150)], [], "t")
        self.assertEqual([len(b["events"]) for b in batches], [200, 100])

    def test_tier(self):
        self.assertEqual(tier_of("Agenda municipal"), "official")
        self.assertEqual(tier_of("Disfruta Rosario"), "aggregator")


def osm(i):
    return {"id": f"n{i}", "name": f"Lugar {i}", "kind": "Bar", "cuisine": [], "address": "", "lat": -32.9,
            "lon": -60.6, "hours": "", "phone": "", "website": "", "instagram": "", "outdoor": False}


CURADO = {"id": "casa-brava", "name": "Casa Brava", "kind": "bar", "address": "Pichincha 120", "lat": -32.93,
          "lon": -60.66, "offers": ["musica_en_vivo"], "instagram": "", "website": "", "note": ""}


class LotesDeLugares(unittest.TestCase):
    def test_curados_primero_y_osm_en_lotes_de_200(self):
        batches = build_place_batches([CURADO, {**CURADO, "id": "sin-coords", "lat": None, "lon": None}],
                                      [osm(i) for i in range(450)], "t")
        self.assertEqual([(b["source"]["name"], b["source"]["tier"], len(b["places"])) for b in batches],
                         [("Curados", "curated", 1), ("OpenStreetMap", "aggregator", 200),
                          ("OpenStreetMap", "aggregator", 200), ("OpenStreetMap", "aggregator", 50)])
        self.assertTrue(all("events" not in b for b in batches))

    def test_sin_lugares_no_hay_lotes(self):
        self.assertEqual(build_place_batches([], [], "t"), [])

    def test_publish_cuenta_lugares(self):
        batches = build_place_batches([CURADO], [osm(1)], "t")
        calls = iter([ok(1)[1]["data"] | {"places": {"received": 1, "created": 1, "updated": 0, "rejected": 0}},
                      {"places": {"received": 1, "created": 0, "updated": 1, "rejected": 0}, "events": {},
                       "rejected": []}])
        totals, failures = publish_all("u", "t", batches, post=lambda *a: next(calls))
        self.assertEqual((totals, failures), ({"created": 1, "updated": 1, "rejected": 0}, []))


class Servidor(BaseHTTPRequestHandler):
    script: list = []  # (status, body) por request, en orden
    seen: list = []

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        type(self).seen.append({"auth": self.headers.get("Authorization"), "path": self.path, "json": json.loads(body)})
        status, payload = type(self).script.pop(0)
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *args):
        pass


def ok(created=1, updated=0, rejected=()):
    return 200, {"success": True, "data": {
        "events": {"received": created + updated, "created": created, "updated": updated, "rejected": len(rejected)},
        "places": {"received": 0, "created": 0, "updated": 0, "rejected": 0}, "rejected": list(rejected)}}


class Envio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), Servidor)
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/api/ingest"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        Servidor.script, Servidor.seen = [], []
        self.batch = {"source": {"name": "Agenda municipal", "tier": "official"}, "generated_at": "t",
                      "events": [{"source_key": "a:1"}]}

    def test_manda_bearer_y_el_lote(self):
        Servidor.script = [ok()]
        data = post_batch(self.url, "secreto", self.batch)
        self.assertEqual(data["events"]["created"], 1)
        self.assertEqual(Servidor.seen[0]["auth"], "Bearer secreto")
        self.assertEqual(Servidor.seen[0]["json"], self.batch)

    def test_4xx_no_se_reintenta(self):
        Servidor.script = [(400, {"success": False, "error": "mal"}), ok()]
        with self.assertRaises(IngestError) as ctx:
            post_batch(self.url, "t", self.batch, sleep=lambda s: None)
        self.assertEqual(ctx.exception.status, 400)
        self.assertEqual(len(Servidor.seen), 1)

    def test_5xx_se_reintenta_y_se_recupera(self):
        Servidor.script = [(502, {"success": False, "error": "x"}), ok()]
        data = post_batch(self.url, "t", self.batch, sleep=lambda s: None)
        self.assertEqual(data["events"]["created"], 1)
        self.assertEqual(len(Servidor.seen), 2)

    def test_5xx_persistente_falla_tras_los_reintentos(self):
        Servidor.script = [(500, {"success": False, "error": "x"})] * publish.RETRIES
        with self.assertRaises(IngestError):
            post_batch(self.url, "t", self.batch, sleep=lambda s: None)
        self.assertEqual(len(Servidor.seen), publish.RETRIES)

    def test_conexion_cortada_sin_respuesta_se_reintenta_y_falla_como_IngestError(self):
        # RemoteDisconnected sale de getresponse(), no se envuelve en URLError
        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(5)
        stop = threading.Event()

        def drop():
            srv.settimeout(0.2)
            while not stop.is_set():
                try:
                    conn, _ = srv.accept()
                    conn.recv(65536)
                    conn.close()
                except OSError:
                    pass

        threading.Thread(target=drop, daemon=True).start()
        try:
            with self.assertRaises(IngestError):
                post_batch(f"http://127.0.0.1:{srv.getsockname()[1]}/api/ingest", "t", self.batch,
                           sleep=lambda s: None)
        finally:
            stop.set()
            srv.close()

    def test_publish_suma_totales_y_sigue_ante_un_lote_roto(self):
        batches = [{**self.batch, "events": [{}] * n} for n in (3, 2, 1)]
        calls = iter([ok(2, 1), (400, {"success": False, "error": "mal"}),
                      ok(1, 0, [{"kind": "event", "index": 0, "source_key": "a:1", "reason": "x"}])])

        def fake(url, token, batch):
            status, payload = next(calls)
            if status != 200:
                raise IngestError(f"HTTP {status}", status)
            return payload["data"]

        totals, failures = publish_all("u", "t", batches, post=fake)
        self.assertEqual(totals, {"created": 3, "updated": 1, "rejected": 1})
        self.assertEqual(len(failures), 1)
        self.assertIn("Agenda municipal (2 eventos)", failures[0])

    def test_publish_corta_con_401(self):
        seen = []

        def fake(url, token, batch):
            seen.append(batch)
            raise IngestError("HTTP 401", 401)

        totals, failures = publish_all("u", "mal", [self.batch] * 3, post=fake)
        self.assertEqual(len(seen), 1)
        self.assertEqual(len(failures), 1)
        self.assertEqual(totals["created"], 0)


if __name__ == "__main__":
    unittest.main()
