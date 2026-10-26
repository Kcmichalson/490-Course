"""Tests for the companion chat bridge (serve.py + tools/bridge.py) with
the stand-in tools/fake_claude.py: the security checks, busy, size
limits, cancel, the place checks, and the temp folder. No model is run.

Run from Artifact2/:  py -B -m unittest tools/test_bridge.py
"""

import http.client
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import serve  # noqa: E402
from test_mapquery import synthetic, write_map  # noqa: E402

FAKE = [sys.executable, "-B", os.path.join(HERE, "fake_claude.py")]


class BridgeCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.logs = os.path.join(self.tmp, "logs")
        self.server = serve.make_server(0, claude=FAKE, log_dir=self.logs)
        self.port = self.server.server_port
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f"http://127.0.0.1:{self.port}"
        self.host = f"127.0.0.1:{self.port}"
        self.map_file = os.path.join(self.tmp, "map.bin.gz")
        write_map(self.map_file, 36, 18, synthetic())
        for k in ("FAKE_CLAUDE_MODE", "FAKE_CLAUDE_REPLY", "FAKE_CLAUDE_ARGS"):
            os.environ.pop(k, None)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.server.bridge.close()
        shutil.rmtree(self.tmp)

    def request(self, path, body=b"", method="POST", host=None, origin=None, token=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        h = {"Host": host or self.host}
        if origin is not False:
            h["Origin"] = origin or self.origin
        if token:
            h["X-Companion-Token"] = token
        h.update(headers or {})
        conn.request(method, path, body=body, headers=h)
        r = conn.getresponse()
        data = r.read()
        is_json = r.getheader("Content-Type") == "application/json"
        out = (r.status, json.loads(data) if is_json else None, dict(r.getheaders()))
        conn.close()
        return out

    def token(self):
        return self.request("/companion/token")[1]["token"]

    def upload_map(self, token):
        with open(self.map_file, "rb") as f:
            return self.request("/companion/map", f.read(), token=token)

    def chat(self, token, text="Where should a capital go?", **kw):
        body = json.dumps({"messages": [{"role": "user", "text": text}]}).encode()
        return self.request("/companion/chat", body, token=token, **kw)


class Security(BridgeCase):
    def test_token_needs_exact_origin_and_host(self):
        status, reply, headers = self.request("/companion/token")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(reply["token"]), 40)
        self.assertEqual(self.request("/companion/token", origin="http://evil.example")[:2],
                         (403, {"error": "bad_origin", "message": "wrong Origin header"}))
        self.assertEqual(self.request("/companion/token", origin=False)[1]["error"], "bad_origin")
        self.assertEqual(self.request("/companion/token", origin=f"http://localhost:{self.port}")[1]["error"], "bad_origin")
        self.assertEqual(self.request("/companion/token", host=f"evil.example:{self.port}")[1]["error"], "bad_host")  # DNS rebinding
        self.assertEqual(self.request("/companion/token", host=f"localhost:{self.port}")[1]["error"], "bad_host")

    def test_no_cors_headers_anywhere(self):
        for status, _, headers in (self.request("/companion/token"), self.request("/companion/token", origin="http://evil.example"),
                                   self.request("/index.html", method="GET")):
            self.assertFalse([h for h in headers if h.lower().startswith("access-control")], headers)

    def test_missing_or_wrong_token(self):
        self.assertEqual(self.chat(None)[1]["error"], "bad_token")
        self.assertEqual(self.chat("not-the-token")[1]["error"], "bad_token")
        self.assertEqual(self.upload_map("not-the-token")[1]["error"], "bad_token")

    def test_get_is_refused(self):
        self.assertEqual(self.request("/companion/token", method="GET")[1]["error"], "method")

    def test_token_changes_per_server_start(self):
        other = serve.make_server(0, claude=FAKE, log_dir=None)
        try:
            self.assertNotEqual(other.bridge.token, self.server.bridge.token)
        finally:
            other.server_close()
            other.bridge.close()


class Limits(BridgeCase):
    def test_oversized_message_and_body(self):
        t = self.token()
        self.upload_map(t)
        self.assertEqual(self.chat(t, "x" * 4001)[:2][1]["error"], "too_long")
        big = json.dumps({"messages": [{"role": "user", "text": "x" * 300000}]}).encode()
        self.assertEqual(self.request("/companion/chat", big, token=t)[0], 413)

    def test_bad_requests(self):
        t = self.token()
        self.assertEqual(self.chat(t)[1]["error"], "no_map")
        self.assertEqual(self.request("/companion/map", b"not a map", token=t)[1]["error"], "bad_map")
        self.upload_map(t)
        self.assertEqual(self.request("/companion/chat", b"{}", token=t)[1]["error"], "bad_request")

    def test_second_request_while_busy_then_cancel(self):
        t = self.token()
        self.upload_map(t)
        os.environ["FAKE_CLAUDE_MODE"] = "sleep"
        first = {}
        th = threading.Thread(target=lambda: first.update(r=self.chat(t)))
        th.start()
        time.sleep(0.8)
        self.assertEqual(self.chat(t)[:2][1]["error"], "busy")
        self.assertEqual(self.request("/companion/cancel", b"{}", token=t)[1], {"cancelled": True})
        th.join(10)
        self.assertEqual(first["r"][1]["error"], "cancelled")


