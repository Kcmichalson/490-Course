"""Local dev server for the Fantasy Climate Mapper.

Serves this folder (Artifact2/) at http://127.0.0.1:8000/ only, so it is not
reachable from other computers. Every response carries
"Cache-Control: no-store", so the browser never runs stale modules after an
edit, and .js files are always sent as text/javascript (the Windows registry
can otherwise make Python send them as text/plain, which breaks ES modules).

Standard library only. Usage:  py serve.py [port]
"""

import functools
import http.server
import os
import sys

HOST = "127.0.0.1"
DEFAULT_PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


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


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    handler = functools.partial(NoStoreHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer((HOST, port), handler) as server:
        print(f"Serving {ROOT} at http://{HOST}:{port}/ (no-store). Ctrl+C to stop.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
