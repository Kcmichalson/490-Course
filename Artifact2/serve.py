"""Local dev server for the Fantasy Climate Mapper.

Serves this folder (Artifact2/) at http://127.0.0.1:8000/ only, so it is not
reachable from other computers. Every response carries
"Cache-Control: no-store", so the browser never runs stale modules after an
edit, and .js files are always sent as text/javascript (the Windows registry
can otherwise make Python send them as text/plain, which breaks ES modules).

Companion chat bridge (step D2): POST requests under /companion/ go to
tools/bridge.py, a deliberate local-only exception to "no server-side code"
(SPEC §15). It checks Host, Origin, and a per-start token on every request
and sends no CORS headers; see tools/bridge.py.

Standard library only. Usage:  py serve.py [port]
"""

import atexit
import functools
import http.server
import json
import os
import sys

HOST = "127.0.0.1"
DEFAULT_PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "tools"))
sys.dont_write_bytecode = True  # no tools/__pycache__ (underscore folders stay out of the repo)
import bridge  # noqa: E402


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # ---- /companion/ (the chat bridge; never any CORS headers) ----

    def companion(self, method):
        b = self.server.bridge
        size = 0
        try:
            length = b.check(method, self.path, self.headers)
            body = self.rfile.read(length) if length else b""
            size = len(body)
            status, reply = 200, b.handle(self.path, body)
        except bridge.BridgeError as e:
            status, reply = e.status, {"error": e.code, "message": e.message}
        data = json.dumps(reply).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        b.log(self.path, status, reply.get("error"), size)

    def do_POST(self):
        if self.path.startswith("/companion/"):
            self.companion("POST")
        else:
            self.send_error(405)

    def do_GET(self):
        if self.path.startswith("/companion/"):
            self.companion("GET")  # refused: POST only
        else:
            super().do_GET()


def make_server(port, claude=None, log_dir=os.path.join(ROOT, "tool-log")):
    """The dev server with its bridge (server.bridge). Port 0 picks a free
    port (tests); the bridge then expects that port in Host and Origin."""
    handler = functools.partial(NoStoreHandler, directory=ROOT)
    server = http.server.ThreadingHTTPServer((HOST, port), handler)
    server.bridge = bridge.Bridge(server.server_port, claude=claude, log_dir=log_dir)
    return server


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    with make_server(port) as server:
        atexit.register(server.bridge.close)  # also on other exits
        print(f"Serving {ROOT} at http://{HOST}:{port}/ (no-store). Ctrl+C to stop.")
        print("Companion chat bridge on /companion/ (local only); temp map folder:", server.bridge.dir)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.bridge.close()  # deletes the uploaded map


if __name__ == "__main__":
    main()
