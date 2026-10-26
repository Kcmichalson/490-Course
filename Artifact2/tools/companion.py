"""Climate companion (Artifact 3): worldbuilding advice for one map tile.

Reads a tile summary exported by the app (fcm-tile-*.json, from the
context bar's "Export climate summary"), asks Claude Code headless
(`claude -p`) for worldbuilding advice with a fixed prompt, checks the
reply, and writes advice.md next to the JSON.

Only the tile summary is sent; the map itself never leaves this machine.
The model gets no tools, no MCP servers, no CLAUDE.md, and no hooks.

Usage:
    py tools/companion.py <tile.json> [--out DIR] [--claude PATH] [--model NAME]

Exit codes: 0 advice.md written; 1 the checks failed twice (the last reply
is kept as advice.raw.md); 2 a run error (no claude, bad JSON, CLI error).

Standard library only.
"""

import argparse
import base64
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import mapquery  # tools/mapquery.py, beside this script (map mode)

SUMMARY_FORMAT = "fcm-tile-summary"

SECTIONS = ["Overview", "Settlements", "Crops and food", "Trade", "Cultures", "Real-world parallels"]
PARALLELS = "Real-world parallels"

# The app's Köppen classes (src/sim/koppen.js KOPPEN_CODES).
KOPPEN_CODES = [
    "Af", "Am", "Aw",
    "BWh", "BWk", "BSh", "BSk",
    "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc", "Cfa", "Cfb", "Cfc",
    "Dsa", "Dsb", "Dsc", "Dsd", "Dwa", "Dwb", "Dwc", "Dwd", "Dfa", "Dfb", "Dfc", "Dfd",
    "ET", "EF",
    "H",
]
# "Am" and "H" are also ordinary text ("I am", "H" as a letter), so they
# only count as codes right after the word Köppen.
AMBIGUOUS_CODES = {"Am", "H"}
# Standard Köppen thresholds the model may cite (°C): freezing, the
# alternative C/D boundary, the tree line / b months, tropical, hot summer.
THRESHOLDS_C = [0.0, -3.0, 10.0, 18.0, 22.0]
TEMP_TOLERANCE_C = 0.5  # the JSON has one decimal; the model may round to whole degrees
REAL_WORLD_WORDS = ["historically", "in history", "real-world", "real world", "on Earth"]

CLI_FLAGS = [
    "-p",
    "--tools", "",                  # no built-in tools: no files, no shell, no web
    "--safe-mode",                  # no CLAUDE.md, skills, plugins, hooks, MCP servers
    "--strict-mcp-config",          # and no MCP servers from any config
    "--disable-slash-commands",
    "--no-session-persistence",     # nothing saved to disk
    "--permission-prompts", "none", # anything that would ask is denied
    "--output-format", "json",
]

SYSTEM_PROMPT = (
    "You are a worldbuilding assistant for a fantasy climate simulator. You receive one map "
    "tile's simulated climate as JSON and reply with Markdown only. You have no tools and "
    "cannot ask questions; answer from the JSON and your own knowledge."
)

PROMPT = """Here is the simulated climate of one tile of a fantasy world map (JSON):

{summary}

Write worldbuilding advice for this place in Markdown, using exactly these six level-2 headings, in this order:
## Overview
## Settlements
## Crops and food
## Trade
## Cultures
## Real-world parallels

Rules:
1. Overview: describe the climate in plain words (seasons, rain, wind, distance from the sea) from the JSON.
2. The only Köppen code you may write is {code}. Never give a Köppen code for a real place.
3. Temperatures: only in °C, and only values that appear in the JSON (the monthly means, warmest, coldest, annual mean) or the standard Köppen thresholds (0, -3, 10, 18, 22 °C). Do not invent daily highs or lows, differences, or temperatures for real places.
4. Settlements, Crops and food, Trade, and Cultures are suggestions for the fantasy world. Do not mention real places, real peoples, or real history in those sections, and do not use the words "historically", "in history", "real-world", or "on Earth" outside the Real-world parallels section.
5. Real-world parallels: 3 to 5 bullet points. Start every bullet with "Parallel:". Each names a real place or period with a similar climate and what a worldbuilder could borrow from it. They are comparisons for inspiration, not facts about the fantasy world.
6. About 400 to 600 words. No preamble and no closing remarks.
"""

