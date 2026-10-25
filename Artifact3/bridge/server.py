"""HTTP endpoints and snapshot storage. All I/O for the bridge lives here.

  POST /tts            raw Lua payload → processed snapshot
  GET  /snapshot.json  latest processed snapshot
  GET  /report         plain-text GM report
  GET  /health         bridge status and time of the last TTS payload
"""

import json
import os
import socket
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from bridge import constants as C
from bridge import report, snapshot

ENDPOINTS = ("POST /tts", "GET /snapshot.json", "GET /report", "GET /health")
DEFAULT_STORE_DIR = Path(__file__).resolve().parent.parent / C.SNAPSHOT_DIR


def utc_now():
    return datetime.now(timezone.utc)


def iso(moment):
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Store:
    """Latest snapshot (latest.json) plus change-only history (history.jsonl)."""

    def __init__(self, directory):
        self.directory = Path(directory)
        self.lock = threading.Lock()
        self.latest = None
        self.last_payload_at = None
        latest_path = self.directory / C.LATEST_FILE
        if latest_path.exists():
            with open(latest_path, encoding="utf-8") as f:
                self.latest = json.load(f)
            self.last_payload_at = self.latest.get("received_at")

    def accept(self, payload, received_at):
        """Build and store a snapshot. Returns (snapshot, recorded)."""
        with self.lock:
            prev = self.latest
            seq = prev["seq"] if prev else 0
            snap = snapshot.build_snapshot(payload, received_at, seq)
            recorded = not snapshot.same_board(prev, snap)
            if recorded:
                snap["seq"] = seq + 1
            self.directory.mkdir(parents=True, exist_ok=True)
            if recorded:
                with open(self.directory / C.HISTORY_FILE, "a",
                          encoding="utf-8", newline="\n") as f:
                    f.write(json.dumps(snap, sort_keys=True) + "\n")
            self._write_latest(snap)
            self.latest = snap
            self.last_payload_at = received_at
            return snap, recorded

    def _write_latest(self, snap):
        # Write a temp file, then swap it in, so a reader never sees half a file.
        path = self.directory / C.LATEST_FILE
        tmp = path.with_name(path.name + ".tmp")
        with open(tmp, "w", encoding="utf-8", newline="\n") as f:
            json.dump(snap, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp, path)


class BridgeServer(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows SO_REUSEADDR lets a second server bind a port already in
    # use, silently. Ask for exclusive use instead so "port in use" fails.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET,
                                   socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def make_handler(store, clock, quiet):
    class Handler(BaseHTTPRequestHandler):
        server_version = "LancerBridge/1"

        def log_message(self, fmt, *args):
            if not quiet:
                sys.stderr.write("%s %s\n" % (iso(clock()), fmt % args))

        def _send(self, status, body, content_type):
            data = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _json(self, status, obj):
            self._send(status, json.dumps(obj, indent=2, sort_keys=True) + "\n",
                       "application/json; charset=utf-8")

        def _text(self, status, text):
            self._send(status, text, "text/plain; charset=utf-8")

        def _guard(self, action):
            try:
                action()
            except Exception as exc:  # never let one request kill the bridge
                self.close_connection = True
                try:
                    self._json(500, {"error": "internal error: %s" % exc})
                except OSError:
                    pass

        def do_GET(self):
            self._guard(self._get)

        def do_POST(self):
            self._guard(self._post)

        def _get(self):
            path = self.path.split("?", 1)[0]
            if path == "/health":
                latest = store.latest
                self._json(200, {"status": "ok", "schema": C.SCHEMA_VERSION,
                                 "last_payload_at": store.last_payload_at,
                                 "latest_seq": latest["seq"] if latest else None})
            elif path == "/snapshot.json":
                if store.latest is None:
                    self._json(404, {"error": "no snapshot yet"})
                else:
                    self._json(200, store.latest)
            elif path == "/report":
                if store.latest is None:
                    self._text(404, "No snapshot yet.\n")
                else:
                    self._text(200, report.render(store.latest))
            elif path == "/tts":
                self._json(405, {"error": "use POST for /tts"})
            else:
                self._json(404, {"error": "not found",
                                 "endpoints": list(ENDPOINTS)})

        def _post(self):
            path = self.path.split("?", 1)[0]
            if path != "/tts":
                if path in ("/health", "/snapshot.json", "/report"):
                    self._json(405, {"error": "use GET for %s" % path})
                else:
                    self._json(404, {"error": "not found",
                                     "endpoints": list(ENDPOINTS)})
                return
            length = self.headers.get("Content-Length")
            if length is None or not length.isdigit():
                self.close_connection = True
                self._json(411, {"error": "Content-Length required"})
                return
            if int(length) > C.MAX_BODY_BYTES:
                self.close_connection = True
                self._json(413, {"error": "payload over %d bytes"
                                 % C.MAX_BODY_BYTES})
                return
            raw = self.rfile.read(int(length))
            try:
                payload = json.loads(raw.decode("utf-8"))
            except UnicodeDecodeError:
                self._json(400, {"error": "body is not UTF-8"})
                return
            except json.JSONDecodeError as exc:
                self._json(400, {"error": "invalid JSON: %s" % exc})
                return
            try:
                snap, recorded = store.accept(payload, iso(clock()))
            except snapshot.PayloadError as exc:
                self._json(400, {"error": str(exc)})
                return
            self._json(200, {"ok": True, "seq": snap["seq"],
                             "recorded": recorded,
                             "units": len(snap["units"]),
                             "warnings": snap["warnings"]})

    return Handler


def make_server(host=C.HOST, port=C.PORT, store_dir=DEFAULT_STORE_DIR,
                clock=utc_now, quiet=False):
    """Create (but don't start) the bridge server. Port 0 = any free port."""
    if host != C.HOST:
        raise ValueError("the bridge only binds %s; got %r" % (C.HOST, host))
    store = Store(store_dir)
    server = BridgeServer((host, port), make_handler(store, clock, quiet))
    server.store = store
    return server
