"""Local dev server for Price Check (standard library only).

Serves this folder at http://127.0.0.1:8004:
- bound to 127.0.0.1, so only this computer can reach it
- Cache-Control: no-store, so the browser never runs stale code
- .js served as text/javascript (Windows sometimes maps it wrongly)

Usage (from Artifact4/):  py serve.py  [port]
"""

import http.server
import os
import sys

HOST = "127.0.0.1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8004


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.ThreadingHTTPServer((HOST, PORT), Handler) as server:
        print(f"Serving Price Check at http://{HOST}:{PORT}  (Ctrl+C to stop)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