RETRY = """{prompt}
Your previous reply failed these automatic checks:
{failures}

Your previous reply:
<<<
{reply}
>>>

Write the whole reply again, corrected, following every rule above."""


# ---------- Input ----------

def load_summary(path):
    """The tile summary JSON, checked for the fields the prompt and checks use."""
    with open(path, encoding="utf-8") as f:
        s = json.load(f)
    if s.get("format") != SUMMARY_FORMAT:
        raise ValueError(f"not a tile summary (format {s.get('format')!r}, expected {SUMMARY_FORMAT!r})")
    if s.get("koppen", {}).get("code") not in KOPPEN_CODES:
        raise ValueError("missing or unknown Köppen code")
    t = s.get("temperature_c", {})
    if len(t.get("monthly", [])) != 12:
        raise ValueError("temperature_c.monthly must have 12 values")
    return s


def allowed_temperatures(summary):
    t = summary["temperature_c"]
    return list(t["monthly"]) + [t["warmest"], t["coldest"], t["annual_mean"]] + THRESHOLDS_C


# ---------- Checks (pure) ----------

def split_sections(text):
    """{heading (lowercase): body} for every '## ' heading; text before the
    first heading goes under ''."""
    out = {"": []}
    current = ""
    for line in text.splitlines():
        m = re.match(r"^\s{0,3}##\s+(.+?)\s*#*\s*$", line)
        if m:
            current = m.group(1).strip().lower()
            out.setdefault(current, [])
        else:
            out[current].append(line)
    return {k: "\n".join(v) for k, v in out.items()}


def check_sections(text):
    headings = split_sections(text)
    missing = [s for s in SECTIONS if s.lower() not in headings]
    return [f"missing section: ## {s}" for s in missing]


_PLAIN_CODES = sorted((c for c in KOPPEN_CODES if c not in AMBIGUOUS_CODES), key=len, reverse=True)
_CODE_RE = re.compile(r"(?<![A-Za-z])(" + "|".join(_PLAIN_CODES) + r")(?![A-Za-z])")
_AMBIGUOUS_RE = re.compile(r"K(?:ö|o|oe)ppen[^\n.]{0,30}?(?<![A-Za-z])(" + "|".join(sorted(AMBIGUOUS_CODES)) + r")(?![A-Za-z])")


def koppen_codes_in(text):
    return [m.group(1) for m in _CODE_RE.finditer(text)] + [m.group(1) for m in _AMBIGUOUS_RE.finditer(text)]


def check_koppen(text, code):
    wrong = sorted({c for c in koppen_codes_in(text) if c != code})
    return [f"Köppen code {c} stated, but the tile is {code}" for c in wrong]


_NUM = r"[-−–]?\d+(?:\.\d+)?"
_CELSIUS = r"(?:°\s?C\b|℃|degrees\s+C(?:elsius)?\b)"
_TEMP_RE = re.compile(
    r"(?<![\w.])(" + _NUM + r")(?:\s*(?:°\s?C?)?\s*(?:to|–|—|-)\s*(" + _NUM + r"))?\s*" + _CELSIUS
)
_FAHRENHEIT_RE = re.compile(r"\d\s*°\s?F\b|℉|degrees\s+Fahrenheit", re.IGNORECASE)


def _num(s):
    return float(s.replace("−", "-").replace("–", "-"))


def temperatures_in(text):
    """Every °C value stated, both ends of a range."""
    out = []
    for m in _TEMP_RE.finditer(text):
        out.append(_num(m.group(1)))
        if m.group(2):
            out.append(_num(m.group(2)))
    return out


def check_temperatures(text, summary):
    allowed = allowed_temperatures(summary)
    failures = []
    if _FAHRENHEIT_RE.search(text):
        failures.append("temperature in °F (only °C is allowed)")
    bad = sorted({v for v in temperatures_in(text) if all(abs(v - a) > TEMP_TOLERANCE_C + 1e-9 for a in allowed)})
    failures += [f"temperature {v:g} °C is not in the tile's data or a Köppen threshold" for v in bad]
    return failures


_BULLET_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+(.*)$")


