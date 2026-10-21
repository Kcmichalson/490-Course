# Tool-call log

Written automatically by a Claude Code hook (`.claude/settings.json` →
`.claude/hooks/log-tool-call.py`, Python standard library only). Don't edit
or disable it.

- The logs are kept locally on each machine and are not committed
  (`.gitignore` excludes `tool-log/*.jsonl` and `current-session.txt`),
  because GitHub Pages would serve the commands and paths publicly. Only
  this README is tracked.
- `session-N.jsonl`: one JSON line per tool event. N comes from
  `current-session.txt`, which is set at the start of each session.
- Fields: `ts` (UTC), `status`, `tool`, `tool_use_id`, `session_id`,
  `input`, and `error` (failed) or `reason` (denied).
  - `status` is `requested` (before the call), `ok` (it ran), `failed` (it
    ran and errored), or `denied` (auto mode only). A `requested` line with
    no later line for the same `tool_use_id` means the call never ran: you
    denied it, or it was blocked.
  - `input`: for Bash/PowerShell the full command; for file tools the path;
    for other tools their short inputs.
- File contents (Write/Edit bodies) and tool output are never logged. Every
  field is truncated at 500 characters.
