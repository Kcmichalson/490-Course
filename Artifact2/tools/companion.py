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
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

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


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    ap = argparse.ArgumentParser(description="Worldbuilding advice for one exported tile, via claude -p.")
    ap.add_argument("tile", help="tile summary JSON exported by the app")
    ap.add_argument("--out", help="folder for advice.md (default: the JSON's folder)")
    ap.add_argument("--claude", help="path to the claude CLI (default: PATH, then the desktop app's copy)")
    ap.add_argument("--model", help="model alias or name (default: the CLI's default)")
    args = ap.parse_args(argv)

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