def check_parallels(text):
    sections = split_sections(text)
    failures = []
    body = sections.get(PARALLELS.lower())
    if body is not None:
        bullets = [m.group(1) for m in map(_BULLET_RE.match, body.splitlines()) if m]
        if not bullets:
            failures.append("Real-world parallels has no bullet points")
        for b in bullets:
            plain = re.sub(r"[*_]", "", b).strip()
            if not plain.lower().startswith("parallel:"):
                failures.append(f"parallel not labeled 'Parallel:': {plain[:70]}")
    for heading, part in sections.items():
        if heading == PARALLELS.lower():
            continue
        for word in REAL_WORLD_WORDS:
            if re.search(r"(?<![\w-])" + re.escape(word) + r"(?![\w-])", part, re.IGNORECASE):
                where = f"## {heading}" if heading else "the text before the first heading"
                failures.append(f"real-world wording '{word}' outside Real-world parallels (in {where})")
    return failures


CHECKS = [
    ("sections", lambda text, s: check_sections(text)),
    ("Köppen code", lambda text, s: check_koppen(text, s["koppen"]["code"])),
    ("temperatures", check_temperatures),
    ("parallels labeled", lambda text, s: check_parallels(text)),
]


def run_checks(text, summary):
    """[(check name, [failure messages])] for the checks that failed."""
    results = [(name, fn(text, summary)) for name, fn in CHECKS]
    return [(name, msgs) for name, msgs in results if msgs]


def failure_text(failed):
    return "\n".join(f"- [{name}] {msg}" for name, msgs in failed for msg in msgs)


# ---------- The model run ----------

def _version_key(path):
    m = re.search(r"claude-code[\\/](\d+(?:\.\d+)*)", path)
    return tuple(int(p) for p in m.group(1).split(".")) if m else ()


def find_claude(explicit=None):
    """(path, where it came from): --claude, then claude on PATH, then the
    newest copy bundled with the Claude desktop app."""
    if explicit:
        return explicit, "--claude"
    on_path = shutil.which("claude")
    if on_path:
        return on_path, "PATH"
    local = os.environ.get("LOCALAPPDATA", "")
    bundled = glob.glob(os.path.join(local, "Claude-Data", "*", "claude-code", "*", "*", "claude.exe"))
    if bundled:
        return max(bundled, key=_version_key), "Claude desktop app bundle"
    return None, None


def make_ask(claude, model=None):
    """ask(prompt) → (reply text, model name), running `claude -p` once."""
    def ask(prompt):
        cmd = [claude, *CLI_FLAGS, "--system-prompt", SYSTEM_PROMPT]
        if model:
            cmd += ["--model", model]
        # Never fall back to API-key billing: use the signed-in subscription only.
        env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
        # A fresh empty folder: no project CLAUDE.md or settings to discover.
        with tempfile.TemporaryDirectory(prefix="fcm-companion-") as cwd:
            proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
                                  cwd=cwd, env=env, timeout=600)
        try:
            out = json.loads(proc.stdout)
        except ValueError:
            out = None
        if proc.returncode != 0 or not out or out.get("is_error"):
            detail = out.get("result") or out.get("subtype") if out else (proc.stderr or proc.stdout).strip()
            raise RuntimeError(f"claude exited with {proc.returncode}: {str(detail)[:800]}")
        used = ", ".join(out.get("modelUsage", {}).keys()) or model or "CLI default"
        return out["result"], used
    return ask


# ---------- The companion ----------

def fmt_lat_lon(s):
    lat, lon = s["lat"], s["lon"]
    return f"{abs(lat):.2f}°{'S' if lat < 0 else 'N'}, {abs(lon):.2f}°{'W' if lon < 0 else 'E'}"


def header(summary, model, claude_source, attempt):
    k = summary["koppen"]
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    checks = ", ".join(name for name, _ in CHECKS)
    return (
        f"# Climate companion: {fmt_lat_lon(summary)}\n\n"
        f"- **Tile:** {fmt_lat_lon(summary)} · {summary['elevation_m']} m · {summary['category']} · "
        f"Köppen {k['code']} ({k['name']})\n"
        f"- **Generated:** {now} by Claude Code headless (`claude -p`, {claude_source}), model {model}\n"
        f"- **Checks passed:** {checks} (attempt {attempt} of 2)\n\n"
        "*Written by tools/companion.py. The advice below is the model's; the checks above are the code's.*\n\n"
        "---\n\n"
    )


