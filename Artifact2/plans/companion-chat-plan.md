# Step D: live companion chat panel (local only; approved Session 11)

## Context
A chat panel in the app that asks Claude (claude -p, through a local
bridge in serve.py) about the current map, with places shown on the map.
Local only; the GitHub Pages site shows a "needs the local server" note.
Hard stop 22:30 on 2026-10-25 (demo video). Each part gets its own by-eye
check and commit message; anything unfinished at 22:20 is recorded as in
progress for a later session.

## D1: place display (no bridge needed)
- src/ui/places.js (pure): `parsePlaces(text)` (the fenced JSON list;
  radius_km 25–1,000), `placeEllipse(map, place)` (circle in source px,
  wider east-west by 1/cos(lat), via coords.js), `placeView` (zoom so the
  circle fills ~40% of the view).
- MapView.draw: a `places` option draws circles + labeled markers in
  screen space; `picture()` never draws them (excluded from Export Map
  Picture).
- Chips pan and zoom with the existing viewport functions.
- Panel top-left of the map, collapsible, existing panel style, theme
  variables only; added to `reservedRects()` so graticule labels avoid it.
  Legend (bottom-right), overlay control (top-right), zoom (toolbar)
  untouched.
- A "Paste sample reply" box makes D1 testable before the bridge exists.

## D2: bridge in serve.py
- POST-only endpoints under /companion/: token, map, chat, cancel.
- Every request: Host exactly 127.0.0.1:8000, Origin exactly
  http://127.0.0.1:8000; a per-start random token
  (`secrets.token_urlsafe(32)`) in `X-Companion-Token` on all but token;
  no CORS headers; bound to 127.0.0.1.
- One run at a time (409 "busy"). Limits: chat body 256 KB, message 4,000
  characters, map 64 MB.
- Map stored in an OS temp folder, deleted on exit.
- Request log: tool-log/bridge-YYYY-MM-DD.jsonl (untracked), metadata
  only.
- Runs: the --ask command builder shared (no --safe-mode for chat), Popen
  so cancel can kill the run.
- Tests: tools/fake_claude.py stand-in; tools/test_bridge.py for wrong
  Origin, wrong Host, missing or wrong token, busy, oversized message, no
  CORS headers, temp folder removed.

## D3: wiring
- The panel posts the conversation (last 6 exchanges); the map is sent
  with the first message and again only if it changed.
- "Thinking…" + Cancel; errors for server not running, not logged in,
  busy, run failed.
- Not on http://127.0.0.1:8000 → "Chat needs the local server (py
  serve.py)", nothing sent.

## Reply contract and checks
Text plus, when places come up, a fenced JSON list of {name, lat, lon,
radius_km}. Each place: radius 25–1,000, on land, and any Köppen code or
°C value in the paragraphs naming it matches the map there. No retry;
flagged places shown with a warning, never hidden. The reply also returns
the number of map-tool calls.

## Defaults (approved)
N = 6 exchanges; claims = paragraphs naming the place; ellipse highlight;
nothing persisted; the map re-sent only when it changed; Node tests for
the pure place logic, by-eye for the panel DOM.

## Docs
SPEC §15 and LOG: the bridge is a deliberate local-only exception to "no
server-side code".

## Future steps (not tonight)
- The rainfall check (Climate inputs Phase C: Phoenix rain split, C2,
  retiming).
- Checking climate claims in prose and hooks (from step C).
- Distance claims: check distances the model states (between places, or
  to the coast) against the map. They're unchecked now, and the first
  real chat showed two wrong ones.
