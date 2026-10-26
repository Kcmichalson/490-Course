# Climate companion (Artifact 3)

Worldbuilding advice for one tile of a Fantasy Climate Mapper map. The
app exports the tile's simulated climate as a small JSON file. Then
`companion.py` sends that JSON to Claude Code headless (`claude -p`),
checks the reply, and writes `advice.md`.

A model does real work on every run: it writes the advice. The code
decides whether that advice is accepted.

## What is sent, and what isn't

- **Sent to Claude:** only the tile summary JSON (about 1 KB). It holds
  latitude/longitude, elevation, surface category, the Köppen code and
  name, 12 monthly temperatures and rain totals, wind, and distance to
  the coast. A fixed prompt goes with it. See
  [examples/fcm-tile-48.86N_2.35E.json](examples/fcm-tile-48.86N_2.35E.json).
- **Never sent:** the map. Imported images, heightmaps, and every other
  tile stay on this machine. The export happens in the browser (a
  download; nothing is uploaded), and the script reads only the one JSON
  file you give it.

## What the model is responsible for

The advice text, in Markdown, under six fixed headings:

1. Overview
2. Settlements
3. Crops and food
4. Trade
5. Cultures
6. Real-world parallels

The model receives the JSON and the prompt only:
- It has no tools, so it can't read or write files, run commands, or
  browse the web.
- It has no MCP servers.
- It doesn't load this project's CLAUDE.md, settings, hooks, or skills.

Everything it writes is a suggestion. The climate numbers come from the
simulation, not from the model.

## What the code checks

`companion.py` checks every reply before accepting it:

| Check | Passes when |
|---|---|
| **sections** | All six `## ` headings are present. |
| **Köppen code** | Every Köppen code in the reply is the tile's code. (`Am` and `H` are also ordinary words, so they only count right after "Köppen".) |
| **temperatures** | Every °C value, including both ends of a range like "10–15 °C", is within 0.5 °C of a value in the JSON or a standard Köppen threshold. The JSON values are the 12 monthly means, warmest, coldest, and annual mean; the thresholds are 0, −3, 10, 18, and 22 °C. Any °F value fails. |
| **parallels labeled** | Every bullet under "Real-world parallels" starts with `Parallel:`. Outside that section, the words "historically", "in history", "real-world", "real world", and "on Earth" don't appear, so real history isn't presented as a fact about the fantasy world. |

If a check fails, the script retries once. It sends the list of failures
and the previous reply back to the model and asks for a corrected
version.
- **Retry passes:** `advice.md` is written. Its header, written by the
  code, names the tile, date, model, and the checks passed.
- **Retry fails too:** the script prints each failed check, keeps the
  model's last reply as `advice.raw.md`, doesn't write `advice.md`, and
  exits with code 1.

**Limits:**
- The checks are pattern matches, not fact-checking.
- An unlabeled real-world claim that avoids the listed words isn't caught.
- A temperature written without "°C" (for example "15 degrees") isn't
  checked.
- The advice is judged only against the tile's numbers, not for
  plausibility.

## How it runs `claude`

```
claude -p --tools "" --safe-mode --strict-mcp-config --disable-slash-commands
       --no-session-persistence --permission-prompts none --output-format json
       --system-prompt <fixed> [--model NAME]
```

Every flag was confirmed in `claude --help` for version 2.1.308 (Claude
Code).