class Chat(BridgeCase):
    def test_reply_places_checked_and_restrictions(self):
        t = self.token()
        self.assertEqual(self.upload_map(t)[1], {"ok": True, "width": 36, "height": 18})
        args_file = os.path.join(self.tmp, "args.json")
        os.environ["FAKE_CLAUDE_ARGS"] = args_file
        os.environ["FAKE_CLAUDE_REPLY"] = (
            "Sunreach is a hot rainforest city, Köppen Af, 26 °C all year.\n\n"
            "Saltmere is mild, 31 °C in summer.\n\n"
            '```json\n[{"name": "Sunreach", "lat": 15, "lon": 170, "radius_km": 200},'
            ' {"name": "Saltmere", "lat": -25, "lon": -75, "radius_km": 2000},'
            ' {"name": "Drowned", "lat": 0, "lon": 0, "radius_km": 100}]\n```')
        status, reply, _ = self.chat(t)
        self.assertEqual(status, 200)
        by = {p["name"]: p for p in reply["places"]}
        self.assertEqual((by["Sunreach"]["flagged"], by["Sunreach"]["flags"]), (False, []))
        self.assertEqual(by["Saltmere"]["flags"], ["radius_km must be 25–1,000", "31 °C is not in the map's data there"])
        self.assertEqual(by["Drowned"]["flags"], ["not on land (Ocean)"])
        self.assertEqual(reply["tool_calls"], 0)
        with open(args_file, encoding="utf-8") as f:
            args = json.load(f)
        self.assertEqual(args[args.index("--tools") + 1], "")
        self.assertEqual(args[args.index("--allowedTools") + 1], "mcp__fcm__point,mcp__fcm__region,mcp__fcm__overview")
        self.assertIn("--strict-mcp-config", args)
        self.assertNotIn("--safe-mode", args)

    def test_not_logged_in(self):
        t = self.token()
        self.upload_map(t)
        os.environ["FAKE_CLAUDE_MODE"] = "logged_out"
        status, reply, _ = self.chat(t)
        self.assertEqual((status, reply["error"]), (502, "not_logged_in"))

    def test_history_is_limited(self):
        t = self.token()
        self.upload_map(t)
        msgs = [{"role": "user" if i % 2 == 0 else "assistant", "text": f"m{i}"} for i in range(21)]
        captured = {}
        real = self.server.bridge.run
        self.server.bridge.run = lambda m: captured.update(m=m) or {"reply": "", "places": [], "tool_calls": 0}
        try:
            self.request("/companion/chat", json.dumps({"messages": msgs}).encode(), token=t)
        finally:
            self.server.bridge.run = real
        self.assertEqual([m["text"] for m in captured["m"]], [f"m{i}" for i in range(9, 21)])


class TempFolderAndLog(BridgeCase):
    def test_map_in_temp_folder_removed_on_close(self):
        t = self.token()
        self.upload_map(t)
        b = self.server.bridge
        self.assertTrue(os.path.exists(b.map_path))
        self.assertTrue(os.path.realpath(b.dir).startswith(os.path.realpath(tempfile.gettempdir())))
        b.close()
        self.assertFalse(os.path.exists(b.dir))

    def test_every_request_logged_without_text(self):
        t = self.token()
        self.chat(t, "secret words")
        self.request("/companion/token", origin="http://evil.example")
        lines = []
        for name in os.listdir(self.logs):
            with open(os.path.join(self.logs, name), encoding="utf-8") as f:
                lines += [json.loads(line) for line in f]
        self.assertEqual([(l["path"], l["status"], l["error"]) for l in lines],
                         [("/companion/token", 200, None), ("/companion/chat", 409, "no_map"),
                          ("/companion/token", 403, "bad_origin")])
        self.assertTrue(all(name.startswith("bridge-") for name in os.listdir(self.logs)))
        for name in os.listdir(self.logs):
            with open(os.path.join(self.logs, name), encoding="utf-8") as f:
                self.assertNotIn("secret words", f.read())


if __name__ == "__main__":
    unittest.main()