def run_companion(summary, ask, log=print):
    """Ask, check, retry once with the failures. → (ok, reply, model,
    attempt, failed checks of the last attempt)."""
    prompt = PROMPT.format(summary=json.dumps(summary, ensure_ascii=False, indent=2), code=summary["koppen"]["code"])
    reply, model = ask(prompt)
    failed = run_checks(reply, summary)
    if not failed:
        return True, reply, model, 1, []
    log("Attempt 1 failed these checks:\n" + failure_text(failed))
    log("Retrying once with the failures sent back…")
    reply, model = ask(RETRY.format(prompt=prompt, failures=failure_text(failed), reply=reply))
    failed = run_checks(reply, summary)
    return not failed, reply, model, 2, failed


# ---------- Map mode: --ask QUESTION --map DATA [--picture PNG] ----------
# The model may call only the read-only map query tool (tools/mapquery.py,
# a stdio MCP server); the picture goes in the first message as an image.

ASK_SECTIONS = ["Placements", "Campaign hooks"]
MAP_TOOLS = ["mcp__fcm__point", "mcp__fcm__region", "mcp__fcm__overview"]

ASK_SYSTEM_PROMPT = (
    "You are a worldbuilding assistant for a fantasy climate simulator. You can query one map through the "
    "tools point, region, and overview (read-only). You have no other tools and cannot ask questions. "
    "Reply with Markdown only."
)

ASK_PROMPT = """Here is my question about my fantasy world map:

<<<
{question}
>>>

The map: {map_desc}
{picture_note}
Use the map tools to ground your answer: overview for the landmasses and mountain ranges, region for an area, point for an exact place. Check every place you choose with point before you place anything there.

Reply in Markdown with exactly these two level-2 headings, in this order:
## Placements
## Campaign hooks

Rules:
1. Placements: a short explanation, then one fenced ```json block holding a list. Each item: {{"name": "...", "lat": number, "lon": number, "koppen": "...", "reasons": "..."}}.
2. Every placement must be on land: the point tool must answer "is_land": true for its lat/lon.
3. "koppen" must be exactly the code the point tool returns at that lat/lon.
4. In "reasons", the only Köppen code you may write is that placement's own code, and every temperature must be in °C and must be a value the point tool returned there (monthly, warmest, coldest, annual mean) or a standard Köppen threshold (0, -3, 10, 18, 22 °C).
5. Campaign hooks: 3 to 6 bullet points of tabletop adventure ideas that use these places and their climates.
6. No preamble and no closing remarks.
"""


def map_description(d):
    h = d.header
    return (f"{d.w} × {d.h} cells, latitude {h['lat_top']}° to {h['lat_bottom']}°, longitude {h['lon_west']}° "
            f"spanning {h['lon_span']}°, {'wraps east-west' if h['wraps'] else 'does not wrap'}, "
            f"planet radius {h.get('radius_km', 6371)} km")


def find_json_block(text):
    """The first ```json fenced block's text, or None."""
    m = re.search(r"```json\s*\n(.*?)```", text, re.DOTALL)
    return m.group(1) if m else None


def check_ask(text, lookup):
    """[(check name, [failures])] for an --ask answer. lookup(lat, lon) →
    the map query tool's point answer (raises ValueError outside the map)."""
    failed = []
    headings = split_sections(text)
    missing = [f"missing section: ## {s}" for s in ASK_SECTIONS if s.lower() not in headings]
    if missing:
        failed.append(("sections", missing))
    block = find_json_block(headings.get("placements", ""))
    if block is None:
        failed.append(("placements JSON", ["no ```json block under ## Placements"]))
        return failed
    try:
        places = json.loads(block)
    except ValueError as e:
        failed.append(("placements JSON", [f"the JSON block doesn't parse: {e}"]))
        return failed
    shape = []
    if not isinstance(places, list) or not places:
        shape.append("the JSON block must be a non-empty list")
        places = []
    good = []
    for n, p in enumerate(places, 1):
        if not isinstance(p, dict):
            shape.append(f"placement {n} is not an object")
            continue
        bad = [k for k in ("name", "koppen", "reasons") if not isinstance(p.get(k), str)]
        bad += [k for k in ("lat", "lon") if not isinstance(p.get(k), (int, float)) or isinstance(p.get(k), bool)]
        if bad:
            shape.append(f"placement {n} ({p.get('name', '?')}): missing or wrong {', '.join(bad)}")
        else:
            good.append(p)
    if shape:
        failed.append(("placements JSON", shape))
    land, climate = [], []
    for p in good:
        label = f"{p['name']} ({p['lat']}, {p['lon']})"
        try:
            cell = lookup(p["lat"], p["lon"])
        except ValueError as e:
            land.append(f"{label}: {e}")
            continue
        if not cell["is_land"]:
            land.append(f"{label} is {cell['category']}, not land")
            continue
        code = cell["koppen"]["code"] if cell["koppen"] else None
        if p["koppen"] != code:
            climate.append(f"{label}: koppen {p['koppen']} claimed, the map says {code}")
        wrong = sorted({c for c in koppen_codes_in(p["reasons"]) if c != code})
        climate += [f"{label}: reasons mention Köppen {c}, the map says {code}" for c in wrong]
        t = cell["temperature_c"]
        allowed = list(t["monthly"]) + [t["warmest"], t["coldest"], t["annual_mean"]] + THRESHOLDS_C
        if _FAHRENHEIT_RE.search(p["reasons"]):
            climate.append(f"{label}: temperature in °F (only °C is allowed)")
        bad_t = sorted({v for v in temperatures_in(p["reasons"]) if all(abs(v - a) > TEMP_TOLERANCE_C + 1e-9 for a in allowed)})
        climate += [f"{label}: {v:g} °C is not in the map's data there or a Köppen threshold" for v in bad_t]
    if land:
        failed.append(("on land", land))
    if climate:
        failed.append(("climate matches the map", climate))
    return failed


