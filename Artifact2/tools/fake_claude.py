"""A stand-in for `claude -p` (tests and offline trials of the bridge):
reads the stream-json message on stdin and prints a stream-json reply.

FAKE_CLAUDE_MODE: reply (default) | sleep (3 s, then reply) | logged_out
FAKE_CLAUDE_REPLY: the reply text (default: one place, Paris)
FAKE_CLAUDE_ARGS: if set, the command line is written to this file
"""

import json
import os
import sys
import time

DEFAULT_REPLY = (
    "A river capital fits here.\n\n"
    '```json\n[{"name": "Lutetia", "lat": 48.86, "lon": 2.35, "radius_km": 120}]\n```'
)


def main():
    sys.stdin.read()
    if os.environ.get("FAKE_CLAUDE_ARGS"):
        with open(os.environ["FAKE_CLAUDE_ARGS"], "w", encoding="utf-8") as f:
            json.dump(sys.argv[1:], f)
    mode = os.environ.get("FAKE_CLAUDE_MODE", "reply")
    print(json.dumps({"type": "system", "subtype": "init", "model": "fake", "tools": [],
                      "mcp_servers": [{"name": "fcm", "status": "connected"}]}), flush=True)
    if mode == "logged_out":
        print(json.dumps({"type": "result", "is_error": True, "result": "Not logged in · Please run /login"}))
        return 1
    if mode == "sleep":
        time.sleep(3)
    reply = os.environ.get("FAKE_CLAUDE_REPLY", DEFAULT_REPLY)
    print(json.dumps({"type": "result", "is_error": False, "result": reply, "modelUsage": {"fake-model": {}}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
