"""HTTP tests: a real bridge on 127.0.0.1 (random port) in a background
thread, called with urllib (proxies disabled). No curl, no TTS."""

import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from bridge import constants as C
from bridge.server import make_server

FIXTURES = Path(__file__).resolve().parent / "fixtures"
FIXED_TIME = datetime(2026, 10, 24, 22, 15, 3, tzinfo=timezone.utc)
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def fixture_bytes(name):
    return (FIXTURES / name).read_bytes()


def fixture_json(name):
    return json.loads(fixture_bytes(name).decode("utf-8"))


class BridgeTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.start()

    def start(self):
        self.server = make_server(port=0, store_dir=self.tmp.name,
                                  clock=lambda: FIXED_TIME, quiet=True)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(5)

    def tearDown(self):
        self.stop()
        self.tmp.cleanup()

    def call(self, method, path, body=None, headers=None):
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (self.port, path),
                                     data=body, method=method, headers=headers or {})
        try:
            with OPENER.open(req, timeout=5) as resp:
                return resp.status, resp.headers.get("Content-Type"), resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            return exc.code, exc.headers.get("Content-Type"), exc.read().decode("utf-8")

    def history_lines(self):
        path = Path(self.tmp.name) / C.HISTORY_FILE
        return path.read_text(encoding="utf-8").splitlines() if path.exists() else []