def parse_stream(lines):
    """Read claude's stream-json output. → {result, is_error, model,
    mcp_ok, mcp_status, tool_uses: [{name, input}]}."""
    out = {"result": None, "is_error": True, "model": None, "mcp_ok": False, "mcp_status": "no init message", "tool_uses": []}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        if msg.get("type") == "system" and msg.get("subtype") == "init":
            servers = {s.get("name"): s.get("status") for s in msg.get("mcp_servers", [])}
            tools = set(msg.get("tools", []))
            out["mcp_status"] = servers.get("fcm", "not loaded")
            out["mcp_ok"] = all(t in tools for t in MAP_TOOLS)
            out["model"] = msg.get("model")
        elif msg.get("type") == "assistant":
            for block in (msg.get("message") or {}).get("content") or []:
                if block.get("type") == "tool_use":
                    out["tool_uses"].append({"name": block.get("name"), "input": block.get("input")})
        elif msg.get("type") == "result":
            out["result"] = msg.get("result")
            out["is_error"] = bool(msg.get("is_error"))
            out["model"] = ", ".join((msg.get("modelUsage") or {}).keys()) or out["model"]
    return out


def make_map_ask(claude, data_path, model=None, picture=None):
    """ask(prompt, log_path) → (answer text, model, info), running
    `claude -p` with only the map query tool. info: {safe_mode,
    tool_uses}. Tries --safe-mode first; if the map tool isn't loaded
    under it, stops that run before any answer and runs without it."""
    image = None
    if picture:
        with open(picture, "rb") as f:
            image = base64.b64encode(f.read()).decode("ascii")

    def run(prompt, log_path, safe_mode):
        content = []
        if image:
            content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image}})
        content.append({"type": "text", "text": prompt})
        message = json.dumps({"type": "user", "message": {"role": "user", "content": content}})
        with tempfile.TemporaryDirectory(prefix="fcm-companion-") as cwd:
            config = os.path.join(cwd, "mcp.json")
            with open(config, "w", encoding="utf-8") as f:
                json.dump({"mcpServers": {"fcm": {"type": "stdio", "command": sys.executable, "args": [
                    "-B", os.path.join(os.path.dirname(os.path.abspath(__file__)), "mapquery.py"), "serve",
                    os.path.abspath(data_path), "--log", os.path.abspath(log_path)]}}}, f)
            cmd = [claude, "-p", "--tools", "", "--mcp-config", config, "--strict-mcp-config",
                   "--allowedTools", ",".join(MAP_TOOLS), "--disable-slash-commands", "--no-session-persistence",
                   "--permission-prompts", "none", "--input-format", "stream-json", "--output-format", "stream-json",
                   "--verbose", "--system-prompt", ASK_SYSTEM_PROMPT]
            if safe_mode:
                cmd.append("--safe-mode")
            if model:
                cmd += ["--model", model]
            env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
            proc = subprocess.run(cmd, input=message + "\n", capture_output=True, text=True, encoding="utf-8",
                                  cwd=cwd, env=env, timeout=900)
        info = parse_stream(proc.stdout.splitlines())
        if proc.returncode != 0 and info["result"] is None:
            raise RuntimeError(f"claude exited with {proc.returncode}: {(proc.stderr or proc.stdout).strip()[:800]}")
        return info

    def tool_loaded(info, log_path):
        # At start-up a server can still be "pending", so a call actually
        # made (by the model's account or the server's log) also counts.
        return info["mcp_ok"] or any(u["name"] in MAP_TOOLS for u in info["tool_uses"]) or bool(read_calls(log_path))

    def ask(prompt, log_path):
        info = run(prompt, log_path, safe_mode=True)
        safe = True
        if not tool_loaded(info, log_path):
            print(f"Map tool not loaded under --safe-mode (status: {info['mcp_status']}); running again without --safe-mode.")
            info = run(prompt, log_path, safe_mode=False)
            safe = False
            if not tool_loaded(info, log_path):
                raise RuntimeError(f"the map query tool didn't load (status: {info['mcp_status']})")
        if info["is_error"] or info["result"] is None:
            raise RuntimeError(f"claude reported an error: {str(info['result'])[:800]}")
        return info["result"], info["model"] or model or "CLI default", {"safe_mode": safe, "tool_uses": info["tool_uses"]}
    return ask


