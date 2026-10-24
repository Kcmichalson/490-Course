# Tool-call log

Written automatically by a Claude Code hook (`.claude/settings.json` →
`.claude/hooks/log-tool-call.py`, Python standard library only). Don't edit
or disable it.

- The logs are kept locally on each machine and are not committed
  (`.gitignore` excludes `tool-log/*.jsonl`), because GitHub Pages would
  serve the commands and paths publicly. Only this README is tracked.
- `YYYY-MM-DD.jsonl` (the local date): one JSON line per tool event. A
  SessionStart hook writes a `session_start` line at the start of each
  session (with `source`: startup, resume, clear, or compact), so one day's
  file can hold several sessions, told apart by `session_id`.
- Fields: `ts` (UTC), `status`, `tool`, `tool_use_id`, `session_id`,
  `input`, and `error` (failed), `reason` (denied), or `source`
  (session_start).
  - `status` is `session_start`, `requested` (before the call), `ok` (it
    ran), `failed` (it ran and errored), or `denied` (auto mode only). A
    `requested` line with no later line for the same `tool_use_id` means the
    call never ran: you denied it, or a command deny rule blocked it.
  - **Denied file paths leave no log line.** A Read, Edit, or Write on a
    path matched by a deny rule is refused before the hooks run, so it
    shows only in the chat ("File is in a directory that is denied by your
    permission settings"). Denied commands (Bash/PowerShell) do get a
    `requested` line.
  - `input`: for Bash/PowerShell the full command; for file tools the path;
    for other tools their short inputs.
- File contents (Write/Edit bodies) and tool output are never logged. Every
  field is truncated at 500 characters.