class EndpointTests(BridgeTestCase):
    def test_binds_loopback_only(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        with self.assertRaises(ValueError):
            make_server(host="0.0.0.0", port=0, store_dir=self.tmp.name)

    def test_port_in_use_fails(self):
        with self.assertRaises(OSError):
            make_server(port=self.port, store_dir=self.tmp.name, quiet=True)

    def test_health_before_any_payload(self):
        status, ctype, body = self.call("GET", "/health")
        self.assertEqual(status, 200)
        self.assertIn("application/json", ctype)
        self.assertEqual(json.loads(body), {"status": "ok", "schema": 2,
                                            "last_payload_at": None, "latest_seq": None})

    def test_no_snapshot_yet(self):
        self.assertEqual(self.call("GET", "/snapshot.json")[0], 404)
        status, _, body = self.call("GET", "/report")
        self.assertEqual((status, body), (404, "No snapshot yet.\n"))

    def test_post_each_fixture(self):
        for orient in ("pointy", "flat", "calibrated"):
            with self.subTest(orient=orient):
                status, _, body = self.call("POST", "/tts", fixture_bytes("payload_%s.json" % orient))
                self.assertEqual(status, 200, body)
                self.assertTrue(json.loads(body)["ok"])
                status, _, body = self.call("GET", "/snapshot.json")
                self.assertEqual(status, 200)
                got = json.loads(body)
                expected = fixture_json("expected_snapshot_%s.json" % orient)
                for key in ("seq", "received_at"):
                    got.pop(key)
                    expected.pop(key)
                self.assertEqual(got, expected)

    def test_report_matches_golden(self):
        self.call("POST", "/tts", fixture_bytes("payload_pointy.json"))
        status, ctype, body = self.call("GET", "/report")
        self.assertEqual(status, 200)
        self.assertIn("text/plain", ctype)
        golden = (FIXTURES / "report_pointy.txt").read_bytes().decode("utf-8")
        self.assertEqual(body, golden)

    def test_health_after_payload(self):
        self.call("POST", "/tts", fixture_bytes("payload_pointy.json"))
        health = json.loads(self.call("GET", "/health")[2])
        self.assertEqual(health["last_payload_at"], "2026-10-24T22:15:03Z")
        self.assertEqual(health["latest_seq"], 1)

    def test_unknown_paths_and_methods(self):
        status, _, body = self.call("GET", "/nope")
        self.assertEqual(status, 404)
        self.assertIn("POST /tts", body)
        self.assertEqual(self.call("GET", "/tts")[0], 405)
        self.assertEqual(self.call("POST", "/report", b"{}")[0], 405)


class MalformedTests(BridgeTestCase):
    def assertBadRequest(self, body, message):
        status, _, text = self.call("POST", "/tts", body)
        self.assertEqual(status, 400, text)
        self.assertIn(message, json.loads(text)["error"])
        # The bridge is still alive and answering.
        self.assertEqual(self.call("GET", "/health")[0], 200)

    def test_malformed_payloads_return_400(self):
        self.assertBadRequest(b"{not json", "invalid JSON")
        self.assertBadRequest(b"\xff\xfe\x00", "not UTF-8")
        self.assertBadRequest(b"[1, 2]", "must be a JSON object")
        self.assertBadRequest(b'{"payload_version": 2, "objects": []}', "missing 'grid'")
        self.assertBadRequest(
            b'{"payload_version": 2, "grid": {"type": 1, "sizeX": 2, "sizeY": 2}, "objects": []}',
            "grid must be hex")
        self.assertBadRequest(
            b'{"payload_version": 2, "grid": {"type": 2, "sizeX": 2, "sizeY": 2}, "objects": {}}',
            "'objects' must be a list")

    def test_bad_post_does_not_replace_good_snapshot(self):
        self.call("POST", "/tts", fixture_bytes("payload_pointy.json"))
        self.call("POST", "/tts", b"{broken")
        self.assertEqual(json.loads(self.call("GET", "/snapshot.json")[2])["seq"], 1)

    def test_oversize_body_413(self):
        # Claim an oversize body without sending it: the bridge must refuse
        # from the header alone, without reading the body.
        status, _, body = self.call("POST", "/tts", b"",
                                    {"Content-Length": str(C.MAX_BODY_BYTES + 1)})
        self.assertEqual(status, 413, body)
        self.assertEqual(self.call("GET", "/health")[0], 200)


class StorageTests(BridgeTestCase):
    def test_history_records_only_changes(self):
        body = fixture_bytes("payload_pointy.json")
        first = json.loads(self.call("POST", "/tts", body)[2])
        second = json.loads(self.call("POST", "/tts", body)[2])
        self.assertEqual((first["seq"], first["recorded"]), (1, True))
        self.assertEqual((second["seq"], second["recorded"]), (1, False))
        self.assertEqual(len(self.history_lines()), 1)
        moved = fixture_json("payload_pointy.json")
        moved["objects"][0]["position"]["x"] += 2.0
        third = json.loads(self.call("POST", "/tts", json.dumps(moved).encode())[2])
        self.assertEqual((third["seq"], third["recorded"]), (2, True))
        lines = self.history_lines()
        self.assertEqual(len(lines), 2)
        self.assertEqual([json.loads(l)["seq"] for l in lines], [1, 2])

    def post_json(self, payload):
        return json.loads(self.call("POST", "/tts", json.dumps(payload).encode())[2])

    def test_no_history_while_a_unit_is_in_motion(self):
        held = fixture_json("payload_pointy.json")
        held["objects"][0]["held_by_color"] = "Red"
        held["objects"][0]["position"]["x"] += 2.0        # mid-move
        self.assertEqual(self.post_json(held)["recorded"], False)
        self.assertEqual(self.history_lines(), [])
        report = self.call("GET", "/report")[2]
        self.assertIn("IN MOTION: Vanguard (held by Red)", report)
        placed = fixture_json("payload_pointy.json")      # put down, back home
        result = self.post_json(placed)
        self.assertEqual((result["recorded"], result["seq"]), (True, 1))
        self.assertEqual(len(self.history_lines()), 1)
        self.assertEqual(self.post_json(placed)["recorded"], False)   # unchanged

    def test_valid_calibration_is_saved_and_survives_restart(self):
        self.call("POST", "/tts", fixture_bytes("payload_calibrated.json"))
        cal_path = Path(self.tmp.name) / C.CALIBRATION_FILE
        self.assertTrue(cal_path.exists())
        saved = json.loads(cal_path.read_text(encoding="utf-8"))
        self.assertAlmostEqual(saved["lattice"]["q"]["x"], 2.3907619, places=4)
        self.stop()
        self.start()
        bad = fixture_json("payload_calibrated.json")
        for o in bad["objects"]:
            if "Point: B" in o["description"]:
                o["description"] = "AIT: Calibration\nPoint: B\nHexes: 9"
        self.post_json(bad)
        snap = json.loads(self.call("GET", "/snapshot.json")[2])
        self.assertEqual(snap["grid"]["source"], "saved_calibration")
        self.assertIn("CALIBRATION WARNING", self.call("GET", "/report")[2])
        self.assertEqual(json.loads(cal_path.read_text(encoding="utf-8")), saved)

    def test_invalid_calibration_with_nothing_saved_is_unavailable(self):
        bad = fixture_json("payload_calibrated.json")
        bad["objects"] = [o for o in bad["objects"] if "Point: A" not in o["description"]]
        self.post_json(bad)
        self.assertIn("POSITIONS UNAVAILABLE: missing calibration marker: Point: A",
                      self.call("GET", "/report")[2])
        self.assertFalse((Path(self.tmp.name) / C.CALIBRATION_FILE).exists())

    def test_last_payload_is_kept_even_when_malformed(self):
        path = Path(self.tmp.name) / C.LAST_PAYLOAD_FILE
        body = fixture_bytes("payload_pointy.json")
        self.call("POST", "/tts", body)
        self.assertEqual(path.read_bytes(), body)
        self.call("POST", "/tts", b"{broken")
        self.assertEqual(path.read_bytes(), b"{broken")

    def test_restart_reloads_latest(self):
        self.call("POST", "/tts", fixture_bytes("payload_pointy.json"))
        self.stop()
        self.start()
        status, _, body = self.call("GET", "/snapshot.json")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["seq"], 1)
        health = json.loads(self.call("GET", "/health")[2])
        self.assertEqual(health["last_payload_at"], "2026-10-24T22:15:03Z")
        self.assertFalse((Path(self.tmp.name) / (C.LATEST_FILE + ".tmp")).exists())


if __name__ == "__main__":
    unittest.main()