def read_calls(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def run_ask(question, d, ask, log_dir, picture_name=None, log=print):
    """Ask, check, retry once. → (ok, answer, model, attempt, failed,
    calls (the server's log, each with its attempt), info)."""
    prompt = ASK_PROMPT.format(
        question=question.strip(), map_desc=map_description(d),
        picture_note=f"A picture of the map ({picture_name}, with latitude/longitude lines) is attached.\n" if picture_name else "")
    lookup = lambda lat, lon: mapquery.point(d, lat, lon)  # noqa: E731
    calls = []
    attempt_prompt = prompt
    for attempt in (1, 2):
        path = os.path.join(log_dir, f"calls-{attempt}.jsonl")
        if os.path.exists(path):
            os.remove(path)  # this attempt's calls only
        answer, model, info = ask(attempt_prompt, path)
        calls += [{**c, "attempt": attempt} for c in read_calls(path)]
        failed = check_ask(answer, lookup)
        if not failed:
            return True, answer, model, attempt, [], calls, info
        if attempt == 1:
            log("Attempt 1 failed these checks:\n" + failure_text(failed))
            log("Retrying once with the failures sent back…")
            attempt_prompt = RETRY.format(prompt=prompt, failures=failure_text(failed), reply=answer)
    return False, answer, model, 2, failed, calls, info


def ask_header(question_path, data_path, d, picture_name, model, claude_source, attempt, calls, info):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    counts = {}
    for c in calls:
        counts[c["tool"]] = counts.get(c["tool"], 0) + 1
    tally = ", ".join(f"{t} ×{n}" for t, n in sorted(counts.items())) or "none"
    return (
        f"# Map companion: {os.path.basename(question_path)}\n\n"
        f"- **Question:** {os.path.basename(question_path)}\n"
        f"- **Map:** {os.path.basename(data_path)} ({map_description(d)})\n"
        f"- **Picture:** {picture_name or 'none'}\n"
        f"- **Generated:** {now} by Claude Code headless "
        f"(`claude -p`, {claude_source}, safe mode {'on' if info.get('safe_mode') else 'off'}), model {model}\n"
        f"- **Checks passed:** {', '.join(['sections', 'placements JSON', 'on land', 'climate matches the map'])} "
        f"(attempt {attempt} of 2)\n"
        f"- **Map tool calls:** {len(calls)} ({tally}); listed in answer.toolcalls.jsonl\n\n"
        "*Written by tools/companion.py. The answer below is the model's; the checks above are the code's, "
        "against tools/mapquery.py.*\n\n"
        "---\n\n"
    )


def ask_main(args):
    try:
        with open(args.ask, encoding="utf-8") as f:
            question = f.read()
        d = mapquery.MapData.load(args.map)
    except (OSError, ValueError) as e:
        print(f"Can't read the question or map: {e}", file=sys.stderr)
        return 2
    if args.picture and not os.path.exists(args.picture):
        print(f"No picture at {args.picture}", file=sys.stderr)
        return 2
    claude, source = find_claude(args.claude)
    if not claude:
        print("claude CLI not found. Install it (see tools/README.md) or pass --claude PATH.", file=sys.stderr)
        return 2
    picture_name = os.path.basename(args.picture) if args.picture else None
    print(f"Question {args.ask}; map {args.map} ({d.w} × {d.h}); picture {picture_name or 'none'}")
    print(f"Using claude from {source}: {claude}")
    out_dir = args.out or os.path.dirname(os.path.abspath(args.ask))
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="fcm-calls-") as log_dir:
        try:
            ok, answer, model, attempt, failed, calls, info = run_ask(
                question, d, make_map_ask(claude, args.map, args.model, args.picture), log_dir, picture_name)
        except (OSError, RuntimeError, ValueError, KeyError, subprocess.TimeoutExpired) as e:
            print(f"claude run failed: {e}", file=sys.stderr)
            return 2
    with open(os.path.join(out_dir, "answer.toolcalls.jsonl"), "w", encoding="utf-8", newline="\n") as f:
        for c in calls:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"Map tool calls: {len(calls)} (model reported {len(info['tool_uses'])} on the last attempt)")
    if not ok:
        raw = os.path.join(out_dir, "answer.raw.md")
        with open(raw, "w", encoding="utf-8", newline="\n") as f:
            f.write(answer)
        print("Attempt 2 also failed these checks:\n" + failure_text(failed), file=sys.stderr)
        print(f"Kept the raw answer in {raw}; answer.md was not written.", file=sys.stderr)
        return 1
    path = os.path.join(out_dir, "answer.md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(ask_header(args.ask, args.map, d, picture_name, model, source, attempt, calls, info) + answer.strip() + "\n")
    print(f"All checks passed (attempt {attempt}). Wrote {path}")
    return 0


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    ap = argparse.ArgumentParser(description="Worldbuilding advice for one exported tile, or answers about a whole "
                                             "map (--ask), via claude -p.")
    ap.add_argument("tile", nargs="?", help="tile summary JSON exported by the app")
    ap.add_argument("--ask", metavar="QUESTION_FILE", help="map mode: a text file with your question")
    ap.add_argument("--map", metavar="DATA", help="map mode: the File > Export Map Data file")
    ap.add_argument("--picture", metavar="PNG", help="map mode: the File > Export Map Picture file (optional)")
    ap.add_argument("--out", help="folder for advice.md (default: the JSON's folder)")
    ap.add_argument("--claude", help="path to the claude CLI (default: PATH, then the desktop app's copy)")
    ap.add_argument("--model", help="model alias or name (default: the CLI's default)")
    args = ap.parse_args(argv)
    if args.ask or args.map or args.picture:
        if not (args.ask and args.map) or args.tile:
            print("Map mode needs --ask QUESTION_FILE and --map DATA, and no tile file.", file=sys.stderr)
            return 2
        return ask_main(args)
    if not args.tile:
        print("Give a tile summary JSON, or --ask QUESTION_FILE --map DATA.", file=sys.stderr)
        return 2

    try:
        summary = load_summary(args.tile)
    except (OSError, ValueError) as e:
        print(f"Can't read {args.tile}: {e}", file=sys.stderr)
        return 2
    claude, source = find_claude(args.claude)
    if not claude:
        print("claude CLI not found. Install it (see tools/README.md) or pass --claude PATH.", file=sys.stderr)
        return 2
    print(f"Tile {fmt_lat_lon(summary)}, Köppen {summary['koppen']['code']}")
    print(f"Using claude from {source}: {claude}")
    out_dir = args.out or os.path.dirname(os.path.abspath(args.tile))
    os.makedirs(out_dir, exist_ok=True)

    try:
        ok, reply, model, attempt, failed = run_companion(summary, make_ask(claude, args.model))
    except (OSError, RuntimeError, ValueError, KeyError, subprocess.TimeoutExpired) as e:
        print(f"claude run failed: {e}", file=sys.stderr)
        return 2

    if not ok:
        raw = os.path.join(out_dir, "advice.raw.md")
        with open(raw, "w", encoding="utf-8", newline="\n") as f:
            f.write(reply)
        print("Attempt 2 also failed these checks:\n" + failure_text(failed), file=sys.stderr)
        print(f"Kept the raw reply in {raw}; advice.md was not written.", file=sys.stderr)
        return 1
    path = os.path.join(out_dir, "advice.md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(header(summary, model, source, attempt) + reply.strip() + "\n")
    print(f"All checks passed (attempt {attempt}). Wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
