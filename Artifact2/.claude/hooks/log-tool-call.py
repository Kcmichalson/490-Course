"""Claude Code hook: append one JSON line per tool event to tool-log/.

Wired in .claude/settings.json for PreToolUse ("requested"), PostToolUse
("ok"), PostToolUseFailure ("failed"), and PermissionDenied ("denied", auto
mode only). A "requested" line with no later line for the same tool_use_id
means the call never ran (denied in a permission dialog or blocked).

Reads the hook's JSON on stdin. Writes tool-log/session-N.jsonl, where N
comes from tool-log/current-session.txt. Never logs file contents
(Write/Edit bodies) or tool output. Truncates every field to 500
characters. Standard library only. Always exits 0, so it never blocks a call.
"""

import json
import os
import sys
from datetime import datetime, timezone

MAX = 500
STATUS = {
    "PreToolUse": "requested",
    "PostToolUse": "ok",
    "PostToolUseFailure": "failed",
    "PermissionDenied": "denied",
}
FILE_TOOLS = {"Read", "Write", "Edit", "NotebookEdit"}
# Input keys that carry file contents or edit bodies: never logged.
CONTENT_KEYS = {"content", "old_string", "new_string", "new_source", "edits", "widget_code"}


def cut(value):
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return s if len(s) <= MAX else s[:MAX] + f"…[+{len(s) - MAX} chars]"


def summarize(tool, tool_input):
    if not isinstance(tool_input, dict):
        return {}
    if tool in ("Bash", "PowerShell"):
        return {"command": cut(tool_input.get("command", ""))}
    if tool in FILE_TOOLS:
        return {"path": cut(tool_input.get("file_path") or tool_input.get("notebook_path") or "")}
    return {k: cut(v) for k, v in tool_input.items() if k not in CONTENT_KEYS}


def main():
    try:
        data = json.loads(sys.stdin.buffer.read().decode("utf-8") or "{}")
    except ValueError:
        data = {}
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    log_dir = os.path.join(root, "tool-log")
    os.makedirs(log_dir, exist_ok=True)
    try:
        with open(os.path.join(log_dir, "current-session.txt"), encoding="utf-8") as f:
            n = f.read().strip() or "unknown"
    except OSError:
        n = "unknown"
    event = data.get("hook_event_name", "")
    tool = data.get("tool_name", "")
    line = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "status": STATUS.get(event, event),
        "tool": tool,
        "tool_use_id": data.get("tool_use_id", ""),
        "session_id": data.get("session_id", ""),
        "input": summarize(tool, data.get("tool_input")),
    }
    if event == "PostToolUseFailure":
        line["error"] = cut(data.get("error", ""))
    if event == "PermissionDenied":
        line["reason"] = cut(data.get("reason", ""))
    with open(os.path.join(log_dir, f"session-{n}.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(line, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # a logging failure must never block a tool call
        print(f"tool-log hook: {err}", file=sys.stderr)
    sys.exit(0)