| Flag or setting | What it does |
|---|---|
| `--tools ""` | Disables all built-in tools. |
| `--safe-mode` | Skips CLAUDE.md, skills, plugins, hooks, and MCP servers, and keeps the normal login. |
| `--strict-mcp-config` | Ignores every other MCP configuration. |
| `--no-session-persistence` | Saves nothing to disk. |
| `--permission-prompts none` | Denies anything that would ask for permission. |
| Prompt on stdin | The prompt and JSON are passed on stdin. |
| Fresh temporary folder | The run starts in an empty folder, so no project files are nearby. |
| API key variables removed | `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are removed from the run's environment. The run then uses your signed-in Claude subscription, not API billing. |

**Which `claude` it uses:** first the `--claude PATH` option if you give
it, then `claude` on your PATH, then the newest copy bundled with the
Claude desktop app
(`%LOCALAPPDATA%\Claude-Data\…\claude-code\<version>\…\claude.exe`). It
prints which one it used, and `advice.md` records it.

On this PC (2026-10-25), `claude` isn't on PATH, so it used the desktop
app's bundled 2.1.308. That copy needed its own one-time sign-in (run
from cmd.exe):

```
"C:\Users\Kc\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.308\c17a819afb40\claude.exe" auth login
```

**Installing the CLI so `claude` is on PATH:**
- Follow the install steps on Claude Code's official setup page.
- Or run the bundled copy's `install` command (`claude.exe install`; see
  `claude.exe --help`).
- Then check with `claude --version` and `claude auth status`
  (`"loggedIn": true`).

The bundled path changes when the desktop app updates; an installed CLI
doesn't.

## How to run it

1. Start the app: `py serve.py` from Artifact2/, then open
   http://127.0.0.1:8000. The online version works the same way.
2. Load or import a map. Open Köppen mode (Climate, then Q) and wait for
   it to draw, so the 12-month rainfall is computed.
3. Click a land tile. The context bar shows "Selected …". Click
   **Export climate summary**, and a file like
   `fcm-tile-48.86N_2.35E.json` downloads.
4. From Artifact2/:

```
py tools/companion.py "C:\Users\Kc\Downloads\fcm-tile-48.86N_2.35E.json"
```

Options:
- `--out DIR`: write `advice.md` somewhere else. The default is next to
  the JSON, replacing an earlier `advice.md`.
- `--model NAME`: a model alias or name. The default is the CLI's
  default.
- `--claude PATH`: use a specific `claude`.

Exit codes:

| Code | Meaning |
|---|---|
| 0 | `advice.md` written |
| 1 | The checks failed twice; `advice.raw.md` kept |
| 2 | Run error: no claude, an unreadable JSON, or a CLI error such as "Not logged in" |

**Tests** (canned replies, no model call). Run them from Artifact2/;
`-B` keeps Python from creating a `tools/__pycache__` folder:

```
py -B -m unittest tools/test_companion.py
```

## Map query tool (map-wide companion, bonus)

`mapquery.py` answers read-only questions about a whole map exported with
**File > Export Map Data** (`fcm-map-data-1024x512.bin.gz`). It never
writes to the map file. Standard library only.

```
py -B tools/mapquery.py point    DATA LAT LON
py -B tools/mapquery.py region   DATA SOUTH NORTH WEST EAST
py -B tools/mapquery.py overview DATA
py -B tools/mapquery.py serve    DATA --log calls.jsonl
```

- **point:** the cell at LAT/LON. Returns category, `is_land` (Land or
  Land ice), elevation, the Köppen code, 12 monthly temperatures and rain
  totals, and wind.
- **region:** a box. A WEST value greater than EAST means the box crosses
  the date line. Returns the land share, the main Köppen classes (% of
  land area), the land elevation range, and mean annual rain and
  temperature over land. Everything is area-weighted.
- **overview:**
  - Landmasses: connected land, with lakes counted as part of the land
    around them. For each: extent, area in km², and main climates.
  - Mountain ranges: connected land at or above 1,500 m, covering at
    least 20,000 km². For each: extent and peak.
  - Ice sheets on high plateaus (Antarctica, Greenland) count as ranges
    under this rule.
- **serve:** the same three queries as a stdio MCP server (tools `point`,
  `region`, `overview`), for `companion.py --ask`. With `--log`, it
  appends each call it receives to a JSONL file.

Each cell is sampled at its center pixel. A point lookup can therefore
differ slightly from the tile export at the same place: Paris is
−0.6 °C here and −0.5 °C in the tile export.

Tests (synthetic maps, no model): `py -B -m unittest tools/test_mapquery.py`

## Example

[examples/](examples/) has a real pair from the first run (2026-10-25):
- the Paris tile exported from the Earth map (Dfb in this model)
- the `advice.md` that `claude -p` wrote for it, which passed on the
  first attempt
