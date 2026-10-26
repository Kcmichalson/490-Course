"""Companion chat bridge (step D2): the local-only endpoints serve.py
offers under /companion/. A deliberate, local-only exception to "no
server-side code" (SPEC §15): it exists only while `py serve.py` runs on
this computer; GitHub Pages has no bridge and the panel says so.

Security (every request):
- serve.py binds to 127.0.0.1 only.
- POST only; Host must be exactly 127.0.0.1:<port> and Origin exactly
  http://127.0.0.1:<port> (blocks other websites and DNS rebinding).
- A random token per server start: POST /companion/token returns it
  (other sites can't read the reply: no CORS headers anywhere), and every
  other request must send it in X-Companion-Token.
- One model run at a time ("busy" otherwise); size limits on requests.
- Every request is logged (metadata only, no message text) to
  tool-log/bridge-YYYY-MM-DD.jsonl (untracked).

The map arrives once (POST /companion/map, Export Map Data's format) and
lives in an OS temp folder that is deleted when the server exits. Each
chat message runs claude -p with --ask's restrictions (no built-in tools,
only the three read-only map tools, no API key, an empty temp folder),
without --safe-mode (the map tool doesn't load under it).

Standard library only.
"""

import datetime
import json
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading

import companion
import mapquery

MAX_BODY = 256 * 1024             # chat, token, cancel requests
MAX_MAP = 64 * 1024 * 1024        # the gzip map data
MAX_MESSAGE_CHARS = 4000
HISTORY_MESSAGES = 12             # the last 6 exchanges are resent each turn
RUN_TIMEOUT_S = 600

CHAT_SYSTEM_PROMPT = (
    "You are a worldbuilding companion inside a fantasy climate map app. You can query the user's map through "
    "the read-only tools point, region, and overview. You have no other tools. Reply in plain text."
)

CHAT_PROMPT = """The map: {map_desc}

Conversation so far (oldest first):
{history}

Reply to the last user message. Ground what you say in the map tools (overview, region, point).
If your reply involves specific places, end it with one fenced ```json list of {{"name": "...", "lat": number, "lon": number, "radius_km": number}} with radius_km between 25 and 1000. Every place must be on land (check it with point). Any Köppen code or °C temperature you state about a place must be what point returns there, or a standard Köppen threshold (0, -3, 10, 18, 22 °C).
No preamble."""


class BridgeError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


class Bridge:
    def __init__(self, port, claude=None, log_dir=None, model=None):
        self.port = port
        self.host = f"127.0.0.1:{port}"
        self.origin = f"http://127.0.0.1:{port}"
        self.token = secrets.token_urlsafe(32)
        self.claude = claude
        self.model = model
        self.log_dir = log_dir
        self.dir = tempfile.mkdtemp(prefix="fcm-bridge-")
        self.map_path = None
        self.map = None
        self.lock = threading.Lock()
        self.proc = None
        self.cancelled = False

    def close(self):
        """Delete the temp folder (the uploaded map). Called on exit."""
        if self.proc and self.proc.poll() is None:
            self.proc.kill()
        shutil.rmtree(self.dir, ignore_errors=True)

    # ---- request checks (before the body is read) ----

    def check(self, method, path, headers):
        if method != "POST":
            raise BridgeError(405, "method", "POST only")
        if headers.get("Host") != self.host:
            raise BridgeError(403, "bad_host", "wrong Host header")
        if headers.get("Origin") != self.origin:
            raise BridgeError(403, "bad_origin", "wrong Origin header")
        if path != "/companion/token" and not secrets.compare_digest(headers.get("X-Companion-Token") or "", self.token):
            raise BridgeError(403, "bad_token", "missing or wrong token")
        try:
            length = int(headers.get("Content-Length") or 0)
        except ValueError:
            raise BridgeError(400, "bad_length", "bad Content-Length") from None
        if length > (MAX_MAP if path == "/companion/map" else MAX_BODY):
            raise BridgeError(413, "too_large", "request too large")
        return length

    # ---- endpoints ----

    def handle(self, path, body):
        if path == "/companion/token":
            return {"token": self.token}
        if path == "/companion/map":
            return self.put_map(body)
        if path == "/companion/chat":
            return self.chat(body)
        if path == "/companion/cancel":
            self.cancelled = True
            proc = self.proc
            if proc and proc.poll() is None:
                proc.kill()
            return {"cancelled": bool(proc)}
        raise BridgeError(404, "not_found", "no such endpoint")

    def put_map(self, body):
        try:
            d = mapquery.MapData(body)
        except (ValueError, KeyError, OSError, EOFError) as e:
            raise BridgeError(400, "bad_map", f"not a map data file: {e}") from None
        path = os.path.join(self.dir, "map.bin.gz")
        with open(path, "wb") as f:
            f.write(body)
        self.map_path, self.map = path, d
        return {"ok": True, "width": d.w, "height": d.h}

    def chat(self, body):
        try:
            msgs = json.loads(body.decode("utf-8"))["messages"]
            assert isinstance(msgs, list) and msgs and msgs[-1]["role"] == "user"
            for m in msgs:
                assert m["role"] in ("user", "assistant") and isinstance(m["text"], str)
        except (ValueError, KeyError, TypeError, AssertionError, UnicodeDecodeError):
            raise BridgeError(400, "bad_request", "expected {messages: [{role, text}, …]} ending with a user message") from None
        if any(len(m["text"]) > MAX_MESSAGE_CHARS for m in msgs):
            raise BridgeError(413, "too_long", f"a message is longer than {MAX_MESSAGE_CHARS} characters")
        if not self.map:
            raise BridgeError(409, "no_map", "no map uploaded yet")
        if not self.lock.acquire(blocking=False):
            raise BridgeError(409, "busy", "the companion is already answering; wait or cancel")
        try:
            return self.run(msgs[-HISTORY_MESSAGES:])
        finally:
            self.lock.release()

    def run(self, msgs):
        claude = self.claude
        if claude is None:
            claude, _ = companion.find_claude()
            if not claude:
                raise BridgeError(502, "no_claude", "claude CLI not found (see tools/README.md)")
        history = "\n\n".join(f"{'User' if m['role'] == 'user' else 'Companion'}: {m['text']}" for m in msgs)
        prompt = CHAT_PROMPT.format(map_desc=companion.map_description(self.map), history=history)
        message = json.dumps({"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": prompt}]}})
        self.cancelled = False
        with tempfile.TemporaryDirectory(prefix="fcm-chat-") as cwd:
            log_path = os.path.join(self.dir, "calls.jsonl")
            if os.path.exists(log_path):
                os.remove(log_path)
            cmd = companion.map_command(claude, companion.write_mcp_config(cwd, self.map_path, log_path), False,
                                        self.model, CHAT_SYSTEM_PROMPT)
            self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                         text=True, encoding="utf-8", cwd=cwd, env=companion.child_env())
            try:
                out, err = self.proc.communicate(message + "\n", timeout=RUN_TIMEOUT_S)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                out, err = self.proc.communicate()
                raise BridgeError(504, "timeout", "the model run took too long") from None
            finally:
                code = self.proc.returncode
                self.proc = None
            calls = companion.read_calls(log_path)
        if self.cancelled:
            raise BridgeError(499, "cancelled", "cancelled")
        info = companion.parse_stream(out.splitlines())
        result = info["result"] or ""
        if re.search(r"not logged in|/login", f"{result}\n{err}", re.IGNORECASE):
            raise BridgeError(502, "not_logged_in", "claude is not logged in: run `claude auth login` (tools/README.md)")
        if code != 0 or info["is_error"] or not result:
            raise BridgeError(502, "run_failed", f"the model run failed: {(result or err).strip()[:300]}")
        places = companion.check_chat_places(result, lambda lat, lon: mapquery.point(self.map, lat, lon))
        return {"reply": result, "places": places, "tool_calls": len(calls), "model": info["model"]}

    # ---- log ----

    def log(self, path, status, code=None, size=0):
        if not self.log_dir:
            return
        os.makedirs(self.log_dir, exist_ok=True)
        now = datetime.datetime.now()
        line = {"ts": now.isoformat(timespec="seconds"), "path": path, "status": status, "error": code, "bytes": size}
        with open(os.path.join(self.log_dir, f"bridge-{now:%Y-%m-%d}.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(line) + "\n")
